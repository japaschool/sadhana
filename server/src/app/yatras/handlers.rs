use actix_web::{HttpRequest, HttpResponse, web};
use common::error::AppError;

use crate::middleware::{auth, state::AppState};

use crate::app::yatras::{domain, dto};

/// Gets yatra data for a cob date
pub async fn yatra_data(
    state: web::Data<AppState>,
    req: HttpRequest,
    params: web::Query<dto::YatraDataQueryParams>,
    path: web::Path<dto::YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let cob_date = params.cob_date;
    let yatra_id = path.into_inner();

    let res = web::block(move || {
        match (
            domain::YatraPractice::get_ordered_yatra_practices(&mut conn, &yatra_id),
            domain::YatraDataRaw::get_yatra_data(&mut conn, &yatra_id, &cob_date),
            domain::YatraStatisticResult::get_stats(&mut conn, &user_id, &yatra_id, &cob_date),
            domain::DailyScore::get_raw_scores(&mut conn, &yatra_id, &cob_date),
        ) {
            (Ok(data), Ok(practices), Ok(stats), Ok(daily_scores)) => {
                Ok((cob_date, data, practices, stats, daily_scores))
            }
            (Err(e), _, _, _) | (_, Err(e), _, _) | (_, _, Err(e), _) | (_, _, _, Err(e)) => {
                log::warn!("Failed to retrieve yatra data: {e}");
                Err(e)
            }
        }
    })
    .await??;

    Ok(HttpResponse::Ok().json(dto::YatraDataResponse::from(res)))
}

pub async fn is_admin(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<dto::YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();
    let user_id = auth::get_current_user(&req)?.id;

    let res = web::block(move || domain::Yatra::is_admin(&mut conn, &user_id, &yatra_id)).await??;

    Ok(HttpResponse::Ok().json(dto::YatraIsAdminResponse { is_admin: res }))
}

pub async fn join_yatra(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<dto::YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();
    let user_id = auth::get_current_user(&req)?.id;

    web::block(move || domain::Yatra::join(&mut conn, &user_id, &yatra_id)).await??;

    Ok(HttpResponse::Ok().json(()))
}

pub async fn yatra_leave(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<dto::YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();
    let user_id = auth::get_current_user(&req)?.id;

    web::block(move || domain::Yatra::leave(&mut conn, &user_id, &yatra_id)).await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Gets all user yatras
pub async fn user_yatras(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let yatras = web::block(move || domain::Yatra::get_user_yatras(&mut conn, &user_id)).await??;

    Ok(HttpResponse::Ok().json(dto::YatrasResponse { yatras }))
}

/// Create a new yatra
pub async fn create_yatra(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<dto::CreateYatraForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let name = form.name.clone();
    let user_id = auth::get_current_user(&req)?.id;

    let yatra = web::block(move || domain::Yatra::create(&mut conn, name, &user_id)).await??;

    Ok(HttpResponse::Ok().json(dto::YatraResponse { yatra }))
}

/// Delete yatra
pub async fn delete_yatra(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<dto::YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let yatra_id = path.into_inner();

    web::block(move || domain::Yatra::delete(&mut conn, &user_id, &yatra_id)).await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Rename yatra
pub async fn update_yatra(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<dto::UpdateYatraForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let yatra = form.into_inner().yatra;

    web::block(move || yatra.update(&mut conn, &user_id)).await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Get yatra
pub async fn get_yatra(
    state: web::Data<AppState>,
    path: web::Path<dto::YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();

    let yatra = web::block(move || domain::Yatra::get_yatra(&mut conn, &yatra_id)).await??;

    Ok(HttpResponse::Ok().json(dto::YatraResponse { yatra }))
}

/// Get yatra practices
pub async fn get_yatra_practices(
    state: web::Data<AppState>,
    path: web::Path<dto::YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();

    let practices = web::block(move || {
        domain::YatraPractice::get_ordered_yatra_practices(&mut conn, &yatra_id)
    })
    .await??;

    Ok(HttpResponse::Ok().json(dto::YatraPracticesResponse { practices }))
}

/// Get yatra users
pub async fn get_yatra_users(
    state: web::Data<AppState>,
    path: web::Path<dto::YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();

    let users =
        web::block(move || domain::YatraUser::get_yatra_users(&mut conn, &yatra_id)).await??;

    Ok(HttpResponse::Ok().json(dto::YatraUsersResponse { users }))
}

/// Delete yatra user
pub async fn delete_yatra_user(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<dto::YatraIdUserIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let (yatra_id, user_id) = path.into_inner();
    let current_user_id = auth::get_current_user(&req)?.id;

    web::block(move || {
        domain::Yatra::ensure_admin_user(&mut conn, &current_user_id, &yatra_id)?;
        domain::Yatra::leave(&mut conn, &user_id, &yatra_id)
    })
    .await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Toggle admin
pub async fn toggle_is_admin(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<dto::YatraIdUserIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let (yatra_id, user_id) = path.into_inner();
    let current_user_id = auth::get_current_user(&req)?.id;

    web::block(move || {
        domain::Yatra::toggle_is_admin(&mut conn, &current_user_id, &user_id, &yatra_id)
    })
    .await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Create yatra practice
pub async fn create_yatra_practice(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<dto::CreateYatraPracticeForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;

    web::block(move || domain::YatraPractice::create(&mut conn, &user_id, &form.practice))
        .await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Get yatra practice details
pub async fn get_yatra_practice(
    state: web::Data<AppState>,
    path: web::Path<dto::YatraIdPracticeSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let (yatra_id, practice_id) = path.into_inner();

    let practice =
        web::block(move || domain::YatraPractice::get(&mut conn, &yatra_id, &practice_id))
            .await??;

    Ok(HttpResponse::Ok().json(dto::GetYatraPracticeResponse { practice }))
}

/// Delete yatra practice
pub async fn delete_yatra_practice(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<dto::YatraIdPracticeSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let (yatra_id, practice_id) = path.into_inner();

    web::block(move || domain::YatraPractice::delete(&mut conn, &user_id, &yatra_id, &practice_id))
        .await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Update yatra practice
pub async fn update_yatra_practice(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<dto::UpdateYatraPractice>,
    path: web::Path<dto::YatraIdPracticeSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let (yatra_id, _) = path.into_inner();
    let data = form.practice.clone();

    web::block(move || domain::YatraPractice::update(&mut conn, &user_id, &yatra_id, &data))
        .await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Updates order of yatra practices
pub async fn update_yatra_practice_order_key(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<dto::YatraIdSlug>,
    form: web::Json<dto::UpdateYatraPracticeOrderKeyRequest>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let yatra_id = path.into_inner();

    log::info!("Reorder payload {:?}", form.practices);

    let data = form
        .practices
        .iter()
        .enumerate()
        .map(|(idx, practice)| dto::UpdateYatraPracticeOrderKey {
            practice_id: *practice,
            order_key: idx as i32,
        })
        .collect();

    web::block(move || {
        domain::YatraPractice::update_order_key(&mut conn, &user_id, &yatra_id, &data)
    })
    .await??;
    Ok(HttpResponse::Ok().json(()))
}

/// Get yatra to user practices mapping
pub async fn get_yatra_user_practices(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<dto::YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();
    let user_id = auth::get_current_user(&req)?.id;

    let practices = web::block(move || {
        domain::YatraUserPractice::get_yatra_user_practices(&mut conn, &user_id, &yatra_id)
    })
    .await??;

    Ok(HttpResponse::Ok().json(dto::YatraUserPractices { practices }))
}

/// Update yatra to user practices mapping
pub async fn update_yatra_user_practices(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<dto::YatraIdSlug>,
    form: web::Json<dto::YatraUserPractices>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();
    let user_id = auth::get_current_user(&req)?.id;
    let data = form.practices.clone();

    web::block(move || {
        domain::YatraUserPractice::update_yatra_user_practices(
            &mut conn, &user_id, &yatra_id, &data,
        )
    })
    .await??;

    Ok(HttpResponse::Ok().json(()))
}
