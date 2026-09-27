//! Prints the Diagram IR for a source directory as JSON.
//! Usage: cargo run -p diagram-core --example analyze -- <source-dir> [doxygen-bin]

fn main() {
    let mut args = std::env::args().skip(1);
    let src = args
        .next()
        .expect("usage: analyze <source-dir> [doxygen-bin]");
    let bin = args.next().unwrap_or_else(|| "doxygen".into());
    match diagram_core::analyze_sources(bin.as_ref(), src.as_ref()) {
        Ok(d) => println!("{}", serde_json::to_string_pretty(&d).unwrap()),
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    }
}
