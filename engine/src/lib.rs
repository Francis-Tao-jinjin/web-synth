#![feature(
    box_syntax,
    test,
    slice_patterns,
    thread_local,
    nll,
    bind_by_move_pattern_guards
)]
#![allow(clippy::float_cmp, clippy::needless_range_loop, clippy::manual_memcpy)]

extern crate base64;
extern crate bincode;
extern crate common;
extern crate fnv;
extern crate rand;
extern crate rand_pcg;
extern crate serde;
extern crate slab;
extern crate test;
extern crate wasm_bindgen;
#[macro_use]
extern crate serde_derive;

use std::ptr;

use wasm_bindgen::prelude::*;

pub mod constants;
pub mod helpers;
pub mod js;
pub mod prelude;
pub mod synth;
pub mod util;
pub mod view_context;
pub mod views;
use self::prelude::*;

static mut VIEW_CONTEXT_MANAGER: *mut ViewContextManager = ptr::null_mut();

/// Entrypoint for the application.  This function is called from the JS side as soon as the Wasm
/// blob is loaded.  It handles setting up application state, rendering the initial UI, and loading
/// the last saved composition from the user.
#[wasm_bindgen]
pub fn init() {
    common::set_panic_hook();

    let view = view_context::manager::build_view("midi_editor", "TODO");
    let mut vcm = box ViewContextManager::default();
    vcm.add_view(view);
    vcm.init();
    unsafe { VIEW_CONTEXT_MANAGER = Box::into_raw(vcm) };
}
