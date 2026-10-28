use std::collections::HashSet;

use common::error::AppError;
use diesel::prelude::*;
use uuid::Uuid;

use super::dto;
use crate::schema::{practice_groups, user_practices};

const MAX_NAME_LEN: usize = 64;

fn valid_name(name: &str) -> Result<String, AppError> {
    let name = name.trim();
    let len = name.chars().count();
    if len == 0 || len > MAX_NAME_LEN {
        return Err(AppError::UnprocessableEntity(vec![format!(
            "name must be 1-{MAX_NAME_LEN} characters"
        )]));
    }
    Ok(name.to_string())
}

/// Returns the id of the user's default group row, creating it (first in order) if missing.
fn ensure_default(conn: &mut PgConnection, user_id: &Uuid) -> Result<Uuid, AppError> {
    diesel::insert_into(practice_groups::table)
        .values((
            practice_groups::user_id.eq(user_id),
            practice_groups::name.eq(""),
            practice_groups::order_key.eq(0),
            practice_groups::is_default.eq(true),
        ))
        .on_conflict_do_nothing()
        .execute(conn)?;
    Ok(practice_groups::table
        .select(practice_groups::id)
        .filter(
            practice_groups::user_id
                .eq(user_id)
                .and(practice_groups::is_default),
        )
        .first(conn)?)
}

/// Fails with NotFound unless every id is one of the user's non-default groups.
fn check_groups_owned(
    conn: &mut PgConnection,
    user_id: &Uuid,
    ids: &HashSet<Uuid>,
) -> Result<(), AppError> {
    let ids_vec: Vec<Uuid> = ids.iter().copied().collect();
    let owned: i64 = practice_groups::table
        .filter(
            practice_groups::user_id
                .eq(user_id)
                .and(practice_groups::is_default.eq(false))
                .and(practice_groups::id.eq_any(&ids_vec)),
        )
        .count()
        .get_result(conn)?;
    if owned as usize != ids.len() {
        return Err(AppError::NotFound);
    }
    Ok(())
}

fn check_practices_owned(
    conn: &mut PgConnection,
    user_id: &Uuid,
    ids: &HashSet<Uuid>,
) -> Result<(), AppError> {
    let ids_vec: Vec<Uuid> = ids.iter().copied().collect();
    let owned: i64 = user_practices::table
        .filter(
            user_practices::user_id
                .eq(user_id)
                .and(user_practices::id.eq_any(&ids_vec)),
        )
        .count()
        .get_result(conn)?;
    if owned as usize != ids.len() {
        return Err(AppError::NotFound);
    }
    Ok(())
}

/// The user's groups in order. The default group is always present exactly once (id `None`).
pub fn list(conn: &mut PgConnection, user_id: &Uuid) -> Result<Vec<dto::Group>, AppError> {
    let rows: Vec<(Uuid, String, bool)> = practice_groups::table
        .select((
            practice_groups::id,
            practice_groups::name,
            practice_groups::is_default,
        ))
        .filter(practice_groups::user_id.eq(user_id))
        .order(practice_groups::order_key)
        .load(conn)?;

    let mut groups: Vec<dto::Group> = rows
        .into_iter()
        .map(|(id, name, is_default)| {
            if is_default {
                dto::Group {
                    id: None,
                    name: String::new(),
                    is_default,
                }
            } else {
                dto::Group {
                    id: Some(id),
                    name,
                    is_default,
                }
            }
        })
        .collect();
    if !groups.iter().any(|g| g.is_default) {
        groups.insert(
            0,
            dto::Group {
                id: None,
                name: String::new(),
                is_default: true,
            },
        );
    }
    Ok(groups)
}

pub fn create(conn: &mut PgConnection, user_id: &Uuid, name: &str) -> Result<Uuid, AppError> {
    let name = valid_name(name)?;
    conn.transaction(|conn| {
        ensure_default(conn, user_id)?;
        let max: Option<i32> = practice_groups::table
            .select(diesel::dsl::max(practice_groups::order_key))
            .filter(practice_groups::user_id.eq(user_id))
            .first(conn)?;
        Ok(diesel::insert_into(practice_groups::table)
            .values((
                practice_groups::user_id.eq(user_id),
                practice_groups::name.eq(&name),
                practice_groups::order_key.eq(max.unwrap_or(0) + 1),
            ))
            .returning(practice_groups::id)
            .get_result(conn)?)
    })
}

pub fn rename(
    conn: &mut PgConnection,
    user_id: &Uuid,
    id: &Uuid,
    name: &str,
) -> Result<(), AppError> {
    let name = valid_name(name)?;
    let updated = diesel::update(practice_groups::table)
        .set(practice_groups::name.eq(&name))
        .filter(
            practice_groups::id
                .eq(id)
                .and(practice_groups::user_id.eq(user_id))
                .and(practice_groups::is_default.eq(false)),
        )
        .execute(conn)?;
    if updated == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

/// Deletes a group; its practices go to the default group, at the end of the global order.
pub fn delete(conn: &mut PgConnection, user_id: &Uuid, id: &Uuid) -> Result<(), AppError> {
    conn.transaction(|conn| {
        check_groups_owned(conn, user_id, &HashSet::from([*id]))?;
        let moved: Vec<Uuid> = user_practices::table
            .select(user_practices::id)
            .filter(
                user_practices::user_id
                    .eq(user_id)
                    .and(user_practices::group_id.eq(id)),
            )
            .order(user_practices::order_key)
            .load(conn)?;
        let max: Option<i32> = user_practices::table
            .select(diesel::dsl::max(user_practices::order_key))
            .filter(user_practices::user_id.eq(user_id))
            .first(conn)?;
        let start = max.unwrap_or(-1) + 1;
        for (i, practice_id) in moved.iter().enumerate() {
            diesel::update(user_practices::table.filter(user_practices::id.eq(practice_id)))
                .set((
                    user_practices::group_id.eq(None::<Uuid>),
                    user_practices::order_key.eq(start + i as i32),
                ))
                .execute(conn)?;
        }
        diesel::delete(practice_groups::table.filter(practice_groups::id.eq(id))).execute(conn)?;
        Ok(())
    })
}

/// Saves group order and each listed practice's group and position in one transaction.
pub fn save_layout(
    conn: &mut PgConnection,
    user_id: &Uuid,
    layout: &dto::Layout,
) -> Result<(), AppError> {
    let group_ids: HashSet<Uuid> = layout
        .groups
        .iter()
        .copied()
        .chain(layout.practices.iter().map(|p| p.group_id))
        .flatten()
        .collect();
    let practice_ids: HashSet<Uuid> = layout.practices.iter().map(|p| p.id).collect();

    conn.transaction(|conn| {
        check_groups_owned(conn, user_id, &group_ids)?;
        check_practices_owned(conn, user_id, &practice_ids)?;
        let default_id = ensure_default(conn, user_id)?;

        for (idx, group) in layout.groups.iter().enumerate() {
            diesel::update(practice_groups::table)
                .set(practice_groups::order_key.eq(idx as i32))
                .filter(
                    practice_groups::id
                        .eq(group.unwrap_or(default_id))
                        .and(practice_groups::user_id.eq(user_id)),
                )
                .execute(conn)?;
        }
        for (idx, p) in layout.practices.iter().enumerate() {
            diesel::update(user_practices::table)
                .set((
                    user_practices::group_id.eq(p.group_id),
                    user_practices::order_key.eq(idx as i32),
                ))
                .filter(
                    user_practices::id
                        .eq(p.id)
                        .and(user_practices::user_id.eq(user_id)),
                )
                .execute(conn)?;
        }
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app::user_practices::{
        NewUserPractice, NewUserPracticeForm, UpdateUserPracticeOrderKey, UserPractice,
    };
    use crate::db_types::PracticeDataType;
    use crate::utils::db;
    use diesel::sql_query;
    use diesel::sql_types::{Text, Uuid as DieselUuid};

    fn new_user(conn: &mut PgConnection) -> Uuid {
        let user_id = Uuid::new_v4();
        sql_query("insert into users (id, email, hash, name) values ($1, $2, '', 'x')")
            .bind::<DieselUuid, _>(user_id)
            .bind::<Text, _>(format!("{user_id}@groups.test"))
            .execute(conn)
            .unwrap();
        user_id
    }

    /// A user with practices A, B, C at order keys 0..2.
    fn user_with_abc(conn: &mut PgConnection) -> (Uuid, [Uuid; 3]) {
        let user_id = new_user(conn);
        let mut ids = [Uuid::nil(); 3];
        for (i, name) in ["A", "B", "C"].iter().enumerate() {
            ids[i] = diesel::insert_into(user_practices::table)
                .values((
                    user_practices::user_id.eq(user_id),
                    user_practices::practice.eq(*name),
                    user_practices::data_type.eq(PracticeDataType::Int),
                    user_practices::is_active.eq(true),
                    user_practices::order_key.eq(i as i32),
                ))
                .returning(user_practices::id)
                .get_result(conn)
                .unwrap();
        }
        (user_id, ids)
    }

    fn ids(conn: &mut PgConnection, user_id: &Uuid) -> Vec<Option<Uuid>> {
        list(conn, user_id)
            .unwrap()
            .into_iter()
            .map(|g| g.id)
            .collect()
    }

    fn practice(conn: &mut PgConnection, id: &Uuid) -> (Option<Uuid>, i32) {
        user_practices::table
            .select((user_practices::group_id, user_practices::order_key))
            .filter(user_practices::id.eq(id))
            .first(conn)
            .unwrap()
    }

    fn layout(groups: Vec<Option<Uuid>>, practices: Vec<(Uuid, Option<Uuid>)>) -> dto::Layout {
        dto::Layout {
            groups,
            practices: practices
                .into_iter()
                .map(|(id, group_id)| dto::LayoutPractice { id, group_id })
                .collect(),
        }
    }

    fn run(f: impl FnOnce(&mut PgConnection) -> Result<(), AppError>) {
        let mut conn = db::establish_connection().get().unwrap();
        conn.test_transaction::<_, AppError, _>(|c| f(c));
    }

    #[test]
    fn list_without_groups_is_just_default() {
        run(|conn| {
            let user_id = new_user(conn);
            assert_eq!(
                list(conn, &user_id)?,
                vec![dto::Group {
                    id: None,
                    name: "".into(),
                    is_default: true
                }]
            );
            Ok(())
        });
    }

    #[test]
    fn create_appends_after_default() {
        run(|conn| {
            let user_id = new_user(conn);
            let morning = create(conn, &user_id, "Morning")?;
            assert_eq!(ids(conn, &user_id), vec![None, Some(morning)]);
            let evening = create(conn, &user_id, " Evening ")?;
            let groups = list(conn, &user_id)?;
            assert_eq!(groups[2].id, Some(evening));
            assert_eq!(groups[2].name, "Evening");
            Ok(())
        });
    }

    #[test]
    fn duplicate_or_blank_name_is_rejected() {
        run(|conn| {
            let user_id = new_user(conn);
            create(conn, &user_id, "Morning")?;
            assert!(matches!(
                create(conn, &user_id, "Morning"),
                Err(AppError::UnprocessableEntity(_))
            ));
            assert!(matches!(
                create(conn, &user_id, "  "),
                Err(AppError::UnprocessableEntity(_))
            ));
            assert!(matches!(
                create(conn, &user_id, &"x".repeat(65)),
                Err(AppError::UnprocessableEntity(_))
            ));
            assert!(create(conn, &user_id, &"x".repeat(64)).is_ok());
            // Same name for another user is fine.
            let other = new_user(conn);
            assert!(create(conn, &other, "Morning").is_ok());
            Ok(())
        });
    }

    #[test]
    fn rename_group() {
        run(|conn| {
            let user_id = new_user(conn);
            let m = create(conn, &user_id, "Morning")?;
            rename(conn, &user_id, &m, "Dawn")?;
            assert_eq!(list(conn, &user_id)?[1].name, "Dawn");
            assert_eq!(
                rename(conn, &user_id, &Uuid::new_v4(), "x"),
                Err(AppError::NotFound)
            );
            Ok(())
        });
    }

    #[test]
    fn layout_moves_practice_and_groups() {
        run(|conn| {
            let (user_id, [a, b, c]) = user_with_abc(conn);
            let m = create(conn, &user_id, "Morning")?;
            save_layout(
                conn,
                &user_id,
                &layout(
                    vec![Some(m), None],
                    vec![(c, Some(m)), (a, None), (b, None)],
                ),
            )?;
            assert_eq!(ids(conn, &user_id), vec![Some(m), None]);
            assert_eq!(practice(conn, &c), (Some(m), 0));
            assert_eq!(practice(conn, &a), (None, 1));
            assert_eq!(practice(conn, &b), (None, 2));
            Ok(())
        });
    }

    #[test]
    fn layout_creates_default_row_when_missing() {
        run(|conn| {
            let (user_id, [a, ..]) = user_with_abc(conn);
            save_layout(conn, &user_id, &layout(vec![None], vec![(a, None)]))?;
            assert_eq!(ids(conn, &user_id), vec![None]);
            Ok(())
        });
    }

    #[test]
    fn delete_returns_practices_to_end_of_default() {
        run(|conn| {
            let (user_id, [a, b, c]) = user_with_abc(conn);
            let m = create(conn, &user_id, "Morning")?;
            save_layout(
                conn,
                &user_id,
                &layout(
                    vec![Some(m), None],
                    vec![(c, Some(m)), (a, None), (b, None)],
                ),
            )?;
            delete(conn, &user_id, &m)?;
            let (gc, oc) = practice(conn, &c);
            assert_eq!(gc, None);
            assert!(oc > practice(conn, &a).1 && oc > practice(conn, &b).1);
            assert_eq!(ids(conn, &user_id), vec![None]);
            assert_eq!(delete(conn, &user_id, &m), Err(AppError::NotFound));
            Ok(())
        });
    }

    #[test]
    fn layout_rejects_foreign_ids() {
        run(|conn| {
            let (user_id, [a, b, c]) = user_with_abc(conn);
            let (other, [x, ..]) = user_with_abc(conn);
            let m = create(conn, &user_id, "Morning")?;
            let foreign_group = create(conn, &other, "Theirs")?;
            let before = [practice(conn, &a), practice(conn, &b), practice(conn, &c)];

            let bad = [
                layout(vec![Some(foreign_group)], vec![]),
                layout(vec![Some(m)], vec![(a, Some(foreign_group))]),
                layout(vec![Some(m)], vec![(c, Some(m)), (x, None)]),
            ];
            for l in bad {
                assert_eq!(save_layout(conn, &user_id, &l), Err(AppError::NotFound));
            }
            assert_eq!(
                before,
                [practice(conn, &a), practice(conn, &b), practice(conn, &c)]
            );
            assert_eq!(ids(conn, &user_id), vec![None, Some(m)]);
            Ok(())
        });
    }

    #[test]
    fn old_update_and_reorder_keep_group() {
        run(|conn| {
            let (user_id, [a, b, c]) = user_with_abc(conn);
            let m = create(conn, &user_id, "Morning")?;
            save_layout(
                conn,
                &user_id,
                &layout(
                    vec![Some(m), None],
                    vec![(c, Some(m)), (a, None), (b, None)],
                ),
            )?;
            UserPractice::update(conn, &user_id, &c, "C2", true, None, &None)?;
            UserPractice::update_order_key(
                conn,
                &user_id,
                &vec![
                    UpdateUserPracticeOrderKey {
                        practice: a,
                        order_key: 0,
                    },
                    UpdateUserPracticeOrderKey {
                        practice: c,
                        order_key: 1,
                    },
                    UpdateUserPracticeOrderKey {
                        practice: b,
                        order_key: 2,
                    },
                ],
            )?;
            assert_eq!(practice(conn, &c), (Some(m), 1));
            Ok(())
        });
    }

    #[test]
    fn create_practice_with_group() {
        run(|conn| {
            let user_id = new_user(conn);
            let other = new_user(conn);
            let m = create(conn, &user_id, "Morning")?;
            let theirs = create(conn, &other, "Theirs")?;
            let form = |group_id: Option<Uuid>| {
                let json = serde_json::json!({
                    "practice": "P", "data_type": "Int", "is_active": true, "group_id": group_id
                });
                let f: NewUserPracticeForm = serde_json::from_value(json).unwrap();
                NewUserPractice::from_form(user_id, f)
            };
            UserPractice::create(conn, &form(Some(m)))?;
            let all = UserPractice::all_user_practices(conn, &user_id)?;
            assert_eq!(all[0].group_id, Some(m));
            assert_eq!(
                UserPractice::create(conn, &form(Some(theirs))),
                Err(AppError::NotFound)
            );
            Ok(())
        });
    }
}
