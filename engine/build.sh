cargo build --target wasm32-unknown-unknown
cd libs && \
  cd midi && cargo build --target wasm32-unknown-unknown && \
  cd ../polysynth && cargo build --target wasm32-unknown-unknown --features wasm-bindgen-exports && \
  cd ../spectrum_viz && cargo build --target wasm32-unknown-unknown
