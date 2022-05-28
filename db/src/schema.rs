table! {
    users (id) {
        id -> Int4,
        name -> Text,
        email -> Text,
        pwd_hash -> Text,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}
