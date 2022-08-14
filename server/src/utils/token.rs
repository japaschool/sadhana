use jsonwebtoken::{errors::Error, DecodingKey, EncodingKey, Header, TokenData, Validation};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::env;
use uuid::Uuid;

lazy_static! {
    static ref KEY: String = env::var("JWT_KEY").expect("JWT_KEY must be set");
}
static ONE_DAY: i64 = 60 * 60 * 24; // in seconds

pub fn decode(token: &str) -> jsonwebtoken::errors::Result<TokenData<Claims>> {
    jsonwebtoken::decode::<Claims>(
        token,
        &DecodingKey::from_secret(&KEY.as_bytes()),
        &Validation::default(),
    )
}

pub fn generate(user_id: Uuid, now: i64) -> Result<String, Error> {
    let claims = Claims::new(user_id, now);
    jsonwebtoken::encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(&KEY.as_bytes()),
    )
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    // aud: String, // Optional. Audience
    exp: i64, // Required (validate_exp defaults to true in validation). Expiration time (as UTC timestamp)
    iat: i64, // Optional. Issued at (as UTC timestamp)
    // iss: String, // Optional. Issuer
    // nbf: usize, // Optional. Not Before (as UTC timestamp)
    // sub: String, // Optional. Subject (whom token refers to)
    // ---
    pub user_id: Uuid,
}

impl Claims {
    pub fn new(user_id: Uuid, now: i64) -> Self {
        Claims {
            iat: now,
            exp: now + ONE_DAY,
            user_id,
        }
    }
}
