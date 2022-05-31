use actix_web::web::Json;
use errors::Error;
use validator::{Validate, ValidationErrors};

fn collect_errors(erros: ValidationErrors) -> Vec<String> {
    erros
        .field_errors()
        .into_iter()
        .map(|err| {
            let default = format!("{} is required", err.0);
            err.1[0]
                .message
                .as_ref()
                .unwrap_or(&std::borrow::Cow::Owned(default))
                .to_string()
        })
        .collect()
}

pub fn validate<T>(params: &Json<T>) -> Result<(), Error>
where
    T: Validate,
{
    params
        .validate()
        .map_err(|errors| Error::ValidationError(collect_errors(errors)))
}
