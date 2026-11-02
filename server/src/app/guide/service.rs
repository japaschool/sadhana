use common::error::AppError;
use diesel::prelude::*;
use uuid::Uuid;

use super::domain::StartedFrom;
use super::dto;
use crate::schema::guide_runs;

const MAX_STEP_LEN: usize = 32;

pub fn start(
    conn: &mut PgConnection,
    user_id: &Uuid,
    started_from: StartedFrom,
) -> Result<Uuid, AppError> {
    Ok(diesel::insert_into(guide_runs::table)
        .values((
            guide_runs::user_id.eq(user_id),
            guide_runs::started_from.eq(started_from.as_str()),
        ))
        .returning(guide_runs::id)
        .get_result(conn)?)
}

/// Sets only the fields given. NotFound unless the run is the user's.
pub fn update(
    conn: &mut PgConnection,
    user_id: &Uuid,
    id: &Uuid,
    form: &dto::UpdateForm,
) -> Result<(), AppError> {
    if form
        .last_step
        .as_ref()
        .is_some_and(|s| s.chars().count() > MAX_STEP_LEN)
    {
        return Err(AppError::UnprocessableEntity(vec![format!(
            "last_step must be at most {MAX_STEP_LEN} characters"
        )]));
    }
    let n = diesel::update(
        guide_runs::table.filter(guide_runs::id.eq(id).and(guide_runs::user_id.eq(user_id))),
    )
    .set((
        // Always sets something, as diesel rejects an empty changeset.
        guide_runs::updated_at.eq(diesel::dsl::now),
        form.last_step.as_ref().map(|v| guide_runs::last_step.eq(v)),
        form.outcome.map(|v| guide_runs::outcome.eq(v.as_str())),
        form.has_reader.map(|v| guide_runs::has_reader.eq(v)),
    ))
    .execute(conn)?;
    if n == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app::guide::domain::Outcome;
    use crate::schema::guide_runs;
    use crate::utils::db;
    use diesel::sql_query;
    use diesel::sql_types::{Text, Uuid as DieselUuid};

    fn new_user(conn: &mut PgConnection) -> Uuid {
        let user_id = Uuid::new_v4();
        sql_query("insert into users (id, email, hash, name) values ($1, $2, '', 'x')")
            .bind::<DieselUuid, _>(user_id)
            .bind::<Text, _>(format!("{user_id}@guide.test"))
            .execute(conn)
            .unwrap();
        user_id
    }

    type Row = (Option<String>, Option<String>, Option<bool>);

    fn row(conn: &mut PgConnection, id: &Uuid) -> Row {
        guide_runs::table
            .select((
                guide_runs::last_step,
                guide_runs::outcome,
                guide_runs::has_reader,
            ))
            .filter(guide_runs::id.eq(id))
            .first(conn)
            .unwrap()
    }

    fn run(f: impl FnOnce(&mut PgConnection) -> Result<(), AppError>) {
        let mut conn = db::establish_connection().get().unwrap();
        conn.test_transaction::<_, AppError, _>(|c| f(c));
    }

    fn form(step: Option<&str>, outcome: Option<Outcome>, reader: Option<bool>) -> dto::UpdateForm {
        dto::UpdateForm {
            last_step: step.map(Into::into),
            outcome,
            has_reader: reader,
        }
    }

    #[test]
    fn guide_other_users_run_is_not_found_and_unchanged() {
        run(|conn| {
            let (owner, other) = (new_user(conn), new_user(conn));
            let id = start(conn, &owner, StartedFrom::Signup)?;
            update(conn, &owner, &id, &form(Some("setup"), None, None))?;
            let r = update(
                conn,
                &other,
                &id,
                &form(Some("x"), Some(Outcome::Left), Some(true)),
            );
            assert!(matches!(r, Err(AppError::NotFound)), "{r:?}");
            assert_eq!(row(conn, &id), (Some("setup".into()), None, None));
            Ok(())
        });
    }

    #[test]
    fn guide_deleting_user_deletes_run() {
        run(|conn| {
            let user = new_user(conn);
            let id = start(conn, &user, StartedFrom::AddPractice)?;
            sql_query("delete from users where id = $1")
                .bind::<DieselUuid, _>(user)
                .execute(conn)?;
            let n: i64 = guide_runs::table
                .filter(guide_runs::id.eq(id))
                .count()
                .get_result(conn)?;
            assert_eq!(n, 0);
            Ok(())
        });
    }

    #[test]
    fn guide_update_keeps_unspecified_fields() {
        run(|conn| {
            let user = new_user(conn);
            let id = start(conn, &user, StartedFrom::Signup)?;
            update(conn, &user, &id, &form(Some("reader"), None, Some(false)))?;
            update(conn, &user, &id, &form(None, Some(Outcome::Finished), None))?;
            assert_eq!(
                row(conn, &id),
                (Some("reader".into()), Some("finished".into()), Some(false))
            );
            update(conn, &user, &id, &form(None, None, None))?;
            assert_eq!(
                row(conn, &id),
                (Some("reader".into()), Some("finished".into()), Some(false))
            );
            Ok(())
        });
    }

    #[test]
    fn guide_overlong_last_step_is_unprocessable() {
        run(|conn| {
            let user = new_user(conn);
            let id = start(conn, &user, StartedFrom::Signup)?;
            let r = update(conn, &user, &id, &form(Some(&"a".repeat(33)), None, None));
            assert!(matches!(r, Err(AppError::UnprocessableEntity(_))), "{r:?}");
            assert_eq!(row(conn, &id), (None, None, None));
            update(conn, &user, &id, &form(Some(&"a".repeat(32)), None, None))?;
            Ok(())
        });
    }
}
