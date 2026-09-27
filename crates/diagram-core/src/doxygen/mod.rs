//! Doxygen integration: running the tool and parsing its XML output.

mod parser;
mod runner;

pub use parser::parse_xml_dir;
pub use runner::{doxygen_version, run_doxygen, DoxygenOutput};
