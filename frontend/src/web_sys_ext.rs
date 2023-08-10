//! Navigator#share in web-sys is unstable and
//! requires `--cfg=web_sys_unstable_apis` to be activated,
//! which is inconvenient, so copy the binding code here for now.
#![allow(unused_imports)]
#![allow(clippy::unused_unit)]
use wasm_bindgen::{self, prelude::*};
use web_sys::{DataTransfer, DomRectReadOnly, Element, Event, EventTarget};

#[wasm_bindgen]
extern "C" {
    # [wasm_bindgen (extends = :: js_sys :: Object , js_name = Navigator , typescript_type = "Navigator")]
    #[derive(Debug, Clone, PartialEq, Eq)]
    pub type Navigator;

    #[wasm_bindgen (method , getter, structural , js_class = "Navigator" , js_name = canShare)]
    pub fn can_share(this: &Navigator) -> Option<bool>;

    #[wasm_bindgen (method , getter, structural , js_class = "Navigator" , js_name = canShare)]
    pub fn can_share_with_data(this: &Navigator, data: &ShareData) -> Option<bool>;

    #[wasm_bindgen (method , structural , js_class = "Navigator" , js_name = share)]
    pub fn share(this: &Navigator) -> ::js_sys::Promise;

    #[wasm_bindgen (method , structural , js_class = "Navigator" , js_name = share)]
    pub fn share_with_data(this: &Navigator, data: &ShareData) -> ::js_sys::Promise;
}

#[wasm_bindgen]
extern "C" {
    # [wasm_bindgen (extends = :: js_sys :: Object , js_name = ShareData)]
    #[derive(Debug, Clone, PartialEq, Eq)]
    pub type ShareData;
}
impl ShareData {
    pub fn new() -> Self {
        #[allow(unused_mut)]
        let mut ret: Self = ::wasm_bindgen::JsCast::unchecked_into(::js_sys::Object::new());
        ret
    }
    pub fn files(&mut self, val: &::wasm_bindgen::JsValue) -> &mut Self {
        use wasm_bindgen::JsValue;
        let r = ::js_sys::Reflect::set(self.as_ref(), &JsValue::from("files"), &JsValue::from(val));
        debug_assert!(
            r.is_ok(),
            "setting properties should never fail on our dictionary objects"
        );
        let _ = r;
        self
    }
    pub fn text(&mut self, val: &str) -> &mut Self {
        use wasm_bindgen::JsValue;
        let r = ::js_sys::Reflect::set(self.as_ref(), &JsValue::from("text"), &JsValue::from(val));
        debug_assert!(
            r.is_ok(),
            "setting properties should never fail on our dictionary objects"
        );
        let _ = r;
        self
    }
    pub fn title(&mut self, val: &str) -> &mut Self {
        use wasm_bindgen::JsValue;
        let r = ::js_sys::Reflect::set(self.as_ref(), &JsValue::from("title"), &JsValue::from(val));
        debug_assert!(
            r.is_ok(),
            "setting properties should never fail on our dictionary objects"
        );
        let _ = r;
        self
    }
    pub fn url(&mut self, val: &str) -> &mut Self {
        use wasm_bindgen::JsValue;
        let r = ::js_sys::Reflect::set(self.as_ref(), &JsValue::from("url"), &JsValue::from(val));
        debug_assert!(
            r.is_ok(),
            "setting properties should never fail on our dictionary objects"
        );
        let _ = r;
        self
    }
}

impl Default for ShareData {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
extern "C" {
    # [wasm_bindgen (extends = EventTarget , extends = :: js_sys :: Object , js_name = Window , typescript_type = "Window")]
    #[derive(Debug, Clone, PartialEq, Eq)]
    pub type Window;

    # [wasm_bindgen (structural , method , getter , js_class = "Window" , js_name = navigator)]
    pub fn navigator(this: &Window) -> Navigator;
}

pub fn window() -> Option<Window> {
    use wasm_bindgen::JsCast;

    js_sys::global().dyn_into::<Window>().ok()
}
