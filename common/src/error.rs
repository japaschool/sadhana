use std::string::FromUtf8Error;

#[cfg(feature = "backend")]
use actix_web::{HttpResponse, ResponseError, error::BlockingError, http::StatusCode};
#[cfg(feature = "backend")]
use bcrypt::BcryptError;
#[cfg(feature = "backend")]
use diesel::r2d2::{Error as R2D2Error, PoolError};
#[cfg(feature = "backend")]
use diesel::result::{DatabaseErrorKind, Error as DieselError};
#[cfg(feature = "backend")]
use jsonwebtoken::errors::{Error as JwtError, ErrorKind as JwtErrorKind};
#[cfg(feature = "backend")]
use lettre::{
    address::AddressError, error::Error as LettreError, transport::smtp::Error as LettreSmtpError,
};
#[cfg(feature = "backend")]
use serde_json::Error as SerdeError;
#[cfg(feature = "backend")]
use uuid::Error as UuidError;
#[cfg(feature = "backend")]
use validator::ValidationErrors;

use thiserror::Error as ThisError;

#[derive(ThisError, Clone, Debug, PartialEq)]
pub enum AppError {
    /// 401
    #[error("Unauthorized: {}", _0)]
    Unauthorized(String),

    /// 403
    #[error("Forbidden: {}", _0)]
    Forbidden(String),

    /// 404
    #[error("Not Found")]
    NotFound,

    /// 422
    #[error("Unprocessable Entity: {:?}", _0)]
    UnprocessableEntity(Vec<String>),

    /// 500
    #[error("Internal Server Error")]
    InternalServerError,

    /// serde deserialize error
    #[error("Deserialize Error")]
    DeserializeError,

    /// request error
    #[error("Request Error")]
    RequestError,
}

#[cfg(feature = "backend")]
impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        match self {
            AppError::Unauthorized(ref msg) => HttpResponse::Unauthorized().json(msg),
            AppError::Forbidden(ref msg) => HttpResponse::Forbidden().json(msg),
            AppError::NotFound => HttpResponse::NotFound().finish(),
            AppError::UnprocessableEntity(ref msg) => HttpResponse::UnprocessableEntity().json(msg),
            AppError::InternalServerError => HttpResponse::InternalServerError().finish(),
            AppError::DeserializeError => HttpResponse::BadRequest().finish(),
            AppError::RequestError => unreachable!(),
        }
    }
    fn status_code(&self) -> StatusCode {
        match *self {
            AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            AppError::Forbidden(_) => StatusCode::FORBIDDEN,
            AppError::NotFound => StatusCode::NOT_FOUND,
            AppError::UnprocessableEntity(_) => StatusCode::UNPROCESSABLE_ENTITY,
            AppError::InternalServerError => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::DeserializeError => StatusCode::BAD_REQUEST,
            AppError::RequestError => unreachable!(),
        }
    }
}

#[cfg(feature = "backend")]
impl From<BlockingError> for AppError {
    fn from(err: BlockingError) -> Self {
        log::error!(
            "Error during running a blocking call in background: {:?}",
            err.to_string()
        );
        AppError::InternalServerError
    }
}

#[cfg(feature = "backend")]
impl From<PoolError> for AppError {
    fn from(_err: PoolError) -> Self {
        AppError::InternalServerError
    }
}

#[cfg(feature = "backend")]
impl From<R2D2Error> for AppError {
    fn from(_err: R2D2Error) -> Self {
        AppError::InternalServerError
    }
}

#[cfg(feature = "backend")]
impl From<BcryptError> for AppError {
    fn from(err: BcryptError) -> Self {
        match err {
            BcryptError::InvalidHash(_) => AppError::Unauthorized("PW is invalid".into()),
            _ => AppError::InternalServerError,
        }
    }
}

#[cfg(feature = "backend")]
impl From<JwtError> for AppError {
    fn from(err: JwtError) -> Self {
        match err.kind() {
            JwtErrorKind::InvalidToken => AppError::Unauthorized("Token is invalid".into()),
            JwtErrorKind::InvalidIssuer => AppError::Unauthorized("Issuer is invalid".into()),
            _ => AppError::Unauthorized("An issue was found with the token provided".into()),
        }
    }
}

#[cfg(feature = "backend")]
impl From<DieselError> for AppError {
    fn from(err: DieselError) -> Self {
        match &err {
            DieselError::DatabaseError(kind, info) => {
                if let DatabaseErrorKind::UniqueViolation = kind {
                    let message = info.details().unwrap_or_else(|| info.message()).to_string();
                    AppError::UnprocessableEntity(vec![message])
                } else {
                    log::error!("Unexpected diesel database error {}", info.message());
                    AppError::InternalServerError
                }
            }
            DieselError::NotFound => AppError::NotFound,
            _ => {
                log::error!("Unexpected diesel error {err}");
                AppError::InternalServerError
            }
        }
    }
}

#[cfg(feature = "backend")]
impl From<UuidError> for AppError {
    fn from(_err: UuidError) -> Self {
        AppError::NotFound
    }
}

#[cfg(feature = "backend")]
impl From<ValidationErrors> for AppError {
    fn from(errors: ValidationErrors) -> Self {
        let error_messages: Vec<String> = errors
            .field_errors()
            .into_iter()
            .map(|err| {
                let default = format!("{} fails validation", err.0);
                err.1[0]
                    .message
                    .as_ref()
                    .unwrap_or(&std::borrow::Cow::Owned(default))
                    .to_string()
            })
            .collect();

        AppError::UnprocessableEntity(error_messages)
    }
}

#[cfg(feature = "backend")]
impl From<LettreSmtpError> for AppError {
    fn from(err: LettreSmtpError) -> Self {
        log::error!("SmtpError: {:?}", err.to_string());
        AppError::InternalServerError
    }
}

#[cfg(feature = "backend")]
impl From<AddressError> for AppError {
    fn from(err: AddressError) -> Self {
        log::error!("Email address parsing error: {:?}", err.to_string());
        AppError::InternalServerError
    }
}

#[cfg(feature = "backend")]
impl From<LettreError> for AppError {
    fn from(err: LettreError) -> Self {
        log::error!("Failed to send email: {:?}", err.to_string());
        AppError::InternalServerError
    }
}

impl From<FromUtf8Error> for AppError {
    fn from(err: FromUtf8Error) -> Self {
        log::error!("Failed to url decode a parameter: {:?}", err.to_string());
        AppError::DeserializeError
    }
}

#[cfg(feature = "backend")]
impl From<SerdeError> for AppError {
    fn from(err: SerdeError) -> Self {
        log::error!(
            "Failed to serialize/deserialize data: {:?}",
            err.to_string()
        );
        AppError::DeserializeError
    }
}
