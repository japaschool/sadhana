use common::error::AppError;
use diesel::prelude::*;
use uuid::Uuid;

use super::dto;
use crate::schema::marked_periods;

const MAX_NAME_LEN: usize = 100;

/// Checks the form and returns the trimmed name.
fn validate(form: &dto::MarkedPeriodForm) -> Result<String, AppError> {
    let name = form.name.trim();
    let len = name.chars().count();
    if len == 0 || len > MAX_NAME_LEN {
        return Err(AppError::UnprocessableEntity(vec![format!(
            "name must be 1-{MAX_NAME_LEN} characters"
        )]));
    }
    if form.end_date.is_some_and(|end| end < form.start_date) {
        return Err(AppError::UnprocessableEntity(vec![
            "end_date must not be before start_date".to_string(),
        ]));
    }
    Ok(name.to_string())
}

/// The user's periods, newest start first.
pub fn list(conn: &mut PgConnection, user_id: &Uuid) -> Result<Vec<dto::MarkedPeriod>, AppError> {
    let rows: Vec<(
        Uuid,
        String,
        chrono::NaiveDate,
        Option<chrono::NaiveDate>,
        bool,
    )> = marked_periods::table
        .select((
            marked_periods::id,
            marked_periods::name,
            marked_periods::start_date,
            marked_periods::end_date,
            marked_periods::exclude_from_usual,
        ))
        .filter(marked_periods::user_id.eq(user_id))
        .order((
            marked_periods::start_date.desc(),
            marked_periods::created_at.desc(),
        ))
        .load(conn)?;
    Ok(rows
        .into_iter()
        .map(
            |(id, name, start_date, end_date, exclude_from_usual)| dto::MarkedPeriod {
                id,
                name,
                start_date,
                end_date,
                exclude_from_usual,
            },
        )
        .collect())
}

pub fn create(
    conn: &mut PgConnection,
    user_id: &Uuid,
    form: &dto::MarkedPeriodForm,
) -> Result<Uuid, AppError> {
    let name = validate(form)?;
    Ok(diesel::insert_into(marked_periods::table)
        .values((
            marked_periods::user_id.eq(user_id),
            marked_periods::name.eq(&name),
            marked_periods::start_date.eq(form.start_date),
            marked_periods::end_date.eq(form.end_date),
            marked_periods::exclude_from_usual.eq(form.exclude_from_usual),
        ))
        .returning(marked_periods::id)
        .get_result(conn)?)
}

pub fn update(
    conn: &mut PgConnection,
    user_id: &Uuid,
    id: &Uuid,
    form: &dto::MarkedPeriodForm,
) -> Result<(), AppError> {
    let name = validate(form)?;
    let updated = diesel::update(
        marked_periods::table.filter(
            marked_periods::id
                .eq(id)
                .and(marked_periods::user_id.eq(user_id)),
        ),
    )
    .set((
        marked_periods::name.eq(&name),
        marked_periods::start_date.eq(form.start_date),
        marked_periods::end_date.eq(form.end_date),
        marked_periods::exclude_from_usual.eq(form.exclude_from_usual),
    ))
    .execute(conn)?;
    if updated == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub fn delete(conn: &mut PgConnection, user_id: &Uuid, id: &Uuid) -> Result<(), AppError> {
    let deleted = diesel::delete(
        marked_periods::table.filter(
            marked_periods::id
                .eq(id)
                .and(marked_periods::user_id.eq(user_id)),
        ),
    )
    .execute(conn)?;
    if deleted == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::db;
    use chrono::NaiveDate;
    use diesel::sql_query;
    use diesel::sql_types::{Text, Uuid as DieselUuid};

    fn new_user(conn: &mut PgConnection) -> Uuid {
        let user_id = Uuid::new_v4();
        sql_query("insert into users (id, email, hash, name) values ($1, $2, '', 'x')")
            .bind::<DieselUuid, _>(user_id)
            .bind::<Text, _>(format!("{user_id}@periods.test"))
            .execute(conn)
            .unwrap();
        user_id
    }

    fn d(s: &str) -> NaiveDate {
        s.parse().unwrap()
    }

    fn form(name: &str, start: &str, end: Option<&str>, exclude: bool) -> dto::MarkedPeriodForm {
        dto::MarkedPeriodForm {
            name: name.into(),
            start_date: d(start),
            end_date: end.map(d),
            exclude_from_usual: exclude,
        }
    }

    fn run(f: impl FnOnce(&mut PgConnection) -> Result<(), AppError>) {
        let mut conn = db::establish_connection().get().unwrap();
        conn.test_transaction::<_, AppError, _>(|c| f(c));
    }

    fn unprocessable<T: std::fmt::Debug>(r: Result<T, AppError>) {
        assert!(matches!(r, Err(AppError::UnprocessableEntity(_))), "{r:?}");
    }

    #[test]
    fn create_then_list_returns_period() {
        run(|conn| {
            let u = new_user(conn);
            let older = create(
                conn,
                &u,
                &form("Older", "2026-01-01", Some("2026-01-10"), true),
            )?;
            let newer = create(conn, &u, &form("Newer", "2026-03-01", None, false))?;
            assert_eq!(
                list(conn, &u)?,
                vec![
                    dto::MarkedPeriod {
                        id: newer,
                        name: "Newer".into(),
                        start_date: d("2026-03-01"),
                        end_date: None,
                        exclude_from_usual: false,
                    },
                    dto::MarkedPeriod {
                        id: older,
                        name: "Older".into(),
                        start_date: d("2026-01-01"),
                        end_date: Some(d("2026-01-10")),
                        exclude_from_usual: true,
                    },
                ]
            );
            let stranger = new_user(conn);
            assert!(list(conn, &stranger)?.is_empty());
            Ok(())
        });
    }

    #[test]
    fn name_is_trimmed_and_limited() {
        run(|conn| {
            let u = new_user(conn);
            create(conn, &u, &form("  Retreat ", "2026-01-01", None, true))?;
            assert_eq!(list(conn, &u)?[0].name, "Retreat");
            for bad in ["", "   ", &"x".repeat(101)] {
                unprocessable(create(conn, &u, &form(bad, "2026-01-01", None, true)));
            }
            assert!(create(conn, &u, &form(&"x".repeat(100), "2026-01-01", None, true)).is_ok());
            assert!(create(conn, &u, &form(&"я".repeat(100), "2026-01-01", None, true)).is_ok());
            Ok(())
        });
    }

    #[test]
    fn end_before_start_is_rejected() {
        run(|conn| {
            let u = new_user(conn);
            unprocessable(create(
                conn,
                &u,
                &form("A", "2026-01-10", Some("2026-01-09"), true),
            ));
            let id = create(conn, &u, &form("A", "2026-01-10", Some("2026-01-10"), true))?;
            unprocessable(update(
                conn,
                &u,
                &id,
                &form("A", "2026-01-10", Some("2026-01-09"), true),
            ));
            assert_eq!(list(conn, &u)?[0].end_date, Some(d("2026-01-10")));
            Ok(())
        });
    }

    #[test]
    fn other_users_period_is_not_found() {
        run(|conn| {
            let owner = new_user(conn);
            let other = new_user(conn);
            let id = create(conn, &owner, &form("Mine", "2026-01-01", None, true))?;
            assert_eq!(
                update(
                    conn,
                    &other,
                    &id,
                    &form("Hacked", "2026-02-01", None, false)
                ),
                Err(AppError::NotFound)
            );
            assert_eq!(delete(conn, &other, &id), Err(AppError::NotFound));
            assert_eq!(
                delete(conn, &owner, &Uuid::new_v4()),
                Err(AppError::NotFound)
            );
            let rows = list(conn, &owner)?;
            assert_eq!(rows.len(), 1);
            assert_eq!(rows[0].name, "Mine");
            assert_eq!(rows[0].start_date, d("2026-01-01"));
            update(conn, &owner, &id, &form("Mine2", "2026-01-02", None, false))?;
            assert_eq!(list(conn, &owner)?[0].name, "Mine2");
            delete(conn, &owner, &id)?;
            assert!(list(conn, &owner)?.is_empty());
            Ok(())
        });
    }

    #[test]
    fn deleting_user_deletes_periods() {
        run(|conn| {
            let u = new_user(conn);
            create(conn, &u, &form("A", "2026-01-01", None, true))?;
            sql_query("delete from users where id = $1")
                .bind::<DieselUuid, _>(u)
                .execute(conn)?;
            let n: i64 = marked_periods::table
                .filter(marked_periods::user_id.eq(u))
                .count()
                .get_result(conn)?;
            assert_eq!(n, 0);
            Ok(())
        });
    }
}
