use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::{Error, Result};

const FILE_PATTERNS: &str =
    "*.h *.hh *.hpp *.hxx *.h++ *.ipp *.tpp *.c *.cc *.cpp *.cxx *.c++ *.java";
const EXCLUDE_PATTERNS: &str =
    "*/.git/* */node_modules/* */build/* */cmake-build-* */target/* */out/*";

/// Doxygen output living in a temp directory; removed when dropped.
pub struct DoxygenOutput {
    dir: tempfile::TempDir,
}

impl DoxygenOutput {
    pub fn xml_dir(&self) -> PathBuf {
        self.dir.path().join("xml")
    }
}

/// Returns the `doxygen --version` string, or an error if the binary can't be run.
pub fn doxygen_version(doxygen_bin: &Path) -> Result<String> {
    let out = Command::new(doxygen_bin)
        .arg("--version")
        .output()
        .map_err(|e| Error::DoxygenNotFound(format!("{}: {e}", doxygen_bin.display())))?;
    if !out.status.success() {
        return Err(Error::DoxygenNotFound(doxygen_bin.display().to_string()));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Runs Doxygen over `source_dir` (recursively) producing XML only.
/// The Doxyfile is generated on the fly and piped via stdin (`doxygen -`).
pub fn run_doxygen(doxygen_bin: &Path, source_dir: &Path) -> Result<DoxygenOutput> {
    if !source_dir.is_dir() {
        return Err(Error::InvalidInput(format!(
            "not a directory: {}",
            source_dir.display()
        )));
    }
    // Doxygen runs inside the temp dir, so relative inputs must be made absolute.
    let source_dir = std::path::absolute(source_dir)?;
    let dir = tempfile::Builder::new().prefix("diagramator-").tempdir()?;
    let doxyfile = doxyfile(&source_dir, dir.path());

    let mut child = Command::new(doxygen_bin)
        .arg("-")
        .current_dir(dir.path())
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| Error::DoxygenNotFound(format!("{}: {e}", doxygen_bin.display())))?;
    child
        .stdin
        .take()
        .expect("stdin is piped")
        .write_all(doxyfile.as_bytes())?;
    let out = child.wait_with_output()?;
    if !out.status.success() {
        return Err(Error::DoxygenFailed {
            code: out.status.code(),
            stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
        });
    }
    Ok(DoxygenOutput { dir })
}

fn doxyfile(input: &Path, output: &Path) -> String {
    let q = |p: &Path| format!("\"{}\"", p.display().to_string().replace('"', "\\\""));
    format!(
        r#"INPUT                  = {input}
OUTPUT_DIRECTORY       = {output}
RECURSIVE              = YES
FILE_PATTERNS          = {FILE_PATTERNS}
EXCLUDE_PATTERNS       = {EXCLUDE_PATTERNS}
EXTRACT_ALL            = YES
EXTRACT_PRIVATE        = YES
EXTRACT_PACKAGE        = YES
EXTRACT_STATIC         = YES
EXTRACT_LOCAL_CLASSES  = YES
EXTRACT_ANON_NSPACES   = YES
GENERATE_XML           = YES
XML_PROGRAMLISTING     = NO
GENERATE_HTML          = NO
GENERATE_LATEX         = NO
GENERATE_RTF           = NO
GENERATE_MAN           = NO
HAVE_DOT               = NO
CLASS_GRAPH            = NO
COLLABORATION_GRAPH    = NO
SOURCE_BROWSER         = NO
QUIET                  = YES
WARNINGS               = NO
WARN_IF_UNDOCUMENTED   = NO
"#,
        input = q(input),
        output = q(output),
    )
}
