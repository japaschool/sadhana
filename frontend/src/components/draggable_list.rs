use gloo_dialogs::{confirm, prompt};
use wasm_bindgen::JsCast;
use web_sys::HtmlElement;
use yew::prelude::*;
use yew_hooks::use_list;

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub items: Vec<String>,
    #[prop_or(true)]
    pub toggle_hidden_enabled: bool,
    pub toggle_hidden: Callback<String>,
    pub is_hidden: Callback<String, bool>,
    pub rename: Callback<(String, String)>,
    pub rename_popup_label: AttrValue,
    pub delete: Callback<String>,
    pub delete_popup_label: AttrValue,
    pub reorder: Callback<Vec<String>>,
}

/// Drag and drop inspired by this article: https://stackoverflow.com/questions/54237737/html5-dragndrop-not-working-on-ios-12-1-2-safari-and-chrome
#[function_component(DraggableList)]
pub fn draggable_list(props: &Props) -> Html {
    log::debug!("Initialising with items: {:?}", props.items);

    let dragging = use_mut_ref(|| None);
    let ordered_items = use_list(props.items.clone());

    fn get_div(target: HtmlElement) -> HtmlElement {
        if target.node_name() != "DIV" {
            return get_div(target.parent_element().unwrap().unchecked_into());
        }
        target
    }

    let toggle_hidden = {
        let cb = props.toggle_hidden.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();

            let input: HtmlElement = e.target_unchecked_into();
            let item = input.id();
            cb.emit(item);
        })
    };

    let rename = {
        let cb = props.rename.clone();
        let label = props.rename_popup_label.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();

            let input: HtmlElement = e.target_unchecked_into();
            let item = input.id();

            if let Some(new_value) =
                prompt(label.as_str(), Some(&item)).filter(|s| !s.trim().is_empty())
            {
                cb.emit((item, new_value.trim().to_owned()));
            }
        })
    };

    let delete = {
        let cb = props.delete.clone();
        let label = props.delete_popup_label.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();
            if confirm(label.as_str()) {
                let input: HtmlElement = e.target_unchecked_into();
                let item = input.id();

                cb.emit(item);
            }
        })
    };

    let ondragstart = {
        let dragging = dragging.clone();
        Callback::from(move |e: DragEvent| {
            let target: HtmlElement = get_div(e.target_unchecked_into());
            *dragging.borrow_mut() = Some(target.clone());
            e.data_transfer()
                .unwrap()
                .set_drag_image(&target, target.client_width() - 20, 0);
            e.data_transfer()
                .unwrap()
                .set_data("text/plain", "hello")
                .unwrap();
        })
    };

    let ondragover = {
        Callback::from(move |e: DragEvent| {
            e.prevent_default();
            let target = get_div(e.target_unchecked_into());
            let rect = target.get_bounding_client_rect();
            let offset = (rect.y() + rect.height() / 2.0)
                .round()
                .rem_euclid(2f64.powi(32)) as u32 as i32;
            if e.client_y() - offset > 0 {
                target
                    .style()
                    .set_property("border-bottom", "solid 4px grey")
                    .unwrap();
                target.style().set_property("border-top", "").unwrap();
            } else {
                target
                    .style()
                    .set_property("border-top", "solid 4px grey")
                    .unwrap();
                target.style().set_property("border-bottom", "").unwrap();
            }
        })
    };

    let ondragleave = {
        Callback::from(move |e: DragEvent| {
            let target: HtmlElement = get_div(e.target_unchecked_into());
            target.style().set_property("border-top", "").unwrap();
            target.style().set_property("border-bottom", "").unwrap();
        })
    };

    let ondrop = {
        let dragging = dragging.clone();
        let ordered = ordered_items.clone();
        let cb = props.reorder.clone();
        Callback::from(move |e: DragEvent| {
            e.prevent_default();
            let target: HtmlElement = get_div(e.target_unchecked_into());
            let dragging = dragging.borrow_mut().take().unwrap();
            let mut moving_below_target = true;
            if !target
                .style()
                .get_property_value("border-bottom")
                .unwrap()
                .is_empty()
            {
                target.style().set_property("border-bottom", "").unwrap();
            } else {
                target.style().set_property("border-top", "").unwrap();
                moving_below_target = false;
            }
            let dragging_idx: usize = dragging.id().parse().unwrap();
            let mut target_idx: usize = target.id().parse().unwrap();

            // When moving _below_ an element, and that element is _above_ the one being dragged,
            // add 1 to target index to indicate it goes below the one we are dropping it onto
            if moving_below_target && target_idx < dragging_idx {
                target_idx += 1;
            }

            // When moving _above_ an element and that element is _above_ the one being dragged
            // take away 1 from target index to indicate it goes above the one we are dropping it onto
            if !moving_below_target && target_idx > dragging_idx {
                target_idx -= 1;
            }

            let p = ordered.remove(dragging_idx);
            ordered.insert(target_idx, p);

            cb.emit(ordered.current().clone());
        })
    };

    ordered_items.clone().current().iter().enumerate().map ( |(idx, item)| html! {
        <div
            ondragstart={ ondragstart.clone() }
            ondrop={ ondrop.clone() }
            ondragover={ ondragover.clone() }
            ondragleave={ ondragleave.clone() }
            class="flex w-full justify-center align-baseline"
            id={ idx.to_string() }
            >
            <label class="flex w-full justify-between whitespace-nowrap mb-6">
                <span>{ item.clone() }</span>
            </label>
            { if props.toggle_hidden_enabled {
                html! {
                <label>
                    <i onclick={ toggle_hidden.clone() }
                        id={ item.clone() }
                        class={ if !props.is_hidden.emit(item.to_owned()) {"icon-eye"} else {"icon-eye-cross"}}
                        />
                </label>
            }} else { html! {}}}
            <label>
                <i onclick={ rename.clone() } id={ item.clone() } class="icon-edit"/>
            </label>
            <label>
                <i onclick={ delete.clone() } id={ item.clone() } class="icon-bin"/>
            </label>
            <label draggable="true" class="touch-none"><i class="icon-bars"></i></label>
        </div>
    }).collect()
}
