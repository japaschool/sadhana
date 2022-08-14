table! {
    users (id) {
        id -> Uuid,
        email -> Varchar,
        hash -> Varchar,
        name -> Text,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}
