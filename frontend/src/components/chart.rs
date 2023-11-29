use std::collections::HashSet;
use std::fmt::Display;
use std::str::FromStr;

use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use yew::prelude::*;
use yew_plotly::plotly::color::NamedColor;
use yew_plotly::plotly::common::{
    Anchor, AxisSide, DashType, Font, Line, LineShape, Marker, MarkerSymbol, Mode, Orientation,
    Position, TickMode,
};
use yew_plotly::plotly::configuration::DisplayModeBar;
use yew_plotly::plotly::layout::{Axis, BarMode, Legend, Margin};
use yew_plotly::plotly::{Bar, Configuration, Layout, Plot, Scatter, Trace};
use yew_plotly::Plotly;

use crate::i18n::*;
use crate::model::PracticeDataType;

#[derive(Debug, Properties, Clone, PartialEq)]
pub struct Props {
    #[prop_or(BarGraphLayout::Grouped)]
    pub bar_mode: BarGraphLayout,
    #[prop_or_default]
    pub traces: Vec<Graph>,
}

#[derive(Clone, PartialEq, Debug)]
pub struct Graph {
    pub name: Option<String>,
    pub type_: GraphType,
    pub x_values: Vec<String>,
    pub y_values: Vec<String>,
    pub y_axis_type: PracticeDataType,
    pub y_axis: Option<YAxis>,
    pub average: Option<GraphAverage>,
}

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum GraphType {
    Bar,
    Line(LineConf),
    Dot,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum BarGraphLayout {
    Stacked,
    Grouped,
    Overlaid,
}

impl FromStr for BarGraphLayout {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "grouped" => Ok(Self::Grouped),
            "stacked" => Ok(Self::Stacked),
            "overlaid" => Ok(Self::Overlaid),
            _ => Err(()),
        }
    }
}

impl Display for BarGraphLayout {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            BarGraphLayout::Grouped => "grouped",
            BarGraphLayout::Stacked => "stacked",
            BarGraphLayout::Overlaid => "overlaid",
        };
        write!(f, "{}", s)
    }
}

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub struct LineConf {
    pub style: LineStyle,
}

impl LineConf {
    pub fn new(style: LineStyle) -> Self {
        Self { style }
    }

    fn line_shape(&self) -> LineShape {
        match self.style {
            LineStyle::Regular => LineShape::Linear,
            LineStyle::Square => LineShape::Hv,
        }
    }
}

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum LineStyle {
    Regular,
    Square,
}

#[derive(Clone, PartialEq, Debug)]
pub struct GraphAverage {
    pub value: String,
    pub label: String,
}
impl GraphAverage {
    pub fn new<S1: Into<String>, S2: Into<String>>(value: S1, label: S2) -> Self {
        Self {
            value: value.into(),
            label: label.into(),
        }
    }
}

#[derive(Clone, PartialEq, Eq, Hash, Debug, Deserialize, Serialize)]
pub enum YAxis {
    Y,
    Y2,
    Y3,
    Y4,
    Y5,
    Y6,
    Y7,
    Y8,
}

impl Display for YAxis {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                YAxis::Y => "y",
                YAxis::Y2 => "y2",
                YAxis::Y3 => "y3",
                YAxis::Y4 => "y4",
                YAxis::Y5 => "y5",
                YAxis::Y6 => "y6",
                YAxis::Y7 => "y7",
                YAxis::Y8 => "y8",
            }
        )
    }
}

impl FromStr for YAxis {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "y" => Ok(YAxis::Y),
            "y2" => Ok(YAxis::Y2),
            "y3" => Ok(YAxis::Y3),
            "y4" => Ok(YAxis::Y4),
            "y5" => Ok(YAxis::Y5),
            "y6" => Ok(YAxis::Y6),
            "y7" => Ok(YAxis::Y7),
            "y8" => Ok(YAxis::Y8),
            _ => Err(()),
        }
    }
}

lazy_static! {
    static ref COLORS: Vec<NamedColor> = vec![
        NamedColor::DarkOrange,
        NamedColor::FireBrick,
        NamedColor::Tomato,
        NamedColor::IndianRed,
        NamedColor::DarkMagenta,
        NamedColor::DarkKhaki,
        NamedColor::SlateBlue,
        NamedColor::LightSalmon,
        NamedColor::PaleVioletRed,
        NamedColor::Olive,
        NamedColor::LightSeaGreen,
        NamedColor::PaleTurquoise,
        NamedColor::LightSteelBlue,
        NamedColor::Sienna,
        NamedColor::MediumPurple,
    ];
}

#[function_component(Chart)]
pub fn chart(props: &Props) -> Html {
    log::debug!("Building chart for {:?}", props);

    let mut plot = Plot::new();

    // Display horizontally at the bottom in a middle of X axis
    let legend = Legend::default()
        .orientation(Orientation::Horizontal)
        .x_anchor(Anchor::Center)
        .x(0.5);

    let mut layout = Layout::new()
        .paper_background_color(NamedColor::Transparent)
        .plot_background_color(NamedColor::Transparent)
        .font(Font::new().color(NamedColor::DarkGray))
        .margin(Margin::new().left(40).right(40).top(10))
        .show_legend(props.traces.iter().any(|t| t.name.is_some()))
        .auto_size(true)
        .legend(legend);

    match props.bar_mode {
        BarGraphLayout::Grouped => layout = layout.bar_mode(BarMode::Group),
        BarGraphLayout::Overlaid => layout = layout.bar_mode(BarMode::Overlay),
        BarGraphLayout::Stacked => layout = layout.bar_mode(BarMode::Relative),
    }

    let mut y_axises = HashSet::new();

    for (
        i,
        Graph {
            name,
            type_,
            x_values,
            y_values,
            y_axis_type,
            y_axis,
            average,
        },
    ) in props.traces.iter().enumerate()
    {
        let y_axis_key = y_axis.clone().unwrap_or(YAxis::Y);
        let y_axis_key_str = y_axis_key.to_string();

        if !y_axises.contains(&y_axis_key_str) {
            let mut y_axis = Axis::new();

            if PracticeDataType::Time == *y_axis_type {
                y_axis = y_axis.tick_format("%H:%M");
            }

            if PracticeDataType::Duration == *y_axis_type {
                y_axis = y_axis.tick_suffix(Locale::current().minutes_label());
            }

            if PracticeDataType::Bool == *y_axis_type {
                y_axis = y_axis
                    .show_grid(false)
                    .tick_mode(TickMode::Linear)
                    .tick0(0.0)
                    .dtick(0.1)
                    .range(vec![0.0, 1.1])
                    .visible(false);
            }

            match y_axis_key {
                YAxis::Y => layout = layout.y_axis(y_axis),
                YAxis::Y2 => layout = layout.y_axis2(y_axis.overlaying("y").side(AxisSide::Right)),
                YAxis::Y3 => layout = layout.y_axis3(y_axis.overlaying("y").side(AxisSide::Left)),
                YAxis::Y4 => layout = layout.y_axis4(y_axis.overlaying("y").side(AxisSide::Right)),
                YAxis::Y5 => layout = layout.y_axis5(y_axis.overlaying("y").side(AxisSide::Left)),
                YAxis::Y6 => layout = layout.y_axis6(y_axis.overlaying("y").side(AxisSide::Right)),
                YAxis::Y7 => layout = layout.y_axis7(y_axis.overlaying("y").side(AxisSide::Left)),
                YAxis::Y8 => layout = layout.y_axis8(y_axis.overlaying("y").side(AxisSide::Right)),
            };

            y_axises.insert(y_axis_key_str.clone());
        }

        let trace: Box<dyn Trace> = match type_ {
            GraphType::Bar => Bar::new(x_values.clone(), y_values.clone())
                // .marker(Marker::new().color(NamedColor::DarkOrange))
                .marker(Marker::new().color(COLORS[i % COLORS.len()]))
                .name(name.to_owned().unwrap_or_default())
                .show_legend(name.is_some())
                .y_axis(y_axis_key_str.clone())
                .offset_group((i + 1).to_string())
                .opacity(0.35),
            GraphType::Dot => Scatter::new(x_values.clone(), y_values.clone())
                .marker(
                    Marker::new()
                        .color(COLORS[i % COLORS.len()])
                        .symbol(MarkerSymbol::Asterisk)
                        .line(Line::new().width(2.0).color(COLORS[i % COLORS.len()]))
                        .size(10),
                )
                .name(name.to_owned().unwrap_or_default())
                .show_legend(name.is_some())
                .mode(Mode::Markers)
                .y_axis(y_axis_key_str.clone())
                .opacity(0.8),
            GraphType::Line(conf) => Scatter::new(x_values.clone(), y_values.clone())
                .line(
                    Line::new()
                        .shape(conf.line_shape())
                        .color(COLORS[i % COLORS.len()]),
                )
                .name(name.to_owned().unwrap_or_default())
                .show_legend(name.is_some())
                .mode(Mode::LinesMarkers)
                .y_axis(y_axis_key_str.clone())
                .opacity(0.5),
        };

        plot.add_trace(trace);

        if let Some(GraphAverage { value, label }) = average {
            let trace_avg = Scatter::new(x_values.clone(), vec![value.clone(); y_values.len()])
                .name("")
                .text_array(
                    x_values
                        .iter()
                        .enumerate()
                        .map(|(idx, _)| {
                            if idx == 0 {
                                format!(
                                    "{}{}",
                                    Locale::current().on_average(Qty(label)),
                                    name.as_ref()
                                        .map(|nm| format!(" ({nm})"))
                                        .unwrap_or_default()
                                )
                            } else {
                                "".to_string()
                            }
                        })
                        .collect::<Vec<_>>(),
                )
                .text_position(Position::TopRight)
                .show_legend(false)
                .y_axis(y_axis_key_str)
                .line(Line::new().dash(DashType::LongDash))
                .mode(Mode::LinesText);
            plot.add_trace(trace_avg);
        }
    }

    let config = Configuration::default()
        .display_mode_bar(DisplayModeBar::False)
        .static_plot(true)
        .responsive(true)
        .locale(&Locale::current().to_string());

    plot.set_layout(layout);
    plot.set_configuration(config);

    html! { <Plotly plot={plot}/> }
}
