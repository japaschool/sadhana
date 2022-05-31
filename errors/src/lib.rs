#[macro_use]
extern crate log;

use actix_web::{
    body::BoxBody, error::BlockingError, Error as ActixError, HttpResponse, ResponseError,
};
use derive_more::Display;
use diesel::result::{DatabaseErrorKind, Error as DBError};
use r2d2::Error as PoolError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Display, PartialEq)]
pub enum Error {
    BadRequest(String),
    InternalServerError(String),
    Unauthorized,
    Forbidden,
    NotFound(String),
    PoolError(String),
    BlockingError(String),
    #[display(fmt = "")]
    ValidationError(Vec<String>),
}

impl ResponseError for Error {
    fn error_response(&self) -> HttpResponse<BoxBody> {
        match &self {
            Error::BadRequest(msg) => {
                let error: ErrorResponse = msg.into();
                HttpResponse::BadRequest().json(error)
            }
            Error::NotFound(msg) => {
                let error: ErrorResponse = msg.into();
                HttpResponse::NotFound().json(error)
            }
            Error::ValidationError(msgs) => {
                let error: ErrorResponse = msgs.to_vec().into();
                HttpResponse::UnprocessableEntity().json(error)
            }
            _ => {
                error!("Internal server error: {:?}", self);
                let error: ErrorResponse = "Internal Server Error".into();
                HttpResponse::InternalServerError().json(error)
            }
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ErrorResponse {
    pub errors: Vec<String>,
}

impl From<&str> for ErrorResponse {
    fn from(err: &str) -> Self {
        ErrorResponse {
            errors: vec![err.into()],
        }
    }
}

impl From<&String> for ErrorResponse {
    fn from(err: &String) -> Self {
        ErrorResponse {
            errors: vec![err.into()],
        }
    }
}

impl From<Vec<String>> for ErrorResponse {
    fn from(errors: Vec<String>) -> Self {
        ErrorResponse { errors }
    }
}

impl From<DBError> for Error {
    fn from(err: DBError) -> Self {
        match err {
            DBError::DatabaseError(kind, info) => {
                if let DatabaseErrorKind::UniqueViolation = kind {
                    let msg = info.details().unwrap_or_else(|| info.message());
                    Error::BadRequest(msg.into())
                } else {
                    Error::InternalServerError(format!("DB Error: {}", info.message()))
                }
            }
            DBError::NotFound => Error::NotFound("Record not found".into()),
            _ => Error::InternalServerError("Unknown database error".into()),
        }
    }
}

impl From<PoolError> for Error {
    fn from(err: PoolError) -> Self {
        Error::PoolError(err.to_string())
    }
}

impl From<BlockingError> for Error {
    fn from(err: BlockingError) -> Self {
        error!("Thread blocking error {:?}", err);
        Error::BlockingError("Thread blocking error".into())
    }
}

impl From<ActixError> for Error {
    fn from(err: ActixError) -> Self {
        Error::InternalServerError(err.to_string())
    }
}
