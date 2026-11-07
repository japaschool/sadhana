use std::collections::{HashMap, HashSet};

use chrono::NaiveDate;
use common::error::AppError;
use diesel::prelude::*;
use uuid::Uuid;

use super::dto;
use crate::app::report::{Report, ReportDefinition};
use crate::app::user_practices::UserPractice;
use crate::schema::{reports, share_link_reports, share_links, users};

type LinkRow = (
    Uuid,
    String,
    Option<NaiveDate>,
    Option<chrono::DateTime<chrono::Utc>>,
);

const MAX_NAME_LEN: usize = 100;

fn unprocessable(msg: &str) -> AppError {
    AppError::UnprocessableEntity(vec![msg.to_string()])
}

/// Checks the name and returns it trimmed.
fn validate_name(form: &dto::ShareLinkForm) -> Result<String, AppError> {
    let name = form.name.trim();
    let len = name.chars().count();
    if len == 0 || len > MAX_NAME_LEN {
        return Err(unprocessable(&format!(
            "name must be 1-{MAX_NAME_LEN} characters"
        )));
    }
    Ok(name.to_string())
}

/// The form's report ids without repeats; every one must be the user's own.
fn owned_report_ids(
    conn: &mut PgConnection,
    user_id: &Uuid,
    form: &dto::ShareLinkForm,
) -> Result<Vec<Uuid>, AppError> {
    let ids: Vec<Uuid> = form
        .report_ids
        .iter()
        .copied()
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    let owned: i64 = reports::table
        .filter(reports::user_id.eq(user_id))
        .filter(reports::id.eq_any(&ids))
        .count()
        .get_result(conn)?;
    if owned != ids.len() as i64 {
        return Err(unprocessable("unknown report"));
    }
    Ok(ids)
}

fn replace_reports(
    conn: &mut PgConnection,
    link_id: &Uuid,
    report_ids: &[Uuid],
) -> Result<(), AppError> {
    diesel::delete(share_link_reports::table.filter(share_link_reports::share_link_id.eq(link_id)))
        .execute(conn)?;
    let rows: Vec<_> = report_ids
        .iter()
        .map(|r| {
            (
                share_link_reports::share_link_id.eq(link_id),
                share_link_reports::report_id.eq(r),
            )
        })
        .collect();
    diesel::insert_into(share_link_reports::table)
        .values(&rows)
        .execute(conn)?;
    Ok(())
}

/// The user's links (newest first), the reports they could share and the legacy switch.
pub fn list(conn: &mut PgConnection, user_id: &Uuid) -> Result<dto::ShareLinksResponse, AppError> {
    let rows: Vec<LinkRow> = share_links::table
        .select((
            share_links::id,
            share_links::name,
            share_links::start_date,
            share_links::last_opened_at,
        ))
        .filter(share_links::user_id.eq(user_id))
        .order((share_links::created_at.desc(), share_links::id))
        .load(conn)?;

    let all_reports = Report::get_all(conn, user_id, 4, true)?;

    // Report order = name order (`get_all` sorts by name).
    let position: HashMap<Uuid, usize> = all_reports
        .iter()
        .enumerate()
        .map(|(i, r)| (r.id, i))
        .collect();
    let link_ids: Vec<Uuid> = rows.iter().map(|r| r.0).collect();
    let pairs: Vec<(Uuid, Uuid)> = share_link_reports::table
        .select((
            share_link_reports::share_link_id,
            share_link_reports::report_id,
        ))
        .filter(share_link_reports::share_link_id.eq_any(&link_ids))
        .load(conn)?;
    let mut by_link: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
    for (link, report) in pairs {
        by_link.entry(link).or_default().push(report);
    }

    let links = rows
        .into_iter()
        .map(|(id, name, start_date, last_opened_at)| {
            let mut report_ids = by_link.remove(&id).unwrap_or_default();
            report_ids.sort_by_key(|r| position.get(r).copied().unwrap_or(usize::MAX));
            dto::ShareLink {
                id,
                name,
                start_date,
                last_opened_at,
                report_ids,
            }
        })
        .collect();

    let practices = UserPractice::all_user_practices(conn, user_id)?;
    let reports = all_reports
        .into_iter()
        .map(|r| {
            let used = r.definition.practice_ids();
            dto::ShareableReport {
                id: r.id,
                name: r.name,
                kind: match r.definition {
                    ReportDefinition::Graph(_) => "Graph",
                    ReportDefinition::Grid(_) => "Grid",
                    ReportDefinition::Panels(_) => "Panels",
                },
                practices: practices
                    .iter()
                    .filter(|p| used.contains(&p.id))
                    .map(|p| p.practice.clone())
                    .collect(),
            }
        })
        .collect();

    let legacy_enabled = users::table
        .select(users::legacy_share_enabled)
        .filter(users::id.eq(user_id))
        .first(conn)?;

    Ok(dto::ShareLinksResponse {
        links,
        reports,
        legacy_enabled,
    })
}

pub fn create(
    conn: &mut PgConnection,
    user_id: &Uuid,
    form: &dto::ShareLinkForm,
) -> Result<Uuid, AppError> {
    let name = validate_name(form)?;
    conn.transaction(|conn| {
        let report_ids = owned_report_ids(conn, user_id, form)?;
        let id = diesel::insert_into(share_links::table)
            .values((
                share_links::user_id.eq(user_id),
                share_links::name.eq(&name),
                share_links::start_date.eq(form.start_date),
            ))
            .returning(share_links::id)
            .get_result(conn)?;
        replace_reports(conn, &id, &report_ids)?;
        Ok(id)
    })
}

pub fn update(
    conn: &mut PgConnection,
    user_id: &Uuid,
    id: &Uuid,
    form: &dto::ShareLinkForm,
) -> Result<(), AppError> {
    let name = validate_name(form)?;
    conn.transaction(|conn| {
        let report_ids = owned_report_ids(conn, user_id, form)?;
        let updated = diesel::update(
            share_links::table.filter(share_links::id.eq(id).and(share_links::user_id.eq(user_id))),
        )
        .set((
            share_links::name.eq(&name),
            share_links::start_date.eq(form.start_date),
            share_links::updated_at.eq(diesel::dsl::now),
        ))
        .execute(conn)?;
        if updated == 0 {
            return Err(AppError::NotFound);
        }
        replace_reports(conn, id, &report_ids)
    })
}

pub fn delete(conn: &mut PgConnection, user_id: &Uuid, id: &Uuid) -> Result<(), AppError> {
    let deleted = diesel::delete(
        share_links::table.filter(share_links::id.eq(id).and(share_links::user_id.eq(user_id))),
    )
    .execute(conn)?;
    if deleted == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub fn set_legacy(conn: &mut PgConnection, user_id: &Uuid, enabled: bool) -> Result<(), AppError> {
    diesel::update(users::table.filter(users::id.eq(user_id)))
        .set(users::legacy_share_enabled.eq(enabled))
        .execute(conn)?;
    Ok(())
}

/// What a public `/share/{id}` id opens.
#[derive(Debug, Clone, PartialEq)]
pub enum Share {
    /// A share link: only its reports and the practices they draw.
    Link {
        id: Uuid,
        user_id: Uuid,
        start_date: Option<NaiveDate>,
        report_ids: Vec<Uuid>,
    },
    /// The old whole-diary link (the user's own id), while the owner keeps it on.
    Legacy { user_id: Uuid },
}

impl Share {
    pub fn user_id(&self) -> Uuid {
        match self {
            Share::Link { user_id, .. } | Share::Legacy { user_id } => *user_id,
        }
    }
}

/// A link id, else the id of a user with legacy sharing on. Anything else is the same `NotFound`.
pub fn resolve(conn: &mut PgConnection, id: &Uuid) -> Result<Share, AppError> {
    let link: Option<(Uuid, Option<NaiveDate>)> = share_links::table
        .select((share_links::user_id, share_links::start_date))
        .filter(share_links::id.eq(id))
        .first(conn)
        .optional()?;
    if let Some((user_id, start_date)) = link {
        let report_ids = share_link_reports::table
            .select(share_link_reports::report_id)
            .filter(share_link_reports::share_link_id.eq(id))
            .load(conn)?;
        return Ok(Share::Link {
            id: *id,
            user_id,
            start_date,
            report_ids,
        });
    }
    let legacy: Option<bool> = users::table
        .select(users::legacy_share_enabled)
        .filter(users::id.eq(id))
        .first(conn)
        .optional()?;
    match legacy {
        Some(true) => Ok(Share::Legacy { user_id: *id }),
        _ => Err(AppError::NotFound),
    }
}

/// Records that a link was opened.
pub fn touch(conn: &mut PgConnection, link_id: &Uuid) -> Result<(), AppError> {
    diesel::update(share_links::table.filter(share_links::id.eq(link_id)))
        .set(share_links::last_opened_at.eq(diesel::dsl::now))
        .execute(conn)?;
    Ok(())
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::app::report::{
        db::Report as DbReport, GraphReport, GridReport, PracticeTrace, TraceType,
    };
    use crate::db_types::BarLayout;
    use crate::utils::db;
    use diesel::sql_query;
    use diesel::sql_types::{Text, Uuid as DieselUuid};

    pub(crate) fn new_user(conn: &mut PgConnection) -> Uuid {
        let user_id = Uuid::new_v4();
        sql_query("insert into users (id, email, hash, name) values ($1, $2, '', 'x')")
            .bind::<DieselUuid, _>(user_id)
            .bind::<Text, _>(format!("{user_id}@share-links.test"))
            .execute(conn)
            .unwrap();
        user_id
    }

    pub(crate) fn new_practice(
        conn: &mut PgConnection,
        user_id: Uuid,
        name: &str,
        order: i32,
    ) -> Uuid {
        let id = Uuid::new_v4();
        sql_query(
            "insert into user_practices (id, user_id, practice, data_type, is_active, order_key) \
             values ($1, $2, $3, 'int', true, $4)",
        )
        .bind::<DieselUuid, _>(id)
        .bind::<DieselUuid, _>(user_id)
        .bind::<Text, _>(name)
        .bind::<diesel::sql_types::Int4, _>(order)
        .execute(conn)
        .unwrap();
        id
    }

    pub(crate) fn grid(conn: &mut PgConnection, user_id: &Uuid, name: &str) -> Uuid {
        let p = new_practice(conn, *user_id, name, 0);
        let def = ReportDefinition::Grid(GridReport {
            practices: vec![p],
            group_columns: None,
        });
        DbReport::create(conn, user_id, name, &def).unwrap()
    }

    pub(crate) fn graph(
        conn: &mut PgConnection,
        user_id: &Uuid,
        name: &str,
        practices: &[Uuid],
    ) -> Uuid {
        let def = ReportDefinition::Graph(GraphReport {
            bar_layout: BarLayout::Grouped,
            traces: practices
                .iter()
                .map(|p| PracticeTrace {
                    label: None,
                    type_: TraceType::Bar,
                    practice: *p,
                    y_axis: None,
                    show_average: false,
                })
                .collect(),
        });
        DbReport::create(conn, user_id, name, &def).unwrap()
    }

    pub(crate) fn form(
        name: &str,
        start: Option<&str>,
        report_ids: Vec<Uuid>,
    ) -> dto::ShareLinkForm {
        dto::ShareLinkForm {
            name: name.into(),
            start_date: start.map(|s| s.parse::<NaiveDate>().unwrap()),
            report_ids,
        }
    }

    pub(crate) fn run(f: impl FnOnce(&mut PgConnection) -> Result<(), AppError>) {
        let mut conn = db::establish_connection().get().unwrap();
        conn.test_transaction::<_, AppError, _>(|c| f(c));
    }

    fn unprocessable<T: std::fmt::Debug>(r: Result<T, AppError>) {
        assert!(matches!(r, Err(AppError::UnprocessableEntity(_))), "{r:?}");
    }

    pub(crate) fn not_found<T: std::fmt::Debug>(r: Result<T, AppError>) {
        assert!(matches!(r, Err(AppError::NotFound)), "{r:?}");
    }

    #[test]
    fn create_then_list() {
        run(|conn| {
            let u = new_user(conn);
            let r1 = grid(conn, &u, "A");
            let r2 = grid(conn, &u, "B");
            let id = create(conn, &u, &form("  Mom ", Some("2026-02-01"), vec![r2, r1]))?;
            let links = list(conn, &u)?.links;
            assert_eq!(links.len(), 1);
            assert_eq!(links[0].id, id);
            assert_eq!(links[0].name, "Mom");
            assert_eq!(links[0].start_date, Some("2026-02-01".parse().unwrap()));
            assert_eq!(links[0].last_opened_at, None);
            assert_eq!(links[0].report_ids, vec![r1, r2]);
            let stranger = new_user(conn);
            assert!(list(conn, &stranger)?.links.is_empty());
            Ok(())
        });
    }

    #[test]
    fn name_is_trimmed_and_limited() {
        run(|conn| {
            let u = new_user(conn);
            for bad in ["", "   ", &"x".repeat(101)] {
                unprocessable(create(conn, &u, &form(bad, None, vec![])));
            }
            assert!(create(conn, &u, &form(&"x".repeat(100), None, vec![])).is_ok());
            assert!(create(conn, &u, &form(&"я".repeat(100), None, vec![])).is_ok());
            Ok(())
        });
    }

    #[test]
    fn foreign_report_is_rejected() {
        run(|conn| {
            let u = new_user(conn);
            let other = new_user(conn);
            let mine = grid(conn, &u, "mine");
            let theirs = grid(conn, &other, "theirs");
            unprocessable(create(conn, &u, &form("x", None, vec![mine, theirs])));
            assert!(list(conn, &u)?.links.is_empty());

            let id = create(conn, &u, &form("keep", None, vec![mine]))?;
            unprocessable(update(conn, &u, &id, &form("changed", None, vec![theirs])));
            let links = list(conn, &u)?.links;
            assert_eq!(links[0].name, "keep");
            assert_eq!(links[0].report_ids, vec![mine]);
            Ok(())
        });
    }

    #[test]
    fn other_users_link_is_not_found() {
        run(|conn| {
            let u = new_user(conn);
            let other = new_user(conn);
            let id = create(conn, &u, &form("x", None, vec![]))?;
            not_found(update(conn, &other, &id, &form("y", None, vec![])));
            not_found(delete(conn, &other, &id));
            assert_eq!(list(conn, &u)?.links[0].name, "x");
            Ok(())
        });
    }

    #[test]
    fn update_replaces_report_set() {
        run(|conn| {
            let u = new_user(conn);
            let r1 = grid(conn, &u, "A");
            let r2 = grid(conn, &u, "B");
            let id = create(conn, &u, &form("x", None, vec![r1, r2]))?;
            update(conn, &u, &id, &form("z", Some("2026-03-01"), vec![r2, r2]))?;
            let link = list(conn, &u)?.links.remove(0);
            assert_eq!(link.name, "z");
            assert_eq!(link.start_date, Some("2026-03-01".parse().unwrap()));
            assert_eq!(link.report_ids, vec![r2]);
            Ok(())
        });
    }

    #[test]
    fn deleting_report_drops_it_from_links() {
        run(|conn| {
            let u = new_user(conn);
            let r1 = grid(conn, &u, "A");
            let r2 = grid(conn, &u, "B");
            create(conn, &u, &form("x", None, vec![r1, r2]))?;
            DbReport::delete(conn, &u, &r1)?;
            assert_eq!(list(conn, &u)?.links[0].report_ids, vec![r2]);
            Ok(())
        });
    }

    #[test]
    fn deleting_user_deletes_links() {
        run(|conn| {
            let u = new_user(conn);
            let id = create(conn, &u, &form("x", None, vec![]))?;
            sql_query("delete from users where id = $1")
                .bind::<DieselUuid, _>(u)
                .execute(conn)?;
            let n: i64 = share_links::table
                .filter(share_links::id.eq(id))
                .count()
                .get_result(conn)?;
            assert_eq!(n, 0);
            Ok(())
        });
    }

    #[test]
    fn list_reports_carry_kind_and_practice_names() {
        run(|conn| {
            let u = new_user(conn);
            let second = new_practice(conn, u, "Second", 2);
            let first = new_practice(conn, u, "First", 1);
            new_practice(conn, u, "Unused", 3);
            let graph = ReportDefinition::Graph(GraphReport {
                bar_layout: BarLayout::Grouped,
                traces: [second, first]
                    .map(|p| PracticeTrace {
                        label: None,
                        type_: TraceType::Bar,
                        practice: p,
                        y_axis: None,
                        show_average: false,
                    })
                    .into(),
            });
            let id = DbReport::create(conn, &u, "G", &graph)?;
            let reports = list(conn, &u)?.reports;
            assert_eq!(
                reports,
                vec![dto::ShareableReport {
                    id,
                    name: "G".into(),
                    kind: "Graph",
                    practices: vec!["First".into(), "Second".into()],
                }]
            );
            Ok(())
        });
    }

    #[test]
    fn legacy_flag_round_trips() {
        run(|conn| {
            let u = new_user(conn);
            // New accounts start with the old public link on, for now.
            assert!(list(conn, &u)?.legacy_enabled);
            set_legacy(conn, &u, false)?;
            assert!(!list(conn, &u)?.legacy_enabled);
            set_legacy(conn, &u, true)?;
            assert!(list(conn, &u)?.legacy_enabled);
            Ok(())
        });
    }

    #[test]
    fn resolve_link_and_legacy() {
        run(|conn| {
            let u = new_user(conn);
            let r = grid(conn, &u, "A");
            let id = create(conn, &u, &form("x", Some("2026-02-01"), vec![r]))?;
            assert_eq!(
                resolve(conn, &id)?,
                Share::Link {
                    id,
                    user_id: u,
                    start_date: Some("2026-02-01".parse().unwrap()),
                    report_ids: vec![r],
                }
            );

            set_legacy(conn, &u, true)?;
            assert_eq!(resolve(conn, &u)?, Share::Legacy { user_id: u });
            set_legacy(conn, &u, false)?;
            not_found(resolve(conn, &u));

            not_found(resolve(conn, &Uuid::new_v4()));

            delete(conn, &u, &id)?;
            not_found(resolve(conn, &id));
            Ok(())
        });
    }

    #[test]
    fn touch_sets_last_opened() {
        run(|conn| {
            let u = new_user(conn);
            let id = create(conn, &u, &form("x", None, vec![]))?;
            assert_eq!(list(conn, &u)?.links[0].last_opened_at, None);
            touch(conn, &id)?;
            assert!(list(conn, &u)?.links[0].last_opened_at.is_some());
            Ok(())
        });
    }
}
