//! Converts Doxygen XML (`index.xml` + one file per compound) into the Diagram IR.

use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::Path;

use roxmltree::{Document, Node};

use crate::ir::{ClassKind, ClassNode, Diagram, Position, Relation, RelationType};
use crate::{Error, Result};

/// A parsed compound before relations are resolved.
struct Compound {
    id: String,
    kind: ClassKind,
    java: bool,
    /// Qualified name as Doxygen reports it (`ns::Name`).
    qualified: String,
    display_name: String,
    attributes: Vec<String>,
    methods: Vec<String>,
    bases: Vec<String>,
    /// (type text, refids inside it) of every field.
    field_types: Vec<(String, Vec<String>)>,
    /// (type text, refids inside it) of every method return/parameter type.
    signature_types: Vec<(String, Vec<String>)>,
}

/// Parses a Doxygen XML output directory into a Diagram (positions left at zero).
pub fn parse_xml_dir(xml_dir: &Path) -> Result<Diagram> {
    let index_path = xml_dir.join("index.xml");
    let index_src = std::fs::read_to_string(&index_path)?;
    let index = parse_doc(&index_src, &index_path)?;

    let refids: Vec<String> = index
        .descendants()
        .filter(|n| n.has_tag_name("compound"))
        .filter(|n| class_kind(n.attribute("kind").unwrap_or_default()).is_some())
        .filter_map(|n| n.attribute("refid").map(str::to_owned))
        .collect();

    let mut compounds = Vec::with_capacity(refids.len());
    for refid in refids {
        let path = xml_dir.join(format!("{refid}.xml"));
        let src = std::fs::read_to_string(&path)?;
        let doc = parse_doc(&src, &path)?;
        if let Some(def) = doc
            .descendants()
            .find(|n| n.has_tag_name("compounddef") && n.attribute("id") == Some(refid.as_str()))
        {
            if let Some(c) = parse_compound(def) {
                compounds.push(c);
            }
        }
    }
    compounds.sort_by(|a, b| a.qualified.cmp(&b.qualified));
    Ok(build_diagram(compounds))
}

fn parse_doc<'a>(src: &'a str, path: &Path) -> Result<Document<'a>> {
    Document::parse(src).map_err(|source| Error::Xml {
        file: path.display().to_string(),
        source,
    })
}

fn class_kind(kind: &str) -> Option<ClassKind> {
    Some(match kind {
        "class" => ClassKind::Class,
        "struct" => ClassKind::Struct,
        "interface" => ClassKind::Interface,
        "enum" => ClassKind::Enum,
        "union" => ClassKind::Union,
        _ => return None,
    })
}

fn parse_compound(def: Node) -> Option<Compound> {
    let kind = class_kind(def.attribute("kind")?)?;
    let java = def.attribute("language") == Some("Java");
    let qualified = child_text(def, "compoundname");
    let mut display_name = if java {
        qualified.replace("::", ".")
    } else {
        qualified.clone()
    };
    if let Some(tpl) = child(def, "templateparamlist") {
        let params: Vec<String> = children(tpl, "param")
            .map(|p| {
                let decl = child_text(p, "declname");
                if decl.is_empty() {
                    // `class T` / `typename T` → keep only the name.
                    let t = child_text(p, "type");
                    t.rsplit(' ').next().unwrap_or(&t).to_owned()
                } else {
                    decl
                }
            })
            .collect();
        if !params.is_empty() {
            display_name = format!("{display_name}<{}>", params.join(", "));
        }
    }

    let bases = children(def, "basecompoundref")
        .filter_map(|b| b.attribute("refid").map(str::to_owned))
        .collect();

    let mut c = Compound {
        id: def.attribute("id")?.to_owned(),
        kind,
        java,
        qualified,
        display_name,
        attributes: Vec::new(),
        methods: Vec::new(),
        bases,
        field_types: Vec::new(),
        signature_types: Vec::new(),
    };

    for member in children(def, "sectiondef").flat_map(|s| children(s, "memberdef")) {
        match member.attribute("kind") {
            Some("variable") => parse_variable(&mut c, member),
            Some("function") => parse_function(&mut c, member),
            Some("enumvalue") => c.attributes.push(child_text(member, "name")),
            _ => {}
        }
    }
    Some(c)
}

fn parse_variable(c: &mut Compound, m: Node) {
    let name = child_text(m, "name");
    let ty_node = child(m, "type");
    let ty = ty_node.map(normalized_text).unwrap_or_default();
    // Array suffixes etc. (`[10]`) live in argsstring.
    let ty_full = format!("{ty}{}", child_text(m, "argsstring"));

    // Java enum constants are reported as variables with an empty type.
    if c.kind == ClassKind::Enum && ty.is_empty() {
        c.attributes.push(name);
        return;
    }

    let mut line = format!("{} {name}: {ty_full}", visibility(m));
    if is_yes(m, "static") {
        line.push_str(" {static}");
    }
    c.attributes.push(line);
    if let Some(t) = ty_node {
        c.field_types.push((ty_full, refs_in(t)));
    }
}

fn parse_function(c: &mut Compound, m: Node) {
    let name = child_text(m, "name");
    let ty_node = child(m, "type");
    let mut ty = ty_node.map(normalized_text).unwrap_or_default();
    let mut is_abstract = m.attribute("virt") == Some("pure-virtual");
    // Java reports abstract methods as `abstract String`; strip C++ specifiers too.
    loop {
        let Some((kw, rest)) = ty.split_once(' ') else {
            break;
        };
        match kw {
            "abstract" => is_abstract = true,
            "virtual" | "static" | "inline" | "explicit" | "constexpr" | "final" => {}
            _ => break,
        }
        ty = rest.to_owned();
    }

    let mut params = Vec::new();
    for p in children(m, "param") {
        let pty_node = child(p, "type");
        let pty = pty_node.map(normalized_text).unwrap_or_default();
        if let Some(n) = pty_node {
            c.signature_types.push((pty.clone(), refs_in(n)));
        }
        let pname = child_text(p, "declname");
        match (pname.is_empty(), pty.as_str()) {
            (_, "void") | (true, "") => {}
            (true, _) => params.push(pty),
            (false, _) => params.push(format!("{pname}: {pty}")),
        }
    }
    if let Some(n) = ty_node {
        c.signature_types.push((ty.clone(), refs_in(n)));
    }

    let mut line = format!("{} {name}({})", visibility(m), params.join(", "));
    // Constructors/destructors have no return type.
    if !ty.is_empty() {
        line.push_str(": ");
        line.push_str(&ty);
    }
    if is_abstract {
        line.push_str(" {abstract}");
    }
    if is_yes(m, "static") {
        line.push_str(" {static}");
    }
    c.methods.push(line);
}

fn build_diagram(compounds: Vec<Compound>) -> Diagram {
    let kinds: HashMap<&str, ClassKind> =
        compounds.iter().map(|c| (c.id.as_str(), c.kind)).collect();
    let resolver = NameResolver::new(&compounds);

    // Strongest relation per (source, target) pair; BTreeMap keeps output deterministic.
    let mut rels: BTreeMap<(String, String), RelationType> = BTreeMap::new();
    let mut add = |s: &str, t: &str, kind: RelationType| {
        let e = rels.entry((s.to_owned(), t.to_owned())).or_insert(kind);
        if strength(kind) > strength(*e) {
            *e = kind;
        }
    };

    for c in &compounds {
        for base in &c.bases {
            let Some(&base_kind) = kinds.get(base.as_str()) else {
                continue; // external base (e.g. std::exception)
            };
            let kind = if base_kind == ClassKind::Interface && c.kind != ClassKind::Interface {
                RelationType::Realization
            } else {
                RelationType::Inheritance
            };
            add(&c.id, base, kind);
        }
        for (ty, refs) in &c.field_types {
            let kind = if c.java || is_indirect(ty) {
                RelationType::Association
            } else {
                RelationType::Composition
            };
            for target in resolver.resolve(ty, refs) {
                add(&c.id, target, kind);
            }
        }
        for (ty, refs) in &c.signature_types {
            for target in resolver.resolve(ty, refs) {
                if target != c.id {
                    add(&c.id, target, RelationType::Dependency);
                }
            }
        }
    }

    let relations = rels
        .into_iter()
        .map(|((source, target), kind)| Relation {
            source,
            target,
            kind,
        })
        .collect();

    let classes = compounds
        .into_iter()
        .map(|c| ClassNode {
            id: c.id,
            name: c.display_name,
            kind: c.kind,
            attributes: c.attributes,
            methods: c.methods,
            position: Position::default(),
        })
        .collect();

    Diagram { classes, relations }
}

/// Relations between the same pair collapse to the strongest one
/// (e.g. inheritance hides the dependency implied by an overridden signature).
fn strength(k: RelationType) -> u8 {
    match k {
        RelationType::Inheritance | RelationType::Realization => 10,
        RelationType::Composition => 4,
        RelationType::Aggregation => 3,
        RelationType::Association => 2,
        RelationType::Dependency => 1,
    }
}

/// Pointer, reference or shared ownership → the member doesn't own the target.
fn is_indirect(ty: &str) -> bool {
    ty.contains('*')
        || ty.contains('&')
        || ty.contains("shared_ptr")
        || ty.contains("weak_ptr")
        || ty.contains("observer_ptr")
}

/// Resolves class ids referenced by a type, using Doxygen `<ref>`s when present and
/// falling back to identifier matching (Doxygen often omits refs for Java).
struct NameResolver<'a> {
    by_qualified: HashMap<String, &'a str>,
    /// Short name → id, `None` when the short name is ambiguous.
    by_short: HashMap<&'a str, Option<&'a str>>,
    ids: HashSet<&'a str>,
}

impl<'a> NameResolver<'a> {
    fn new(compounds: &'a [Compound]) -> Self {
        let mut by_qualified = HashMap::new();
        let mut by_short: HashMap<&str, Option<&str>> = HashMap::new();
        for c in compounds {
            by_qualified.insert(c.qualified.clone(), c.id.as_str());
            by_qualified.insert(c.qualified.replace("::", "."), c.id.as_str());
            let short = c.qualified.rsplit("::").next().unwrap_or(&c.qualified);
            by_short
                .entry(short)
                .and_modify(|v| *v = None)
                .or_insert(Some(c.id.as_str()));
        }
        Self {
            by_qualified,
            by_short,
            ids: compounds.iter().map(|c| c.id.as_str()).collect(),
        }
    }

    fn resolve(&self, ty: &str, refs: &[String]) -> Vec<&'a str> {
        let mut out: Vec<&'a str> = refs
            .iter()
            .filter_map(|r| self.ids.get(r.as_str()).copied())
            .collect();
        for token in ty
            .split(|ch: char| !(ch.is_alphanumeric() || ch == '_' || ch == ':' || ch == '.'))
            .map(|t| t.trim_matches([':', '.']))
            .filter(|t| !t.is_empty())
        {
            let hit = self.by_qualified.get(token).copied().or_else(|| {
                let short = token.rsplit([':', '.']).next().unwrap_or(token);
                self.by_short.get(short).copied().flatten()
            });
            out.extend(hit);
        }
        out.sort_unstable();
        out.dedup();
        out
    }
}

fn visibility(m: Node) -> char {
    match m.attribute("prot") {
        Some("protected") => '#',
        Some("private") => '-',
        Some("package") => '~',
        _ => '+',
    }
}

fn is_yes(n: Node, attr: &str) -> bool {
    n.attribute(attr) == Some("yes")
}

fn child<'a, 'i>(n: Node<'a, 'i>, tag: &str) -> Option<Node<'a, 'i>> {
    n.children().find(|c| c.has_tag_name(tag))
}

fn children<'a, 'i: 'a>(n: Node<'a, 'i>, tag: &'a str) -> impl Iterator<Item = Node<'a, 'i>> + 'a {
    n.children().filter(move |c| c.has_tag_name(tag))
}

fn child_text(n: Node, tag: &str) -> String {
    child(n, tag).map(normalized_text).unwrap_or_default()
}

/// All descendant text with whitespace collapsed and Doxygen's spacing
/// (`List< Toy >`, `Canvas *`) tightened to `List<Toy>`, `Canvas*`.
fn normalized_text(n: Node) -> String {
    let raw: String = n
        .descendants()
        .filter(|d| d.is_text())
        .filter_map(|d| d.text())
        .collect();
    raw.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .replace("< ", "<")
        .replace(" >", ">")
        .replace(" *", "*")
        .replace(" &", "&")
}

fn refs_in(n: Node) -> Vec<String> {
    n.descendants()
        .filter(|d| d.has_tag_name("ref"))
        .filter_map(|d| d.attribute("refid").map(str::to_owned))
        .collect()
}
