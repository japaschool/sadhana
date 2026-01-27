// @generated automatically by Diesel CLI.

pub mod sql_types {
    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "bar_layout_enum"))]
    pub struct BarLayoutEnum;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "line_style_enum"))]
    pub struct LineStyleEnum;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "practice_data_type_enum"))]
    pub struct PracticeDataTypeEnum;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "report_type_enum"))]
    pub struct ReportTypeEnum;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "trace_type_enum"))]
    pub struct TraceTypeEnum;
}

diesel::table! {
    confirmations (id) {
        id -> Uuid,
        #[max_length = 50]
        email -> Varchar,
        expires_at -> Timestamp,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::PracticeDataTypeEnum;

    default_user_practices (practice) {
        practice -> Text,
        data_type -> PracticeDataTypeEnum,
        order_key -> Nullable<Int4>,
        lang -> Text,
    }
}

diesel::table! {
    diary (cob_date, user_id, practice_id) {
        cob_date -> Date,
        user_id -> Uuid,
        practice_id -> Uuid,
        value -> Nullable<Jsonb>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::TraceTypeEnum;
    use super::sql_types::LineStyleEnum;

    report_traces (id) {
        id -> Uuid,
        report_id -> Uuid,
        practice_id -> Uuid,
        trace_type -> Nullable<TraceTypeEnum>,
        label -> Nullable<Text>,
        y_axis -> Nullable<Text>,
        show_average -> Nullable<Bool>,
        line_style -> Nullable<LineStyleEnum>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::ReportTypeEnum;
    use super::sql_types::BarLayoutEnum;

    reports (id) {
        id -> Uuid,
        user_id -> Uuid,
        report_type -> ReportTypeEnum,
        name -> Text,
        bar_layout -> Nullable<BarLayoutEnum>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::PracticeDataTypeEnum;

    user_practices (id) {
        id -> Uuid,
        user_id -> Uuid,
        practice -> Text,
        data_type -> PracticeDataTypeEnum,
        is_active -> Bool,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
        order_key -> Int4,
        is_required -> Nullable<Bool>,
        formula -> Nullable<Text>,
        dropdown_variants -> Nullable<Text>,
    }
}

diesel::table! {
    users (id) {
        id -> Uuid,
        email -> Text,
        hash -> Text,
        name -> Text,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::PracticeDataTypeEnum;

    yatra_practices (id) {
        id -> Uuid,
        yatra_id -> Uuid,
        practice -> Text,
        data_type -> PracticeDataTypeEnum,
        order_key -> Int4,
        colour_zones -> Nullable<Jsonb>,
        daily_score -> Nullable<Jsonb>,
    }
}

diesel::table! {
    yatra_user_practices (yatra_practice_id, user_practice_id) {
        yatra_practice_id -> Uuid,
        user_practice_id -> Uuid,
    }
}

diesel::table! {
    yatra_users (yatra_id, user_id) {
        yatra_id -> Uuid,
        user_id -> Uuid,
        is_admin -> Bool,
    }
}

diesel::table! {
    yatras (id) {
        id -> Uuid,
        name -> Text,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
        statistics -> Nullable<Jsonb>,
        show_stability_metrics -> Bool,
    }
}

diesel::joinable!(diary -> user_practices (practice_id));
diesel::joinable!(diary -> users (user_id));
diesel::joinable!(report_traces -> reports (report_id));
diesel::joinable!(report_traces -> user_practices (practice_id));
diesel::joinable!(reports -> users (user_id));
diesel::joinable!(user_practices -> users (user_id));
diesel::joinable!(yatra_practices -> yatras (yatra_id));
diesel::joinable!(yatra_user_practices -> user_practices (user_practice_id));
diesel::joinable!(yatra_user_practices -> yatra_practices (yatra_practice_id));
diesel::joinable!(yatra_users -> users (user_id));
diesel::joinable!(yatra_users -> yatras (yatra_id));

diesel::allow_tables_to_appear_in_same_query!(
    confirmations,
    default_user_practices,
    diary,
    report_traces,
    reports,
    user_practices,
    users,
    yatra_practices,
    yatra_user_practices,
    yatra_users,
    yatras,
);
