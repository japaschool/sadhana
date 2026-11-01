use crate::db_types::{BarLayout, LineStyle, ReportType, TraceType};
use crate::schema::{report_traces, reports};
use common::error::AppError;
use diesel::prelude::*;
use diesel::{result::Error as DieselError, PgConnection, RunQueryDsl};
use std::collections::HashSet;
use uuid::Uuid;

use super::panels::PanelsReport;
use super::{GridReport, ReportDefinition};

/// Ids of all the user's practices, hidden ones included.
fn owned_practices(conn: &mut PgConnection, user_id: &Uuid) -> Result<HashSet<Uuid>, AppError> {
    Ok(
        crate::app::user_practices::UserPractice::all_user_practices(conn, user_id)?
            .into_iter()
            .map(|p| p.id)
            .collect(),
    )
}

#[derive(Debug, PartialEq, Queryable, Identifiable, Selectable)]
#[diesel(table_name = reports)]
pub struct Report {
    pub id: Uuid,
    pub report_type: ReportType,
    pub name: String,
    pub bar_layout: Option<BarLayout>,
    pub group_columns: bool,
    pub definition: Option<serde_json::Value>,
}

impl Report {
    pub fn create(
        conn: &mut PgConnection,
        user_id: &Uuid,
        report_name: &str,
        report_definition: &ReportDefinition,
    ) -> Result<Uuid, AppError> {
        let report_id = conn.transaction(|conn| {
            if let ReportDefinition::Panels(p) = report_definition {
                p.validate(&owned_practices(conn, user_id)?)?;
            }
            let report_id = diesel::insert_into(reports::table)
                .values((
                    reports::user_id.eq(user_id),
                    reports::report_type.eq(report_definition.report_type()),
                    reports::name.eq(report_name),
                    reports::bar_layout.eq(report_definition.bar_layout()),
                    reports::group_columns.eq(report_definition.group_columns().unwrap_or(true)),
                    reports::definition.eq(report_definition.definition_json()),
                ))
                .returning(reports::id)
                .get_result(conn)?;

            ReportTrace::update(conn, &report_id, report_definition, None)?;

            Ok::<_, AppError>(report_id)
        })?;

        Ok(report_id)
    }

    pub fn update(
        conn: &mut PgConnection,
        user_id: &Uuid,
        report_id: &Uuid,
        report_name: &str,
        report_definition: &ReportDefinition,
    ) -> Result<(), AppError> {
        conn.transaction(|conn| {
            let (stored_type, stored) = reports::table
                .select((reports::report_type, reports::definition))
                .filter(reports::id.eq(report_id))
                .filter(reports::user_id.eq(user_id))
                .first::<(ReportType, Option<serde_json::Value>)>(conn)
                .optional()?
                .ok_or(AppError::NotFound)?;
            if stored_type != report_definition.report_type() {
                return Err(AppError::UnprocessableEntity(vec![
                    "A report can't change its type".into(),
                ]));
            }
            if let ReportDefinition::Panels(p) = report_definition {
                // Practices deleted since the report was saved may stay in it.
                let mut allowed = owned_practices(conn, user_id)?;
                if let Some(old) =
                    stored.and_then(|v| serde_json::from_value::<PanelsReport>(v).ok())
                {
                    allowed.extend(old.practice_ids());
                }
                p.validate(&allowed)?;
            }

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
                    report_definition
                        .group_columns()
                        .map(|v| reports::group_columns.eq(v)),
                    reports::definition.eq(&report_definition.definition_json()),
                ))
                .filter(reports::id.eq(&report_id))
                .filter(reports::user_id.eq(user_id))
                .execute(conn)?;

            ReportTrace::update(conn, report_id, report_definition, kept_order.as_deref())?;
            Ok::<_, AppError>(())
        })?;

        Ok(())
    }

    pub fn delete(
        conn: &mut PgConnection,
        user_id: &Uuid,
        report_id: &Uuid,
    ) -> Result<(), AppError> {
        conn.transaction(|conn| {
            // Traces go with the row (checked first so another user's report is untouched).
            let owned = reports::table
                .filter(reports::id.eq(report_id))
                .filter(reports::user_id.eq(user_id))
                .select(reports::id)
                .first::<Uuid>(conn)
                .optional()?;
            if owned.is_none() {
                return Err(AppError::NotFound);
            }
            ReportTrace::delete(conn, report_id)?;

            diesel::delete(reports::table)
                .filter(reports::id.eq(report_id))
                .execute(conn)?;
            Ok::<_, AppError>(())
        })
    }

    pub fn get_all(
        conn: &mut PgConnection,
        user_id: &Uuid,
        panels: bool,
    ) -> Result<Vec<(Self, Vec<ReportTrace>)>, AppError> {
        let mut query = reports::table
            .select(Report::as_select())
            .order_by(reports::name)
            .filter(reports::user_id.eq(&user_id))
            .into_boxed();
        if !panels {
            query = query.filter(reports::report_type.ne(ReportType::Panels));
        }
        let reports: Vec<Self> = query.load(conn)?;

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
        let mut seen = HashSet::new();
        let records: Vec<_> = match report_definition {
            ReportDefinition::Panels(_) => Vec::new(),
            // A column appears once, as it did when the practices were a set.
            ReportDefinition::Grid(grid) => grid_order
                .unwrap_or(&grid.practices)
                .iter()
                .filter(|p| seen.insert(**p))
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
    use super::super::panels::PanelsReport;
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
        match ApiReport::get_all(conn, user_id, false)
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
    fn grid_stores_a_column_once() {
        run(|conn| {
            let (u, [a, b, _, _]) = user_with_practices(conn);
            Report::create(conn, &u, "r", &grid(vec![b, a, b], Some(true)))?;
            assert_eq!(only_grid(conn, &u), (vec![b, a], Some(true)));
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
            match ApiReport::get_all(conn, &u, false)?.remove(0).definition {
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
            Report::update(conn, &u, &id, "r", &grid(vec![a, b, d], None))?;
            assert_eq!(only_grid(conn, &u), (vec![b, a, d], Some(false)));
            Ok(())
        });
    }

    #[test]
    fn grid_save_with_group_columns_takes_sent_order() {
        run(|conn| {
            let (u, [a, b, c, _]) = user_with_practices(conn);
            let id = Report::create(conn, &u, "r", &grid(vec![b, a, c], Some(false)))?;
            Report::update(conn, &u, &id, "r", &grid(vec![a, c], Some(true)))?;
            assert_eq!(only_grid(conn, &u), (vec![a, c], Some(true)));
            Ok(())
        });
    }

    /// Reports saved before trace order was stored: every trace has order_key 0.
    fn unordered_report(
        conn: &mut PgConnection,
        user_id: &Uuid,
        kind: &str,
        practices: &[Uuid],
    ) -> Uuid {
        #[derive(QueryableByName)]
        struct Id {
            #[diesel(sql_type = DieselUuid)]
            id: Uuid,
        }
        let report = sql_query(format!(
            "insert into reports (user_id, report_type, name) values ($1, '{kind}', $2) returning id"
        ))
        .bind::<DieselUuid, _>(user_id)
        .bind::<Text, _>(kind)
        .get_result::<Id>(conn)
        .unwrap()
        .id;
        for p in practices {
            sql_query("insert into report_traces (report_id, practice_id) values ($1, $2)")
                .bind::<DieselUuid, _>(report)
                .bind::<DieselUuid, _>(p)
                .execute(conn)
                .unwrap();
        }
        report
    }

    fn trace_order(conn: &mut PgConnection, report: &Uuid) -> Vec<Uuid> {
        report_traces::table
            .select(report_traces::practice_id)
            .filter(report_traces::report_id.eq(report))
            .order_by(report_traces::order_key)
            .load(conn)
            .unwrap()
    }

    #[test]
    fn backfill_orders_reports_saved_before_trace_order() {
        run(|conn| {
            let (u, [a, b, c, d]) = user_with_practices(conn);
            let graph = unordered_report(conn, &u, "graph", &[d, a, c]);
            let old_grid = unordered_report(conn, &u, "grid", &[c, a, b]);
            let new_grid = Report::create(conn, &u, "r", &grid(vec![c, a, b], Some(false)))?;

            sql_query(include_str!(
                "../../../../migrations/2026-10-28-000002-0000_backfill_trace_order/up.sql"
            ))
            .execute(conn)?;

            assert_eq!(trace_order(conn, &graph), vec![d, a, c]);
            assert_eq!(trace_order(conn, &old_grid), vec![a, b, c]);
            assert_eq!(trace_order(conn, &new_grid), vec![c, a, b]);
            Ok(())
        });
    }

    fn sleep_report(bedtime: Uuid, wake: Uuid) -> PanelsReport {
        use super::super::panels::*;
        PanelsReport {
            version: 1,
            template: Some(Template::Sleep(SleepTemplate {
                bedtime,
                wake,
                nap: None,
                min: Some(420),
                max: None,
            })),
            required: vec![Required {
                practice: bedtime,
                label: Label::Key("bedtime".into()),
            }],
            panels: vec![Panel::Chart(ChartPanel {
                title: Some(Label::Text("Sleep".into())),
                series: vec![Series {
                    label: None,
                    mark: Mark::Range,
                    source: Source::Range {
                        from: Ref {
                            practice: bedtime,
                            day_offset: -1,
                        },
                        to: Ref {
                            practice: wake,
                            day_offset: 0,
                        },
                    },
                    axis: Side::Left,
                    only_with: None,
                }],
                bar_layout: BarLayout::Grouped,
                format: Format::NoonClock,
                reversed: true,
                target: None,
                lines: vec![],
            })],
        }
    }

    #[test]
    fn panels_round_trips() {
        run(|conn| {
            let (u, [a, b, _, _]) = user_with_practices(conn);
            let sent = sleep_report(a, b);
            let id = Report::create(conn, &u, "r", &ReportDefinition::Panels(sent.clone()))?;

            match ApiReport::get_all(conn, &u, true)?.remove(0).definition {
                ReportDefinition::Panels(got) => assert_eq!(got, sent),
                _ => panic!("not panels"),
            }
            let (stored, traces) = Report::get_all(conn, &u, true)?.remove(0);
            assert!(traces.is_empty());
            assert_eq!(stored.id, id);
            assert_eq!(stored.bar_layout, None);
            Ok(())
        });
    }

    #[test]
    fn default_read_hides_panels() {
        run(|conn| {
            let (u, [a, b, _, _]) = user_with_practices(conn);
            Report::create(conn, &u, "g", &grid(vec![a], Some(true)))?;
            Report::create(conn, &u, "p", &ReportDefinition::Panels(sleep_report(a, b)))?;

            let hidden = ApiReport::get_all(conn, &u, false)?;
            assert_eq!(hidden.len(), 1);
            assert!(matches!(hidden[0].definition, ReportDefinition::Grid(_)));
            assert_eq!(ApiReport::get_all(conn, &u, true)?.len(), 2);
            Ok(())
        });
    }

    #[test]
    fn panels_rejects_unknown_field() {
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        let mut value = serde_json::to_value(sleep_report(a, b)).unwrap();
        assert!(serde_json::from_value::<PanelsReport>(value.clone()).is_ok());
        value["panels"][0]["series"][0]["extra"] = serde_json::json!(1);
        assert!(serde_json::from_value::<PanelsReport>(value).is_err());
    }

    fn panels(r: PanelsReport) -> ReportDefinition {
        ReportDefinition::Panels(r)
    }

    fn chart_with(f: impl FnOnce(&mut super::super::panels::ChartPanel)) -> PanelsReport {
        use super::super::panels::*;
        let mut r = sleep_report(Uuid::new_v4(), Uuid::new_v4());
        r.template = None;
        r.required = vec![];
        if let Panel::Chart(c) = &mut r.panels[0] {
            f(c);
        }
        r
    }

    fn practice_source(p: Uuid) -> super::super::panels::Source {
        super::super::panels::Source::Practice { practice: p }
    }

    fn unprocessable(r: Result<Uuid, AppError>) {
        assert!(matches!(r, Err(AppError::UnprocessableEntity(_))), "{r:?}");
    }

    /// An owner with a report built from their practices, and another user.
    fn other_user_report(
        conn: &mut PgConnection,
        make: impl FnOnce([Uuid; 4]) -> ReportDefinition,
    ) -> (Uuid, Uuid, Uuid, ReportDefinition) {
        let (owner, ids) = user_with_practices(conn);
        let (intruder, _) = user_with_practices(conn);
        let def = make(ids);
        let id = Report::create(conn, &owner, "mine", &def).unwrap();
        (owner, intruder, id, def)
    }

    type Make = fn([Uuid; 4]) -> ReportDefinition;
    const MAKERS: [Make; 2] = [
        |[a, _, _, _]| grid(vec![a], Some(true)),
        |[a, b, _, _]| panels(sleep_report(a, b)),
    ];

    #[test]
    fn update_of_another_users_report_is_not_found() {
        run(|conn| {
            for make in MAKERS {
                let (owner, intruder, id, def) = other_user_report(conn, make);
                let r = Report::update(conn, &intruder, &id, "hacked", &def);
                assert!(matches!(r, Err(AppError::NotFound)), "{r:?}");
                let stored = Report::get_all(conn, &owner, true)?.remove(0).0;
                assert_eq!(stored.name, "mine");
            }
            Ok(())
        });
    }

    #[test]
    fn delete_of_another_users_report_is_not_found() {
        run(|conn| {
            for make in MAKERS {
                let (owner, intruder, id, _) = other_user_report(conn, make);
                let r = Report::delete(conn, &intruder, &id);
                assert!(matches!(r, Err(AppError::NotFound)), "{r:?}");
                assert_eq!(Report::get_all(conn, &owner, true)?.len(), 1);
            }
            Ok(())
        });
    }

    #[test]
    fn put_cannot_change_type() {
        run(|conn| {
            let (u, [a, b, _, _]) = user_with_practices(conn);
            let g = Report::create(conn, &u, "g", &grid(vec![a], Some(true)))?;
            let r = Report::update(conn, &u, &g, "g", &panels(sleep_report(a, b)));
            assert!(matches!(r, Err(AppError::UnprocessableEntity(_))), "{r:?}");

            let p = Report::create(conn, &u, "p", &panels(sleep_report(a, b)))?;
            let graph = ReportDefinition::Graph(GraphReport {
                bar_layout: BarLayout::Grouped,
                traces: vec![],
            });
            let r = Report::update(conn, &u, &p, "p", &graph);
            assert!(matches!(r, Err(AppError::UnprocessableEntity(_))), "{r:?}");
            Ok(())
        });
    }

    #[test]
    fn rejects_foreign_practice() {
        use super::super::panels::*;
        run(|conn| {
            let (u, [a, b, _, _]) = user_with_practices(conn);
            let (_, [foreign, _, _, _]) = user_with_practices(conn);
            unprocessable(Report::create(
                conn,
                &u,
                "r",
                &panels(sleep_report(foreign, b)),
            ));
            unprocessable(Report::create(
                conn,
                &u,
                "r",
                &panels(sleep_report(a, foreign)),
            ));
            let calc = chart_with(|c| {
                c.series[0].source = Source::Calc {
                    terms: vec![Term {
                        sign: 1,
                        practice: foreign,
                        day_offset: 0,
                        optional: false,
                    }],
                }
            });
            unprocessable(Report::create(conn, &u, "r", &panels(calc)));
            Ok(())
        });
    }

    fn on_target_stats(of: Uuid, min: Option<i32>, max: Option<i32>) -> PanelsReport {
        use super::super::panels::*;
        let mut r = chart_with(|_| {});
        r.panels = vec![Panel::Stats {
            stats: vec![Stat {
                label: Label::Key("x".into()),
                value: StatValue::OnTarget {
                    of: practice_source(of),
                    min,
                    max,
                    scope: Scope {
                        today: true,
                        missing_zero: false,
                    },
                },
                under: None,
            }],
        }];
        r
    }

    fn target(of: Uuid, min: Option<i32>, max: Option<i32>) -> super::super::panels::Target {
        super::super::panels::Target {
            min,
            max,
            of: practice_source(of),
            lines: false,
            colour: false,
            label: None,
        }
    }

    fn sleep_with(a: Uuid, b: Uuid, min: Option<i32>, max: Option<i32>) -> PanelsReport {
        use super::super::panels::*;
        let mut r = sleep_report(a, b);
        if let Some(Template::Sleep(s)) = &mut r.template {
            s.min = min;
            s.max = max;
        }
        r
    }

    #[test]
    fn rejects_negative_target() {
        run(|conn| {
            let (u, [a, b, _, _]) = user_with_practices(conn);
            for (min, max) in [(Some(-1), None), (None, Some(-1))] {
                let t = target(a, min, max);
                unprocessable(Report::create(
                    conn,
                    &u,
                    "r",
                    &panels(chart_with(|c| c.target = Some(t))),
                ));
                unprocessable(Report::create(
                    conn,
                    &u,
                    "r",
                    &panels(on_target_stats(a, min, max)),
                ));
                unprocessable(Report::create(
                    conn,
                    &u,
                    "r",
                    &panels(sleep_with(a, b, min, max)),
                ));
            }
            Ok(())
        });
    }

    #[test]
    fn rejects_min_above_max() {
        run(|conn| {
            let (u, [a, b, _, _]) = user_with_practices(conn);
            let t = target(a, Some(10), Some(5));
            unprocessable(Report::create(
                conn,
                &u,
                "r",
                &panels(chart_with(|c| c.target = Some(t))),
            ));
            unprocessable(Report::create(
                conn,
                &u,
                "r",
                &panels(on_target_stats(a, Some(10), Some(5))),
            ));
            unprocessable(Report::create(
                conn,
                &u,
                "r",
                &panels(sleep_with(a, b, Some(600), Some(300))),
            ));
            Ok(())
        });
    }

    #[test]
    fn rejects_wrong_version() {
        run(|conn| {
            let (u, [a, b, _, _]) = user_with_practices(conn);
            let mut r = sleep_report(a, b);
            r.version = 2;
            unprocessable(Report::create(conn, &u, "r", &panels(r)));
            Ok(())
        });
    }

    #[test]
    fn rejects_too_many_panels() {
        run(|conn| {
            let (u, [a, b, _, _]) = user_with_practices(conn);
            let mut r = sleep_report(a, b);
            let p = r.panels[0].clone();
            r.panels = vec![p; 9];
            unprocessable(Report::create(conn, &u, "r", &panels(r)));
            Ok(())
        });
    }

    #[test]
    fn rejects_too_many_series() {
        run(|conn| {
            let (u, [a, _, _, _]) = user_with_practices(conn);
            let r = chart_with(|c| {
                let mut s = c.series[0].clone();
                s.source = practice_source(a);
                c.series = vec![s; 13];
            });
            unprocessable(Report::create(conn, &u, "r", &panels(r)));
            Ok(())
        });
    }

    #[test]
    fn rejects_oversized_definition() {
        use super::super::panels::Label;
        run(|conn| {
            let (u, [a, _, _, _]) = user_with_practices(conn);
            let r = chart_with(|c| {
                c.series[0].source = practice_source(a);
                c.title = Some(Label::Text("x".repeat(40_000)));
            });
            unprocessable(Report::create(conn, &u, "r", &panels(r)));
            Ok(())
        });
    }

    #[test]
    fn keeps_a_deleted_practice_already_in_the_report() {
        use super::super::panels::*;
        run(|conn| {
            let (u, [a, b, nap, _]) = user_with_practices(conn);
            let mut r = sleep_report(a, b);
            if let Some(Template::Sleep(s)) = &mut r.template {
                s.nap = Some(nap);
            }
            let id = Report::create(conn, &u, "r", &panels(r.clone()))?;

            diesel::delete(crate::schema::user_practices::table)
                .filter(crate::schema::user_practices::id.eq(nap))
                .execute(conn)?;

            if let Some(Template::Sleep(s)) = &mut r.template {
                s.max = Some(600);
            }
            Report::update(conn, &u, &id, "r", &panels(r.clone()))?;

            let (_, [foreign, _, _, _]) = user_with_practices(conn);
            if let Some(Template::Sleep(s)) = &mut r.template {
                s.bedtime = foreign;
            }
            let res = Report::update(conn, &u, &id, "r", &panels(r));
            assert!(
                matches!(res, Err(AppError::UnprocessableEntity(_))),
                "{res:?}"
            );
            Ok(())
        });
    }
}
