pub mod version;

use std::collections::HashSet;

use actix_web::{web, HttpResponse};
use chrono::NaiveDate;
use common::{error::AppError, ReportDuration};
use diesel::PgConnection;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::middleware::state::AppState;

use super::{
    diary::{model::ReportEntry, response::ReportResponse},
    report::{GetAllReportsResponse, Report, ReportsQuery},
    share_links::service::{self as links, Share},
    user::{model::User, response::AuthUser},
    user_practices::{AllUserPracticesResponse, UserPractice},
};

#[derive(Deserialize, Debug)]
pub struct ReportDataQueryParams {
    duration: ReportDuration,
    end_date: NaiveDate,
}

/// A share link id, or (legacy) the owner's user id.
type ShareIdSlug = Uuid;

#[derive(Serialize, Debug)]
pub struct SharedUserResponse {
    pub user: AuthUser,
    /// "link" or "legacy".
    pub kind: &'static str,
    pub start_date: Option<NaiveDate>,
}

/// The owner as a viewer sees them: never the email.
pub fn shared_user(conn: &mut PgConnection, share: &Share) -> Result<SharedUserResponse, AppError> {
    let user = User::find(conn, &share.user_id())?;
    let (kind, start_date) = match share {
        Share::Link { start_date, .. } => ("link", *start_date),
        Share::Legacy { .. } => ("legacy", None),
    };
    Ok(SharedUserResponse {
        user: AuthUser {
            id: user.id,
            email: String::new(),
            token: String::new(),
            name: user.name,
            created: None,
        },
        kind,
        start_date,
    })
}

/// The share's reports the client can draw (`level`, `months`).
pub fn shared_reports(
    conn: &mut PgConnection,
    share: &Share,
    level: u8,
    months: bool,
) -> Result<Vec<Report>, AppError> {
    let reports = Report::get_all(conn, &share.user_id(), level, months)?;
    Ok(match share {
        Share::Link { report_ids, .. } => reports
            .into_iter()
            .filter(|r| report_ids.contains(&r.id))
            .collect(),
        Share::Legacy { .. } => reports,
    })
}

/// A link's practices: those its reports draw, whatever the client can display.
pub fn shared_practices(
    conn: &mut PgConnection,
    share: &Share,
) -> Result<Vec<UserPractice>, AppError> {
    let all = UserPractice::all_user_practices(conn, &share.user_id())?;
    let Share::Link { report_ids, .. } = share else {
        return Ok(all);
    };
    let used: HashSet<Uuid> = Report::get_all(conn, &share.user_id(), 4, true)?
        .into_iter()
        .filter(|r| report_ids.contains(&r.id))
        .flat_map(|r| r.definition.practice_ids())
        .collect();
    Ok(all.into_iter().filter(|p| used.contains(&p.id)).collect())
}

/// Diary values, for a link only those of its practices.
pub fn shared_entries(
    conn: &mut PgConnection,
    share: &Share,
    end_date: &NaiveDate,
    duration: &ReportDuration,
) -> Result<Vec<ReportEntry>, AppError> {
    let entries = ReportEntry::get_report_data(conn, &share.user_id(), end_date, duration)?;
    if let Share::Legacy { .. } = share {
        return Ok(entries);
    }
    let names: HashSet<String> = shared_practices(conn, share)?
        .into_iter()
        .map(|p| p.practice)
        .collect();
    Ok(entries
        .into_iter()
        .filter(|e| names.contains(&e.practice))
        .collect())
}

/// Get the shared diary's owner
pub async fn get_shared_user(
    state: web::Data<AppState>,
    path: web::Path<ShareIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let id = path.into_inner();

    let res = web::block(move || {
        let share = links::resolve(&mut conn, &id)?;
        if let Share::Link { id, .. } = &share {
            // Best-effort: a failed last-opened stamp must not break the page.
            if let Err(e) = links::touch(&mut conn, id) {
                log::warn!("Failed to record share link open: {e}");
            }
        }
        shared_user(&mut conn, &share)
    })
    .await??;

    Ok(HttpResponse::Ok().json(res))
}

/// Get shared report data
pub async fn get_shared_report_data(
    state: web::Data<AppState>,
    path: web::Path<ShareIdSlug>,
    params: web::Query<ReportDataQueryParams>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let id = path.into_inner();

    let data = web::block(move || {
        let share = links::resolve(&mut conn, &id)?;
        shared_entries(&mut conn, &share, &params.end_date, &params.duration)
    })
    .await??;

    Ok(HttpResponse::Ok().json(ReportResponse::from(data)))
}

/// Get shared practices
pub async fn get_shared_report_practices(
    state: web::Data<AppState>,
    path: web::Path<ShareIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let id = path.into_inner();

    let data = web::block(move || {
        let share = links::resolve(&mut conn, &id)?;
        shared_practices(&mut conn, &share)
    })
    .await??;

    Ok(HttpResponse::Ok().json(AllUserPracticesResponse::from(data)))
}

/// Get shared reports
pub async fn get_shared_reports(
    state: web::Data<AppState>,
    path: web::Path<ShareIdSlug>,
    query: web::Query<ReportsQuery>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let id = path.into_inner();

    let data = web::block(move || {
        let share = links::resolve(&mut conn, &id)?;
        shared_reports(&mut conn, &share, query.panels, query.months)
    })
    .await??;

    Ok(HttpResponse::Ok().json(GetAllReportsResponse { reports: data }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app::report::db::{
        tests::{gaps_report, panels},
        Report as DbReport,
    };
    use crate::app::share_links::service::{
        create, resolve, set_legacy,
        tests::{form, graph, grid, new_practice, new_user, run},
    };
    use diesel::sql_types::{Date, Jsonb, Uuid as DieselUuid};
    use diesel::{sql_query, RunQueryDsl};

    fn report_ids(reports: Vec<Report>) -> Vec<Uuid> {
        reports.into_iter().map(|r| r.id).collect()
    }

    fn practice_names(practices: Vec<UserPractice>) -> Vec<String> {
        practices.into_iter().map(|p| p.practice).collect()
    }

    fn log(conn: &mut PgConnection, user_id: Uuid, practice: Uuid, date: NaiveDate) {
        sql_query(
            "insert into diary (cob_date, user_id, practice_id, value) values ($1, $2, $3, $4)",
        )
        .bind::<Date, _>(date)
        .bind::<DieselUuid, _>(user_id)
        .bind::<DieselUuid, _>(practice)
        .bind::<Jsonb, _>(serde_json::json!({ "Int": 1 }))
        .execute(conn)
        .unwrap();
    }

    #[test]
    fn link_reports_only_listed() {
        run(|conn| {
            let u = new_user(conn);
            let a = grid(conn, &u, "A");
            grid(conn, &u, "B");
            let link = create(conn, &u, &form("x", None, vec![a]))?;
            let share = resolve(conn, &link)?;
            assert_eq!(report_ids(shared_reports(conn, &share, 4, true)?), vec![a]);

            let event = new_practice(conn, u, "Event", 10);
            let row = new_practice(conn, u, "Row", 11);
            let drawn = new_practice(conn, u, "Drawn", 12);
            let gaps = DbReport::create(conn, &u, "Gaps", &panels(gaps_report(event, vec![row])))?;
            let g = graph(conn, &u, "Graph", &[drawn]);
            let link = create(conn, &u, &form("y", None, vec![gaps, g]))?;
            let share = resolve(conn, &link)?;
            assert_eq!(report_ids(shared_reports(conn, &share, 1, true)?), vec![g]);
            let names = practice_names(shared_practices(conn, &share)?);
            for p in ["Event", "Row", "Drawn"] {
                assert!(names.contains(&p.to_string()), "{p} missing from {names:?}");
            }
            assert!(!names.contains(&"A".to_string()), "{names:?}");
            Ok(())
        });
    }

    #[test]
    fn link_practices_and_entries_only_for_link_practices() {
        run(|conn| {
            let u = new_user(conn);
            let sleep = new_practice(conn, u, "Sleep", 1);
            let japa = new_practice(conn, u, "Japa", 2);
            let celibacy = new_practice(conn, u, "Celibacy", 3);
            let old = new_practice(conn, u, "Old", 4);
            sql_query("update user_practices set is_active = false where id = $1")
                .bind::<DieselUuid, _>(old)
                .execute(conn)?;
            let r = graph(conn, &u, "R", &[sleep, japa, old]);
            let link = create(conn, &u, &form("x", None, vec![r]))?;
            let share = resolve(conn, &link)?;

            assert_eq!(
                practice_names(shared_practices(conn, &share)?),
                ["Sleep", "Japa", "Old"]
            );

            let day: NaiveDate = "2026-11-01".parse().unwrap();
            for p in [sleep, japa, celibacy, old] {
                log(conn, u, p, day);
            }
            let entries = shared_entries(conn, &share, &day, &ReportDuration::Week)?;
            assert!(entries
                .iter()
                .any(|e| e.practice == "Sleep" && e.value.is_some()));
            assert!(
                entries.iter().all(|e| e.practice != "Celibacy"),
                "{entries:?}"
            );

            set_legacy(conn, &u, true)?;
            let legacy = resolve(conn, &u)?;
            assert_eq!(practice_names(shared_practices(conn, &legacy)?).len(), 4);
            let entries = shared_entries(conn, &legacy, &day, &ReportDuration::Week)?;
            assert!(entries.iter().any(|e| e.practice == "Celibacy"));
            Ok(())
        });
    }

    #[test]
    fn user_endpoint_blanks_email() {
        run(|conn| {
            let u = new_user(conn);
            let link = create(conn, &u, &form("x", Some("2026-02-01"), vec![]))?;
            let share = resolve(conn, &link)?;
            let got = serde_json::to_value(shared_user(conn, &share)?).unwrap();
            assert_eq!(
                got,
                serde_json::json!({
                    "user": { "id": u, "email": "", "token": "", "name": "x" },
                    "kind": "link",
                    "start_date": "2026-02-01",
                })
            );

            set_legacy(conn, &u, true)?;
            let share = resolve(conn, &u)?;
            let got = serde_json::to_value(shared_user(conn, &share)?).unwrap();
            assert_eq!(
                got,
                serde_json::json!({
                    "user": { "id": u, "email": "", "token": "", "name": "x" },
                    "kind": "legacy",
                    "start_date": null,
                })
            );
            Ok(())
        });
    }
}
