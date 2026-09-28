//! Diagram IR — the contract between the Rust backend and the React frontend.
//! Serialized as camelCase JSON; mirrored in `src/shared/types/diagram.ts`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagram {
    pub classes: Vec<ClassNode>,
    pub relations: Vec<Relation>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassNode {
    pub id: String,
    pub name: String,
    /// Extension over the blueprint IR: used for UML stereotypes («interface» etc.).
    #[serde(default)]
    pub kind: ClassKind,
    /// UML-formatted attributes, e.g. `- x: int`.
    pub attributes: Vec<String>,
    /// UML-formatted operations, e.g. `+ calculate(): void`.
    pub methods: Vec<String>,
    pub position: Position,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClassKind {
    #[default]
    Class,
    Struct,
    Interface,
    Enum,
    Union,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Relation {
    pub source: String,
    pub target: String,
    #[serde(rename = "type")]
    pub kind: RelationType,
    /// Edge polyline from source border to target border, computed by the editor's
    /// router (`src/entities/diagram/lib/routing.ts`). Empty = straight line (exporter fallback).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub route: Vec<Point>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

/// `source` is always the dependent side: the child for inheritance,
/// the whole for composition/aggregation, the user for association/dependency.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RelationType {
    Inheritance,
    Realization,
    Composition,
    Aggregation,
    Association,
    Dependency,
}
