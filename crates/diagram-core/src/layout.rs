//! Initial auto-layout: sizes each class box from its contents and arranges
//! classes in layers so that base classes sit above their descendants.

use std::collections::HashMap;

use crate::ir::{Diagram, RelationType};

// Rough metrics matching the frontend's monospace class node.
const CHAR_WIDTH: f64 = 7.2;
const LINE_HEIGHT: f64 = 18.0;
const HEADER_HEIGHT: f64 = 40.0;
const SECTION_PADDING: f64 = 8.0;
const H_PADDING: f64 = 24.0;
const MIN_WIDTH: f64 = 140.0;
const MAX_WIDTH: f64 = 420.0;
const H_GAP: f64 = 60.0;
const V_GAP: f64 = 100.0;
/// Wrap very wide layers into rows of at most this many classes.
const MAX_PER_ROW: usize = 8;

pub fn auto_layout(diagram: &mut Diagram) {
    for c in &mut diagram.classes {
        let longest = std::iter::once(c.name.len() + 4)
            .chain(c.attributes.iter().map(|s| s.chars().count()))
            .chain(c.methods.iter().map(|s| s.chars().count()))
            .max()
            .unwrap_or(0);
        c.position.width = (longest as f64 * CHAR_WIDTH + H_PADDING).clamp(MIN_WIDTH, MAX_WIDTH);
        let lines = c.attributes.len().max(1) + c.methods.len().max(1);
        c.position.height = HEADER_HEIGHT + lines as f64 * LINE_HEIGHT + 2.0 * SECTION_PADDING;
    }

    let layers = layer_of_each(diagram);
    let max_layer = layers.iter().copied().max().unwrap_or(0);
    let mut y = 0.0;
    for layer in 0..=max_layer {
        let members: Vec<usize> = (0..diagram.classes.len())
            .filter(|&i| layers[i] == layer)
            .collect();
        for row in members.chunks(MAX_PER_ROW) {
            let mut x = 0.0;
            let mut row_height: f64 = 0.0;
            for &i in row {
                let p = &mut diagram.classes[i].position;
                p.x = x;
                p.y = y;
                x += p.width + H_GAP;
                row_height = row_height.max(p.height);
            }
            y += row_height + V_GAP;
        }
    }
}

/// Longest-path layering over generalization edges (child one layer below parent).
fn layer_of_each(diagram: &Diagram) -> Vec<usize> {
    let index: HashMap<&str, usize> = diagram
        .classes
        .iter()
        .enumerate()
        .map(|(i, c)| (c.id.as_str(), i))
        .collect();
    let edges: Vec<(usize, usize)> = diagram
        .relations
        .iter()
        .filter(|r| {
            matches!(
                r.kind,
                RelationType::Inheritance | RelationType::Realization
            )
        })
        .filter_map(|r| {
            Some((
                *index.get(r.target.as_str())?,
                *index.get(r.source.as_str())?,
            ))
        })
        .collect();

    let n = diagram.classes.len();
    let mut layer = vec![0usize; n];
    // Bellman-Ford style relaxation; bounded by n rounds so cycles can't loop forever.
    for _ in 0..n {
        let mut changed = false;
        for &(parent, child) in &edges {
            if layer[child] < layer[parent] + 1 && layer[parent] + 1 < n {
                layer[child] = layer[parent] + 1;
                changed = true;
            }
        }
        if !changed {
            break;
        }
    }
    layer
}
