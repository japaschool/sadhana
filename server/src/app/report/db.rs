use crate::db_types::{BarLayout, LineStyle, ReportType, TraceType};
use crate::schema::{report_traces, reports};
use common::error::AppError;
use diesel::prelude::*;
use diesel::{result::Error as DieselError, PgConnection, RunQueryDsl};
use uuid::Uuid;

use super::ReportDefinition;

#[derive(Debug, PartialEq, Queryable, Identifiable, Selectable)]
#[diesel(table_name = reports)]
pub struct Report {
    pub id: Uuid,
    pub report_type: ReportType,
    pub name: String,
    pub bar_layout: Option<BarLayout>,
}

impl Report {
    pub fn create(
        conn: &mut PgConnection,
        user_id: &Uuid,
        report_name: &str,
        report_definition: &ReportDefinition,
    ) -> Result<Uuid, AppError> {
        let report_id = conn.transaction(|conn| {
            let report_id = diesel::insert_into(reports::table)
                .values((
                    reports::user_id.eq(user_id),
                    reports::report_type.eq(report_definition.report_type()),
                    reports::name.eq(report_name),
                    reports::bar_layout.eq(report_definition.bar_layout()),
                ))
                .returning(reports::id)
                .get_result(conn)?;

            ReportTrace::update(conn, &report_id, report_definition)?;

            Ok::<_, DieselError>(report_id)
        })?;

        Ok(report_id)
    }

    pub fn update(
        conn: &mut PgConnection,
        report_id: &Uuid,
        report_name: &str,
        report_definition: &ReportDefinition,
    ) -> Result<(), AppError> {
        conn.transaction(|conn| {
            diesel::update(reports::table)
                .set((
                    reports::name.eq(&report_name),
                    reports::bar_layout.eq(&report_definition.bar_layout()),
                ))
                .filter(reports::id.eq(&report_id))
                .execute(conn)?;

            ReportTrace::update(conn, report_id, report_definition)
        })?;

        Ok(())
    }

    pub fn delete(conn: &mut PgConnection, report_id: &Uuid) -> Result<(), AppError> {
        conn.transaction(|conn| {
            ReportTrace::delete(conn, report_id)?;

            diesel::delete(reports::table)
                .filter(reports::id.eq(&report_id))
                .execute(conn)
        })?;

        Ok(())
    }

    pub fn get_all(
        conn: &mut PgConnection,
        user_id: &Uuid,
    ) -> Result<Vec<(Self, Vec<ReportTrace>)>, AppError> {
        let reports: Vec<Self> = reports::table
            .select(Report::as_select())
            .order_by(reports::name)
            .filter(reports::user_id.eq(&user_id))
            .load(conn)?;

        let traces = ReportTrace::belonging_to(&reports)
            .select(ReportTrace::as_select())
            .load::<ReportTrace>(conn)?
            .grouped_by(&reports);

        let res = reports.into_iter().zip(traces).collect::<Vec<_>>();

        Ok(res)
    }
}

#[derive(Debug, PartialEq, Queryable, Selectable, Identifiable, Associations)]
#[diesel(belongs_to(Report))]
#[diesel(table_name = report_traces)]
pub struct ReportTrace {
    pub id: Uuid,
    pub report_id: Uuid,
    pub practice_id: Uuid,
    pub trace_type: Option<TraceType>,
    pub label: Option<String>,
    pub y_axis: Option<String>,
    pub show_average: Option<bool>,
    pub line_style: Option<LineStyle>,
}

impl ReportTrace {
    fn update(
        conn: &mut PgConnection,
        report_id: &Uuid,
        report_definition: &ReportDefinition,
    ) -> Result<(), DieselError> {
        let records: Vec<_> = match report_definition {
            ReportDefinition::Grid(grid) => grid
                .practices
                .iter()
                .map(|p| NewReportTrace::new(report_id.to_owned(), p.to_owned()))
                .collect(),
            ReportDefinition::Graph(graph) => graph
                .traces
                .iter()
                .map(|t| NewReportTrace {
                    report_id: report_id.to_owned(),
                    practice_id: t.practice,
                    trace_type: Some((&t.type_).into()),
                    label: t.label.clone(),
                    y_axis: t.y_axis.as_ref().map(|a| a.to_string()),
                    show_average: Some(t.show_average),
                    line_style: (&t.type_).try_into().ok(),
                })
                .collect(),
        };

        Self::delete(conn, report_id)?;

        NewReportTrace::insert(conn, records)?;

        Ok(())
    }

    fn delete(conn: &mut PgConnection, report_id: &Uuid) -> Result<(), DieselError> {
        diesel::delete(report_traces::table)
            .filter(report_traces::report_id.eq(&report_id))
            .execute(conn)?;
        Ok(())
    }
}

#[derive(Debug, Insertable)]
#[diesel(table_name = report_traces)]
pub struct NewReportTrace {
    pub report_id: Uuid,
    pub practice_id: Uuid,
    pub trace_type: Option<TraceType>,
    pub label: Option<String>,
    pub y_axis: Option<String>,
    pub show_average: Option<bool>,
    pub line_style: Option<LineStyle>,
}

impl NewReportTrace {
    fn new(report_id: Uuid, practice_id: Uuid) -> Self {
        Self {
            report_id,
            practice_id,
            trace_type: None,
            label: None,
            y_axis: None,
            show_average: None,
            line_style: None,
        }
    }

    fn insert(conn: &mut PgConnection, records: Vec<Self>) -> Result<(), DieselError> {
        diesel::insert_into(report_traces::table)
            .values(&records)
            .execute(conn)?;

        Ok(())
    }
}
