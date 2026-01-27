use chrono::{Local, NaiveDate};
use serde::Serialize;

use super::domain::DailyScore;

#[derive(Debug, Clone, Copy, Serialize)]
pub enum TrendArrow {
    Up,
    Down,
    Flat,
}

#[derive(Debug, Default)]
pub struct UserMetrics {
    pub trend_arrow: Option<TrendArrow>,
    pub stability_heatmap: Vec<i16>,
}

impl From<(NaiveDate, Vec<DailyScore>)> for UserMetrics {
    fn from(value: (NaiveDate, Vec<DailyScore>)) -> Self {
        let (cob, scores) = value;

        let daily_totals: Vec<_> = scores.iter().map(DailyScore::daily_total).collect();

        let stability_heatmap = heatmap_7d_averages(&daily_totals);
        let trend_arrow = trend_arrow(&daily_totals, cob == Local::now().date_naive());

        Self {
            trend_arrow,
            stability_heatmap,
        }
    }
}

fn heatmap_7d_averages(series: &[i16]) -> Vec<i16> {
    (7..=21) // 15 days' 7 days average inclusive, hence 15 + 6
        .map(|i| series[i - 7..i].iter().sum::<i16>() / 7)
        .collect()
}

fn trend_arrow(series: &[i16], exclude_last_day: bool) -> Option<TrendArrow> {
    let end = if exclude_last_day { 20 } else { 21 };

    // Last 3 days
    let last3_avg = series[end - 3..end].iter().sum::<i16>() / 3;

    // Previous 4 days
    let prev4_avg = series[end - 7..end - 3].iter().sum::<i16>() / 4;

    if last3_avg == 0 && prev4_avg == 0 {
        return None;
    }

    let res = if (last3_avg - prev4_avg).abs() < 6 {
        TrendArrow::Flat
    } else if last3_avg > prev4_avg {
        TrendArrow::Up
    } else {
        TrendArrow::Down
    };

    Some(res)
}
