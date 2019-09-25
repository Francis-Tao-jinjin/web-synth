//! Defines a view that allows creating and customizing a synthesizer

use serde_json;
use uuid::Uuid;

use crate::{helpers::grid::prelude::*, view_context::ViewContext};

/// This is just a shim to the JS-based synth designer.  Since there really aren't any complicated
/// interactive or graphical components of this view context, the actual implementation for this
/// is done in JS.
#[derive(Serialize, Deserialize)]
pub struct SynthDesigner {
    pub uuid: Uuid,
}

impl SynthDesigner {
    pub fn new(uuid: Uuid) -> Self { SynthDesigner { uuid } }

    pub fn get_state_key(&self) -> String { format!("synthDseigner{}", self.uuid) }
}

impl ViewContext for SynthDesigner {
    fn init(&mut self) { js::init_synth_designer(&self.get_state_key()); }

    fn cleanup(&mut self) { js::cleanup_synth_designer(&self.get_state_key()); }

    fn dispose(&mut self) { js::delete_localstorage_key(&self.get_state_key()); }

    fn save(&mut self) -> String {
        serde_json::to_string(self).expect("Error serializing `SynthDesigner` to String")
    }
}

pub fn mk_synth_designer(definition_opt: Option<&str>, uuid: Uuid) -> Box<dyn ViewContext> {
    let synt_designer: SynthDesigner = match definition_opt {
        Some(definition) =>
            serde_json::from_str(definition).expect("Error while deserializing `SynthDesigner`"),
        None => SynthDesigner::new(uuid),
    };
    Box::new(synt_designer)
}
