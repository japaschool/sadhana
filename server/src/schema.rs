table! {
    journal (cob_date, user_id, metric) {
        cob_date -> Date,
        user_id -> Uuid,
        metric -> Text,
        value -> Nullable<Json>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

table! {
    user_metrics (user_id, metric) {
        user_id -> Uuid,
        metric -> Text,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

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

joinable!(user_metrics -> users (user_id));

allow_tables_to_appear_in_same_query!(
    journal,
    user_metrics,
    users,
);
