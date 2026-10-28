use crate::db_types::{BarLayout, LineStyle, ReportType, TraceType};
use crate::schema::{report_traces, reports};
use common::error::AppError;
use diesel::prelude::*;
use diesel::{result::Error as DieselError, PgConnection, RunQueryDsl};
use uuid::Uuid;

use super::{GridReport, ReportDefinition};

#[derive(Debug, PartialEq, Queryable, Identifiable, Selectable)]
#[diesel(table_name = reports)]
pub struct Report {
    pub id: Uuid,
    pub report_type: ReportType,
    pub name: String,
    pub bar_layout: Option<BarLayout>,
    pub group_columns: bool,
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
                    reports::group_columns.eq(report_definition.group_columns().unwrap_or(true)),
                ))
                .returning(reports::id)
                .get_result(conn)?;

            ReportTrace::update(conn, &report_id, report_definition, None)?;

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
            // An old client sends no flag: keep the stored setting and column order.
            let kept_order = match report_definition {
                ReportDefinition::Grid(GridReport {
                    practices,
                    group_columns: None,
                }) => Some(ReportTrace::keep_stored_order(conn, report_id, practices)?),
                _ => None,
            };

            diesel::update(reports::table)
                .set((
                    reports::name.eq(&report_name),
                    reports::bar_layout.eq(&report_definition.bar_layout()),
                ))
                .filter(reports::id.eq(&report_id))
                .execute(conn)?;

            if let Some(group_columns) = report_definition.group_columns() {
                diesel::update(reports::table)
                    .set(reports::group_columns.eq(group_columns))
                    .filter(reports::id.eq(&report_id))
                    .execute(conn)?;
            }

            ReportTrace::update(conn, report_id, report_definition, kept_order.as_deref())
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
            .order_by(report_traces::order_key)
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
        grid_order: Option<&[Uuid]>,
    ) -> Result<(), DieselError> {
        let records: Vec<_> = match report_definition {
            ReportDefinition::Grid(grid) => grid_order
                .unwrap_or(&grid.practices)
                .iter()
                .enumerate()
                .map(|(i, p)| NewReportTrace::new(report_id.to_owned(), p.to_owned(), i as i32))
                .collect(),
            ReportDefinition::Graph(graph) => graph
                .traces
                .iter()
                .enumerate()
                .map(|(i, t)| NewReportTrace {
                    report_id: report_id.to_owned(),
                    order_key: i as i32,
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

    /// Sent ids in their stored order, then new ids in the sent order.
    fn keep_stored_order(
        conn: &mut PgConnection,
        report_id: &Uuid,
        sent: &[Uuid],
    ) -> Result<Vec<Uuid>, DieselError> {
        let stored: Vec<Uuid> = report_traces::table
            .select(report_traces::practice_id)
            .filter(report_traces::report_id.eq(report_id))
            .order_by(report_traces::order_key)
            .load(conn)?;

        let mut res: Vec<Uuid> = stored.into_iter().filter(|p| sent.contains(p)).collect();
        for p in sent {
            if !res.contains(p) {
                res.push(*p);
            }
        }
        Ok(res)
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
    pub order_key: i32,
    pub trace_type: Option<TraceType>,
    pub label: Option<String>,
    pub y_axis: Option<String>,
    pub show_average: Option<bool>,
    pub line_style: Option<LineStyle>,
}

impl NewReportTrace {
    fn new(report_id: Uuid, practice_id: Uuid, order_key: i32) -> Self {
        Self {
            report_id,
            practice_id,
            order_key,
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

#[cfg(test)]
mod tests {
    use super::super::{GraphReport, GridReport, PracticeTrace, Report as ApiReport, TraceType};
    use super::*;
    use crate::db_types::{BarLayout, PracticeDataType};
    use crate::utils::db;
    use diesel::sql_query;
    use diesel::sql_types::{Text, Uuid as DieselUuid};

    fn user_with_practices(conn: &mut PgConnection) -> (Uuid, [Uuid; 4]) {
        let user_id = Uuid::new_v4();
        sql_query("insert into users (id, email, hash, name) values ($1, $2, '', 'x')")
            .bind::<DieselUuid, _>(user_id)
            .bind::<Text, _>(format!("{user_id}@reports.test"))
            .execute(conn)
            .unwrap();
        let mut ids = [Uuid::nil(); 4];
        for (i, name) in ["A", "B", "C", "D"].iter().enumerate() {
            ids[i] = diesel::insert_into(crate::schema::user_practices::table)
                .values((
                    crate::schema::user_practices::user_id.eq(user_id),
                    crate::schema::user_practices::practice.eq(*name),
                    crate::schema::user_practices::data_type.eq(PracticeDataType::Int),
                    crate::schema::user_practices::is_active.eq(true),
                    crate::schema::user_practices::order_key.eq(i as i32),
                ))
                .returning(crate::schema::user_practices::id)
                .get_result(conn)
                .unwrap();
        }
        (user_id, ids)
    }

    fn run(f: impl FnOnce(&mut PgConnection) -> Result<(), AppError>) {
        let mut conn = db::establish_connection().get().unwrap();
        conn.test_transaction::<_, AppError, _>(|c| f(c));
    }

    fn grid(practices: Vec<Uuid>, group_columns: Option<bool>) -> ReportDefinition {
        ReportDefinition::Grid(GridReport {
            practices,
            group_columns,
        })
    }

    fn only_grid(conn: &mut PgConnection, user_id: &Uuid) -> (Vec<Uuid>, Option<bool>) {
        match ApiReport::get_all(conn, user_id)
            .unwrap()
            .remove(0)
            .definition
        {
            ReportDefinition::Grid(g) => (g.practices, g.group_columns),
            _ => panic!("not a grid"),
        }
    }

    #[test]
    fn grid_keeps_column_order() {
        run(|conn| {
            let (u, [a, b, c, _]) = user_with_practices(conn);
            Report::create(conn, &u, "r", &grid(vec![c, a, b], Some(false)))?;
            assert_eq!(only_grid(conn, &u), (vec![c, a, b], Some(false)));
            Ok(())
        });
    }

    #[test]
    fn graph_keeps_trace_order() {
        run(|conn| {
            let (u, [a, _, c, _]) = user_with_practices(conn);
            let trace = |practice| PracticeTrace {
                label: None,
                type_: TraceType::Bar,
                practice,
                y_axis: None,
                show_average: false,
            };
            let def = ReportDefinition::Graph(GraphReport {
                bar_layout: BarLayout::Stacked,
                traces: vec![trace(c), trace(a)],
            });
            Report::create(conn, &u, "r", &def)?;
            match ApiReport::get_all(conn, &u)?.remove(0).definition {
                ReportDefinition::Graph(g) => {
                    let order: Vec<_> = g.traces.iter().map(|t| t.practice).collect();
                    assert_eq!(order, vec![c, a]);
                }
                _ => panic!("not a graph"),
            }
            Ok(())
        });
    }

    #[test]
    fn grid_save_without_group_columns_keeps_setting_and_order() {
        run(|conn| {
            let (u, [a, b, c, d]) = user_with_practices(conn);
            let id = Report::create(conn, &u, "r", &grid(vec![b, a, c], Some(false)))?;
            Report::update(conn, &id, "r", &grid(vec![a, b, d], None))?;
            assert_eq!(only_grid(conn, &u), (vec![b, a, d], Some(false)));
            Ok(())
        });
    }

    #[test]
    fn grid_save_with_group_columns_takes_sent_order() {
        run(|conn| {
            let (u, [a, b, c, _]) = user_with_practices(conn);
            let id = Report::create(conn, &u, "r", &grid(vec![b, a, c], Some(false)))?;
            Report::update(conn, &id, "r", &grid(vec![a, c], Some(true)))?;
            assert_eq!(only_grid(conn, &u), (vec![a, c], Some(true)));
            Ok(())
        });
    }
}
