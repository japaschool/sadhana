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
pub mod panels;

use self::panels::PanelsReport;

#[derive(Debug, Serialize, Deserialize)]
pub struct Report {
    pub id: Uuid,
    pub definition: ReportDefinition,
    pub name: String,
}

impl Report {
    pub fn get_all(
        conn: &mut PgConnection,
        user_id: &Uuid,
        level: u8,
        months: bool,
        shared: bool,
    ) -> Result<Vec<Self>, AppError> {
        let data = DBReport::get_all(conn, user_id, level > 0)?;

        let mut res = Vec::with_capacity(data.len());

        for (report, traces) in data {
            let definition = match report.report_type {
                ReportType::Graph => {
                    ReportDefinition::Graph(GraphReport::try_from((report.bar_layout, traces))?)
                }
                ReportType::Grid => {
                    ReportDefinition::Grid(GridReport::from_db(report.group_columns, traces))
                }
                ReportType::Panels => {
                    let def = report
                        .definition
                        .ok_or(err("Missing definition for panels report"))?;
                    // A newer server (preview, same DB) may have saved a kind this one can't read:
                    // leave that report out rather than failing the whole list.
                    match serde_json::from_value(def) {
                        Ok(p) => ReportDefinition::Panels(p),
                        Err(e) => {
                            log::warn!("Skipping unreadable panels report {}: {e}", report.id);
                            continue;
                        }
                    }
                }
            };

            if let ReportDefinition::Panels(p) = &definition {
                // Level 3+ reports stay private: they're for the owner's own reflection.
                if (!months && p.has_month()) || p.level() > level || (shared && p.level() >= 3) {
                    continue;
                }
            }

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
    Panels(PanelsReport),
}

impl ReportDefinition {
    /// Every practice the report draws: the practices a share link may expose for it.
    pub fn practice_ids(&self) -> HashSet<Uuid> {
        match self {
            ReportDefinition::Grid(grid) => grid.practices.iter().copied().collect(),
            ReportDefinition::Graph(graph) => graph.traces.iter().map(|t| t.practice).collect(),
            ReportDefinition::Panels(panels) => panels.practice_ids(),
        }
    }

    fn report_type(&self) -> ReportType {
        match self {
            ReportDefinition::Grid(_) => ReportType::Grid,
            ReportDefinition::Graph(_) => ReportType::Graph,
            ReportDefinition::Panels(_) => ReportType::Panels,
        }
    }

    fn group_columns(&self) -> Option<bool> {
        match self {
            ReportDefinition::Grid(grid) => grid.group_columns,
            ReportDefinition::Graph(_) | ReportDefinition::Panels(_) => None,
        }
    }

    fn bar_layout(&self) -> Option<BarLayout> {
        match self {
            ReportDefinition::Grid(_) | ReportDefinition::Panels(_) => None,
            ReportDefinition::Graph(graph) => Some(graph.bar_layout.clone()),
        }
    }

    fn definition_json(&self) -> Option<serde_json::Value> {
        match self {
            ReportDefinition::Panels(panels) => serde_json::to_value(panels).ok(),
            _ => None,
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
    pub label: Option<String>,
    pub type_: TraceType,
    pub practice: Uuid,
    pub y_axis: Option<YAxis>,
    pub show_average: bool,
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
            label: value.label,
            type_: graph_type,
            practice: value.practice_id,
            y_axis: value.y_axis.map(|a| a.parse()).transpose()?,
            show_average: value.show_average.unwrap_or(false),
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GridReport {
    /// Column order.
    pub practices: Vec<Uuid>,
    /// Absent on input from clients that predate the flag: keep the stored value.
    #[serde(default)]
    pub group_columns: Option<bool>,
}

impl GridReport {
    fn from_db(group_columns: bool, traces: Vec<DBReportTrace>) -> Self {
        GridReport {
            practices: traces.into_iter().map(|t| t.practice_id).collect(),
            group_columns: Some(group_columns),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ReportsQuery {
    /// The panels format level the client can draw: `true` = 1, missing = 0 (older clients
    /// can't draw panels reports at all). A report needing a higher level is left out.
    #[serde(default, deserialize_with = "level")]
    pub panels: u8,
    /// Cached builds that know panels still can't draw a Month panel; left out unless asked for.
    #[serde(default)]
    pub months: bool,
}

fn level<'de, D: serde::Deserializer<'de>>(d: D) -> Result<u8, D::Error> {
    let s = String::deserialize(d)?;
    match s.as_str() {
        "true" => Ok(1),
        "false" => Ok(0),
        _ => s.parse().map_err(serde::de::Error::custom),
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
    query: web::Query<ReportsQuery>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;

    let res =
        web::block(move || Report::get_all(&mut conn, &user_id, query.panels, query.months, false))
            .await??;

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
    req: HttpRequest,
    path: web::Path<ReportIdSlug>,
    form: web::Json<NewReportForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let report_id = path.into_inner();

    web::block(move || {
        DBReport::update(
            &mut conn,
            &user_id,
            &report_id,
            &form.report.name,
            &form.report.definition,
        )
    })
    .await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Deletes a report
pub async fn delete_report(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<ReportIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let report_id = path.into_inner();

    web::block(move || DBReport::delete(&mut conn, &user_id, &report_id)).await??;

    Ok(HttpResponse::Ok().json(()))
}

type ReportIdSlug = Uuid;

#[derive(Debug, Deserialize)]
pub struct NewReportForm {
    pub report: NewReport,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn panels_query_is_a_level() {
        let q = |s| {
            web::Query::<ReportsQuery>::from_query(s)
                .unwrap()
                .into_inner()
        };
        assert_eq!(q("panels=true&months=true").panels, 1);
        assert_eq!(q("panels=3&months=true").panels, 3);
        assert_eq!(q("").panels, 0);
        assert_eq!(q("panels=false").panels, 0);
        assert!(web::Query::<ReportsQuery>::from_query("panels=yes").is_err());
    }

    fn id(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }

    fn panels(v: serde_json::Value) -> ReportDefinition {
        ReportDefinition::Panels(serde_json::from_value(v).unwrap())
    }

    fn src(n: u128) -> serde_json::Value {
        serde_json::json!({"Practice": {"practice": id(n)}})
    }

    fn stat(value: serde_json::Value, under: serde_json::Value) -> serde_json::Value {
        serde_json::json!({"label": {"Key": "k"}, "value": value, "under": under})
    }

    fn ids(range: std::ops::RangeInclusive<u128>) -> HashSet<Uuid> {
        range.map(id).collect()
    }

    #[test]
    fn practice_ids_cover_every_report_kind() {
        let graph = ReportDefinition::Graph(GraphReport {
            bar_layout: BarLayout::Grouped,
            traces: [1, 2]
                .map(|n| PracticeTrace {
                    label: None,
                    type_: TraceType::Bar,
                    practice: id(n),
                    y_axis: None,
                    show_average: false,
                })
                .into(),
        });
        assert_eq!(graph.practice_ids(), ids(1..=2));

        let grid = ReportDefinition::Grid(GridReport {
            practices: vec![id(3), id(1)],
            group_columns: None,
        });
        assert_eq!(grid.practice_ids(), HashSet::from([id(1), id(3)]));

        // Every place a practice id can sit in the panels types, each with its own id.
        let scope = serde_json::json!({"today": true, "missing_zero": false});
        let goal = |n: u128| {
            serde_json::json!({"practice": id(n), "direction": "AtLeast", "amount": 1,
                "period": "Day", "counts": "Total"})
        };
        let series = |source: serde_json::Value| {
            serde_json::json!({"label": null, "mark": "Bar", "source": source,
                "axis": "Left", "only_with": null})
        };
        let calc = serde_json::json!({"Calc": {"terms": [
            {"sign": 1, "practice": id(2), "day_offset": 0, "optional": false},
            {"sign": -1, "practice": id(3), "day_offset": 0, "optional": true}]}});
        let range = serde_json::json!({"Range": {
            "from": {"practice": id(4), "day_offset": 0},
            "to": {"practice": id(5), "day_offset": 0}}});
        let full = panels(serde_json::json!({
            "version": 1,
            "template": null,
            "required": [{"practice": id(20), "label": {"Key": "k"}}],
            "panels": [
                {"kind": "Chart", "title": null, "bar_layout": "Grouped", "format": "Count",
                 "reversed": false, "headline": false,
                 "series": [series(src(1)), series(calc), series(range)],
                 "target": {"min": 1, "max": null, "of": src(6), "lines": false,
                            "colour": false, "label": null},
                 "lines": [{"of": src(7), "pick": null, "dashed": false, "label": null}]},
                {"kind": "Stats", "stats": [
                    stat(serde_json::json!({"Average": {"of": src(8), "pick": null,
                        "format": "Count", "scope": scope}}),
                        stat(serde_json::json!({"Logged": {"of": src(9), "scope": scope}}),
                            stat(serde_json::json!({"CountTrue": {"of": src(10), "scope": scope}}),
                                serde_json::Value::Null))),
                    stat(serde_json::json!({"OnTarget": {"of": src(11), "min": null,
                        "max": null, "scope": scope}}), serde_json::Value::Null)]},
                {"kind": "Month", "practice": id(12)},
                {"kind": "Gaps", "event": id(13)},
                {"kind": "Around", "event": id(14),
                 "rows": [{"label": null, "source": src(15)}]},
                {"kind": "Goals", "goals": [goal(16)]}
            ]
        }));
        // 1..=7 charts, 8..=11 stats (nested `under` too), 12..=16 other panels, 20 required.
        let mut want = ids(1..=16);
        want.insert(id(20));
        assert_eq!(full.practice_ids(), want);

        // Each template keeps its own practices.
        let template = |t: serde_json::Value| {
            panels(serde_json::json!({"version": 1, "template": t, "required": [], "panels": []}))
        };
        let t = template(serde_json::json!({"Sleep":
            {"bedtime": id(1), "wake": id(2), "nap": id(3), "min": null, "max": null}}));
        assert_eq!(t.practice_ids(), ids(1..=3));
        let t = template(serde_json::json!({"Japa":
            {"total": id(1), "target": 16, "morning": id(2), "quality": id(3), "attunement": id(4)}}));
        assert_eq!(t.practice_ids(), ids(1..=4));
        let t =
            template(serde_json::json!({"Duration": {"practices": [id(1), id(2)], "goal": null}}));
        assert_eq!(t.practice_ids(), ids(1..=2));
        let t = template(serde_json::json!({"Days": {"practices": [id(1), id(2)]}}));
        assert_eq!(t.practice_ids(), ids(1..=2));
        let t = template(serde_json::json!({"Gaps": {"event": id(1), "rows": [id(2)],
            "sleep": {"bedtime": id(3), "wake": id(4), "nap": id(5)}}}));
        assert_eq!(t.practice_ids(), ids(1..=5));
        let t = template(serde_json::json!({"Goals": {"goals": [goal(1), goal(2)]}}));
        assert_eq!(t.practice_ids(), ids(1..=2));
    }
}
