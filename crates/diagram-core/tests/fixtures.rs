//! End-to-end tests: run the real `doxygen` on the fixtures and check the IR.
//! Skipped (with a note) when Doxygen isn't installed.

use std::path::{Path, PathBuf};

use diagram_core::{analyze_sources, ClassKind, Diagram, RelationType};

fn doxygen() -> Option<PathBuf> {
    let bin = PathBuf::from(std::env::var("DOXYGEN").unwrap_or_else(|_| "doxygen".into()));
    diagram_core::doxygen::doxygen_version(&bin)
        .ok()
        .map(|_| bin)
}

fn analyze(fixture: &str) -> Option<Diagram> {
    let Some(bin) = doxygen() else {
        eprintln!("doxygen not found; skipping");
        return None;
    };
    let dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures")
        .join(fixture);
    Some(analyze_sources(&bin, &dir).expect("analysis succeeds"))
}

fn id_of<'a>(d: &'a Diagram, name: &str) -> &'a str {
    &d.classes
        .iter()
        .find(|c| c.name == name)
        .unwrap_or_else(|| panic!("no class {name}"))
        .id
}

fn has(d: &Diagram, src: &str, dst: &str, kind: RelationType) -> bool {
    let (s, t) = (id_of(d, src), id_of(d, dst));
    d.relations
        .iter()
        .any(|r| r.source == s && r.target == t && r.kind == kind)
}

#[test]
fn cpp_classes_and_relations() {
    let Some(d) = analyze("cpp") else { return };
    let names: Vec<_> = d.classes.iter().map(|c| c.name.as_str()).collect();
    assert_eq!(
        names,
        [
            "geo::Box",
            "geo::Canvas",
            "geo::Circle",
            "geo::Point",
            "geo::Rect",
            "geo::Shape"
        ]
    );

    // Template params are a separate field, not baked into the display name.
    let b = d.classes.iter().find(|c| c.name == "geo::Box").unwrap();
    assert_eq!(b.template_params, vec!["T".to_string()]);

    let circle = d.classes.iter().find(|c| c.name == "geo::Circle").unwrap();
    assert!(circle.attributes.contains(&"- radius_: double".to_string()));
    assert!(circle
        .methods
        .contains(&"+ Circle(center: Point, radius: double)".to_string()));
    assert!(circle
        .methods
        .contains(&"+ count(): int {static}".to_string()));
    let shape = d.classes.iter().find(|c| c.name == "geo::Shape").unwrap();
    assert!(shape
        .methods
        .contains(&"+ area(): double {abstract}".to_string()));
    assert_eq!(
        d.classes
            .iter()
            .find(|c| c.name == "geo::Point")
            .unwrap()
            .kind,
        ClassKind::Struct
    );

    assert!(has(
        &d,
        "geo::Circle",
        "geo::Shape",
        RelationType::Inheritance
    ));
    assert!(has(
        &d,
        "geo::Rect",
        "geo::Shape",
        RelationType::Inheritance
    ));
    assert!(has(
        &d,
        "geo::Circle",
        "geo::Point",
        RelationType::Composition
    ));
    assert!(has(
        &d,
        "geo::Canvas",
        "geo::Shape",
        RelationType::Composition
    ));
    assert!(has(
        &d,
        "geo::Canvas",
        "geo::Canvas",
        RelationType::Association
    ));

    // Base classes are laid out above derived ones.
    let y = |n: &str| d.classes.iter().find(|c| c.name == n).unwrap().position.y;
    assert!(y("geo::Shape") < y("geo::Circle"));
    assert!(d
        .classes
        .iter()
        .all(|c| c.position.width > 0.0 && c.position.height > 0.0));
}

#[test]
fn java_classes_and_relations() {
    let Some(d) = analyze("java") else { return };
    let animal = d.classes.iter().find(|c| c.name == "zoo.Animal").unwrap();
    assert_eq!(animal.kind, ClassKind::Interface);
    let dog = d.classes.iter().find(|c| c.name == "zoo.Dog").unwrap();
    assert!(dog.attributes.contains(&"# toys: List<Toy>".to_string()));
    assert!(dog
        .methods
        .contains(&"~ fetch(toy: Toy, times: int): void".to_string()));
    let pet = d.classes.iter().find(|c| c.name == "zoo.Pet").unwrap();
    assert!(pet
        .methods
        .contains(&"+ sound(): String {abstract}".to_string()));

    assert!(has(&d, "zoo.Dog", "zoo.Pet", RelationType::Inheritance));
    assert!(has(&d, "zoo.Dog", "zoo.Animal", RelationType::Realization));
    assert!(has(&d, "zoo.Dog", "zoo.Toy", RelationType::Association));
    assert!(has(&d, "zoo.Pet", "zoo.Owner", RelationType::Association));
}

#[test]
fn ir_json_shape_matches_blueprint() {
    let Some(d) = analyze("cpp") else { return };
    let v = serde_json::to_value(&d).unwrap();
    let c = &v["classes"][0];
    for key in ["id", "name", "attributes", "methods", "position"] {
        assert!(c.get(key).is_some(), "missing {key}");
    }
    for key in ["x", "y", "width", "height"] {
        assert!(c["position"].get(key).is_some(), "missing position.{key}");
    }
    let r = &v["relations"][0];
    for key in ["source", "target", "type"] {
        assert!(r.get(key).is_some(), "missing relation.{key}");
    }
}

#[test]
fn relative_source_path_is_resolved() {
    let Some(bin) = doxygen() else { return };
    // Cargo runs integration tests with the package root as cwd.
    let d = analyze_sources(&bin, Path::new("tests/fixtures/java")).unwrap();
    assert_eq!(d.classes.len(), 5);
}
