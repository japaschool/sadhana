use common::error::AppError;
use diesel::prelude::*;
use serde_json::Value;
use uuid::Uuid;

use crate::schema::insight_prefs;

/// The user's saved prefs, or `None` if they never saved any.
pub fn get(conn: &mut PgConnection, user_id: &Uuid) -> Result<Option<Value>, AppError> {
    Ok(insight_prefs::table
        .select(insight_prefs::prefs)
        .filter(insight_prefs::user_id.eq(user_id))
        .first(conn)
        .optional()?)
}

/// Replaces the user's prefs. The object is stored as is; the client owns its shape.
pub fn save(conn: &mut PgConnection, user_id: &Uuid, prefs: &Value) -> Result<(), AppError> {
    if !prefs.is_object() {
        return Err(AppError::UnprocessableEntity(vec![
            "prefs must be an object".to_string(),
        ]));
    }
    diesel::insert_into(insight_prefs::table)
        .values((
            insight_prefs::user_id.eq(user_id),
            insight_prefs::prefs.eq(prefs),
        ))
        .on_conflict(insight_prefs::user_id)
        .do_update()
        .set(insight_prefs::prefs.eq(prefs))
        .execute(conn)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::db;
    use diesel::sql_query;
    use diesel::sql_types::{Text, Uuid as DieselUuid};
    use serde_json::json;

    fn new_user(conn: &mut PgConnection) -> Uuid {
        let user_id = Uuid::new_v4();
        sql_query("insert into users (id, email, hash, name) values ($1, $2, '', 'x')")
            .bind::<DieselUuid, _>(user_id)
            .bind::<Text, _>(format!("{user_id}@insight-prefs.test"))
            .execute(conn)
            .unwrap();
        user_id
    }

    fn run(f: impl FnOnce(&mut PgConnection) -> Result<(), AppError>) {
        let mut conn = db::establish_connection().get().unwrap();
        conn.test_transaction::<_, AppError, _>(|c| f(c));
    }

    fn unprocessable<T: std::fmt::Debug>(r: Result<T, AppError>) {
        assert!(matches!(r, Err(AppError::UnprocessableEntity(_))), "{r:?}");
    }

    #[test]
    fn get_without_saved_prefs_is_none() {
        run(|c| {
            let u = new_user(c);
            assert_eq!(get(c, &u)?, None);
            Ok(())
        })
    }

    #[test]
    fn save_upserts_whole_object() {
        run(|c| {
            let u = new_user(c);
            save(c, &u, &json!({"streaks": true}))?;
            save(c, &u, &json!({"suggest": false}))?;
            assert_eq!(get(c, &u)?, Some(json!({"suggest": false})));
            Ok(())
        })
    }

    #[test]
    fn save_rejects_non_object() {
        run(|c| {
            let u = new_user(c);
            for bad in [json!(null), json!([1]), json!("x"), json!(3)] {
                unprocessable(save(c, &u, &bad));
            }
            assert_eq!(get(c, &u)?, None);
            Ok(())
        })
    }

    #[test]
    fn prefs_are_per_user() {
        run(|c| {
            let (a, b) = (new_user(c), new_user(c));
            save(c, &a, &json!({"streaks": true}))?;
            assert_eq!(get(c, &b)?, None);
            Ok(())
        })
    }
}
