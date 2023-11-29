use std::{collections::HashSet, fmt::Display, str::FromStr};

use actix_web::{web, HttpRequest, HttpResponse};
use common::error::AppError;
use diesel::PgConnection;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    db_types::{BarLayout, LineStyle as DBLineStyle, ReportType, TraceType as DBTraceType},
    middleware::{auth, state::AppState},
};

use self::db::{Report as DBReport, ReportTrace as DBReportTrace};

pub mod db;

#[derive(Debug, Serialize, Deserialize)]
pub struct Report {
    pub id: Uuid,
    pub definition: ReportDefinition,
    pub name: String,
}

impl Report {
    pub fn get_all(conn: &mut PgConnection, user_id: &Uuid) -> Result<Vec<Self>, AppError> {
        let data = DBReport::get_all(conn, user_id)?;

        let mut res = Vec::with_capacity(data.len());

        for (report, traces) in data {
            let definition = match report.report_type {
                ReportType::Graph => {
                    ReportDefinition::Graph(GraphReport::try_from((report.bar_layout, traces))?)
                }
                ReportType::Grid => ReportDefinition::Grid(traces.into()),
            };

            res.push(Report {
                id: report.id,
                definition,
                name: report.name,
            });
        }

        Ok(res)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub enum ReportDefinition {
    Grid(GridReport),
    Graph(GraphReport),
}

impl ReportDefinition {
    fn report_type(&self) -> ReportType {
        match self {
            ReportDefinition::Grid(_) => ReportType::Grid,
            ReportDefinition::Graph(_) => ReportType::Graph,
        }
    }

    fn bar_layout(&self) -> Option<BarLayout> {
        match self {
            ReportDefinition::Grid(_) => None,
            ReportDefinition::Graph(graph) => Some(graph.bar_layout.clone()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphReport {
    pub bar_layout: BarLayout,
    pub traces: Vec<PracticeTrace>,
}

impl TryFrom<(Option<BarLayout>, Vec<DBReportTrace>)> for GraphReport {
    type Error = AppError;

    fn try_from(value: (Option<BarLayout>, Vec<DBReportTrace>)) -> Result<Self, Self::Error> {
        let bar_layout = value.0.ok_or(err("Missing bar layout for graph report"))?;

        let mut traces = Vec::with_capacity(value.1.len());

        for t in value.1 {
            let trace = t.try_into()?;
            traces.push(trace);
        }

        Ok(GraphReport { bar_layout, traces })
    }
}

fn err<S: Into<String>>(msg: S) -> AppError {
    AppError::UnprocessableEntity(vec![msg.into()])
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PracticeTrace {
    pub name: Option<String>,
    pub type_: TraceType,
    pub practice: Uuid,
    pub y_axis: Option<YAxis>,
    pub show_average: bool,
}

impl PracticeTrace {
    pub fn new_minimal(trace_type: TraceType, practice: Uuid) -> Self {
        Self {
            name: None,
            type_: trace_type,
            practice,
            y_axis: None,
            show_average: true,
        }
    }
}

impl TryFrom<DBReportTrace> for PracticeTrace {
    type Error = AppError;

    fn try_from(value: DBReportTrace) -> Result<Self, Self::Error> {
        let graph_type = match value.trace_type.ok_or(err("Missing trace type"))? {
            DBTraceType::Bar => TraceType::Bar,
            DBTraceType::Line => TraceType::Line(LineConf {
                style: value.line_style.ok_or(err("Missing line style"))?.into(),
            }),
            DBTraceType::Dot => TraceType::Dot,
        };

        Ok(PracticeTrace {
            name: value.label,
            type_: graph_type,
            practice: value.practice_id,
            y_axis: value.y_axis.map(|a| a.parse()).transpose()?,
            show_average: value.show_average.unwrap_or(false),
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GridReport {
    pub practices: HashSet<Uuid>,
}

impl From<Vec<DBReportTrace>> for GridReport {
    fn from(value: Vec<DBReportTrace>) -> Self {
        GridReport {
            practices: value.into_iter().map(|t| t.practice_id).collect(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct NewReport {
    pub name: String,
    pub definition: ReportDefinition,
}

/// Gets all the reports
pub async fn get_reports(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;

    let res = web::block(move || Report::get_all(&mut conn, &user_id)).await??;

    Ok(HttpResponse::Ok().json(GetAllReportsResponse { reports: res }))
}

/// Inserts a new report
pub async fn create_report(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<NewReportForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;

    let report_id = web::block(move || {
        DBReport::create(
            &mut conn,
            &user_id,
            &form.report.name,
            &form.report.definition,
        )
    })
    .await??;

    Ok(HttpResponse::Ok().json(CreateReportResponse::new(report_id)))
}

/// Updates report name and definition
pub async fn update_report(
    state: web::Data<AppState>,
    path: web::Path<ReportIdSlug>,
    form: web::Json<NewReportForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let report_id = path.into_inner();

    web::block(move || {
        DBReport::update(
            &mut conn,
            &report_id,
            &form.report.name,
            &form.report.definition,
        )
    })
    .await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Updates report name and definition
pub async fn delete_report(
    state: web::Data<AppState>,
    path: web::Path<ReportIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let report_id = path.into_inner();

    web::block(move || DBReport::delete(&mut conn, &report_id)).await??;

    Ok(HttpResponse::Ok().json(()))
}

type ReportIdSlug = Uuid;

#[derive(Debug, Deserialize)]
pub struct NewReportForm {
    pub report: NewReport,
}
#[derive(Debug, Deserialize)]
pub struct ReportForm {
    pub report: Report,
}

#[derive(Debug, Serialize)]
pub struct CreateReportResponse {
    pub report_id: Uuid,
}

impl CreateReportResponse {
    fn new(report_id: Uuid) -> Self {
        Self { report_id }
    }
}

#[derive(Debug, Serialize)]
pub struct GetAllReportsResponse {
    pub reports: Vec<Report>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum YAxis {
    Y,
    Y2,
    Y3,
    Y4,
    Y5,
    Y6,
    Y7,
    Y8,
}

impl FromStr for YAxis {
    type Err = AppError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "y" => Ok(YAxis::Y),
            "y2" => Ok(YAxis::Y2),
            "y3" => Ok(YAxis::Y3),
            "y4" => Ok(YAxis::Y4),
            "y5" => Ok(YAxis::Y5),
            "y6" => Ok(YAxis::Y6),
            "y7" => Ok(YAxis::Y7),
            "y8" => Ok(YAxis::Y8),
            _ => Err(err("Wrong Y Axis value")),
        }
    }
}

impl Display for YAxis {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            YAxis::Y => "y",
            YAxis::Y2 => "y2",
            YAxis::Y3 => "y3",
            YAxis::Y4 => "y4",
            YAxis::Y5 => "y5",
            YAxis::Y6 => "y6",
            YAxis::Y7 => "y7",
            YAxis::Y8 => "y8",
        };
        write!(f, "{}", s)
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub enum TraceType {
    Bar,
    Line(LineConf),
    Dot,
}

impl From<&TraceType> for DBTraceType {
    fn from(value: &TraceType) -> Self {
        match value {
            TraceType::Bar => DBTraceType::Bar,
            TraceType::Line(_) => DBTraceType::Line,
            TraceType::Dot => DBTraceType::Dot,
        }
    }
}

impl TryFrom<&TraceType> for DBLineStyle {
    type Error = ();

    fn try_from(value: &TraceType) -> Result<Self, Self::Error> {
        match value {
            TraceType::Bar => Err(()),
            TraceType::Line(conf) => Ok(conf.into()),
            TraceType::Dot => Err(()),
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct LineConf {
    pub style: LineStyle,
}

impl From<&LineConf> for DBLineStyle {
    fn from(value: &LineConf) -> Self {
        match value.style {
            LineStyle::Regular => DBLineStyle::Regular,
            LineStyle::Square => DBLineStyle::Square,
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub enum LineStyle {
    Regular,
    Square,
}

impl From<DBLineStyle> for LineStyle {
    fn from(value: DBLineStyle) -> Self {
        match value {
            DBLineStyle::Regular => LineStyle::Regular,
            DBLineStyle::Square => LineStyle::Square,
        }
    }
}
