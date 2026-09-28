//! Render diagram IR JSON (stdin) to Typst (stdout), for checking the exporter:
//! `cargo run -p diagram-core --example analyze -- <dir> | cargo run -p diagram-core --example typst -- [style.json] > diagram.typ`
use std::io::Read;

fn main() {
    let mut ir = String::new();
    std::io::stdin().read_to_string(&mut ir).expect("read stdin");
    let diagram: diagram_core::Diagram = serde_json::from_str(&ir).expect("IR JSON on stdin");
    let style = match std::env::args().nth(1) {
        Some(p) => diagram_core::StyleProfile::from_json(&std::fs::read_to_string(p).expect("style file"))
            .expect("style JSON"),
        None => Default::default(),
    };
    print!("{}", diagram_core::typst::render(&diagram, &style));
}
