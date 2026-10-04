//! Typst exporter: renders a laid-out [`Diagram`] with a [`StyleProfile`] into a
//! standalone `.typ` module exposing `#let diagram(scale: 100%)`.
//!
//! Geometry mirrors the editor exactly: class boxes use the IR position/size,
//! rows have fixed heights from the style, and edges use the same border-clipping
//! as `src/entities/diagram/ui/FloatingEdge.tsx`.

use std::fmt::Write;

use crate::ir::{ClassKind, ClassNode, Diagram, RelationType};
use crate::style::{MemberIconStyle, StyleProfile, TemplateNotation, PX_TO_PT};

/// Self-relation loop size, same as `LOOP` in `FloatingEdge.tsx`.
const LOOP: f64 = 36.0;
/// Space around the drawing so arrowheads, loops and template corner boxes are not clipped.
const MARGIN: f64 = 4.0;
/// Size of the GOST template corner box, same as the one in `UmlClassNode`'s CSS.
const CORNER_W: f64 = 90.0;
const CORNER_H: f64 = 32.0;

/// Member-icon colors by UML visibility (not user-customizable — fixed convention,
/// same table as `measure.ts`/`UmlClassNode.tsx`).
fn visibility_color(symbol: char) -> &'static str {
    match symbol {
        '+' => "#2e7d32",
        '#' => "#ef6c00",
        '-' => "#c62828",
        _ => "#1565c0", // '~' package-private
    }
}

/// Splits a UML member line into its leading visibility symbol and the rest.
fn split_visibility(line: &str) -> (char, &str) {
    let symbol = line.chars().next().unwrap_or('+');
    (symbol, line.get(1..).unwrap_or("").trim_start())
}

/// Splits a `data:image/<mime>;base64,<data>` URI into a file extension and the raw base64
/// payload. `None` for anything not shaped like that.
fn note_image_ext_and_data(data_uri: &str) -> Option<(&str, &str)> {
    let rest = data_uri.strip_prefix("data:image/")?;
    let (mime, rest) = rest.split_once(';')?;
    let b64 = rest.strip_prefix("base64,")?;
    let ext = match mime {
        "jpeg" => "jpg",
        "svg+xml" => "svg",
        other => other,
    };
    Some((ext, b64))
}

/// Path (relative to the Typst output file) `render()` references a note's image at;
/// `write_note_attachments` writes the actual file there.
fn note_image_path(note_id: &str, ext: &str) -> String {
    format!("attachments/{note_id}.{ext}")
}

/// Decodes every note's attached image and writes it next to the Typst output, at the same
/// relative path `render()`'s `image(...)` calls reference. Typst has no inline base64 decode,
/// so (unlike everything else `render()` emits) this needs real file I/O — called by `export_typst`
/// and `ProjectFile::save` right alongside `render()`. Skips (not fails on) malformed images.
pub fn write_note_attachments(dir: &std::path::Path, diagram: &Diagram) -> std::io::Result<()> {
    use base64::Engine;
    for note in &diagram.notes {
        let Some(image) = note.image.as_deref() else { continue };
        let Some((ext, b64)) = note_image_ext_and_data(image) else { continue };
        let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64) else { continue };
        let path = dir.join(note_image_path(&note.id, ext));
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, bytes)?;
    }
    Ok(())
}

/// Separates a member line's trailing `{abstract}`/`{static}` tags from its core text.
fn split_tags(line: &str) -> (&str, &str) {
    line.find(" {").map_or((line, ""), |i| line.split_at(i))
}

/// Applies method-signature verbosity: optionally blanks the parameter list and/or
/// drops the `: ReturnType` suffix. No-op for lines without parens (i.e. attributes).
fn format_method(line: &str, show_params: bool, show_return_type: bool) -> String {
    let (core, tags) = split_tags(line);
    let Some(open) = core.find('(') else { return line.to_owned() };
    let mut depth = 0usize;
    let mut close = None;
    for (i, ch) in core[open..].char_indices() {
        match ch {
            '(' => depth += 1,
            ')' => {
                depth -= 1;
                if depth == 0 {
                    close = Some(open + i);
                    break;
                }
            }
            _ => {}
        }
    }
    let Some(close) = close else { return line.to_owned() };
    let head = &core[..open];
    let params = if show_params { &core[open + 1..close] } else { "" };
    let rest = if show_return_type { &core[close + 1..] } else { "" };
    format!("{head}({params}){rest}{tags}")
}

#[derive(Clone, Copy)]
struct P {
    x: f64,
    y: f64,
}

struct Rect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

impl Rect {
    fn of(p: &crate::ir::Position) -> Self {
        Self { x: p.x, y: p.y, w: p.width, h: p.height }
    }

    /// Point where the line from this rect's center towards `b`'s center leaves this rect.
    fn border_point(&self, b: &Rect) -> P {
        let (cx, cy) = (self.x + self.w / 2.0, self.y + self.h / 2.0);
        let dx = b.x + b.w / 2.0 - cx;
        let dy = b.y + b.h / 2.0 - cy;
        if dx == 0.0 && dy == 0.0 {
            return P { x: cx, y: cy };
        }
        let tx = if dx == 0.0 { f64::INFINITY } else { self.w / 2.0 / dx.abs() };
        let ty = if dy == 0.0 { f64::INFINITY } else { self.h / 2.0 / dy.abs() };
        let t = tx.min(ty);
        P { x: cx + dx * t, y: cy + dy * t }
    }
}

enum Head {
    None,
    HollowTriangle,
    FilledDiamond,
    HollowDiamond,
    OpenArrow,
}

/// UML notation per relation kind: (dashed, head at source, head at target).
/// Must match `EDGE_STYLES` in `src/entities/diagram/lib/toFlow.ts`.
fn notation(kind: RelationType) -> (bool, Head, Head) {
    use RelationType::*;
    match kind {
        Inheritance => (false, Head::None, Head::HollowTriangle),
        Realization => (true, Head::None, Head::HollowTriangle),
        Composition => (false, Head::FilledDiamond, Head::OpenArrow),
        Aggregation => (false, Head::HollowDiamond, Head::OpenArrow),
        Association => (false, Head::None, Head::OpenArrow),
        Dependency => (true, Head::None, Head::OpenArrow),
    }
}

fn stereotype(kind: ClassKind) -> Option<&'static str> {
    match kind {
        ClassKind::Interface => Some("«interface»"),
        ClassKind::Struct => Some("«struct»"),
        ClassKind::Enum => Some("«enumeration»"),
        ClassKind::Union => Some("«union»"),
        ClassKind::Class => None,
    }
}

fn badge(kind: ClassKind) -> &'static str {
    match kind {
        ClassKind::Class => "C",
        ClassKind::Struct => "S",
        ClassKind::Interface => "I",
        ClassKind::Enum => "E",
        ClassKind::Union => "U",
    }
}

fn is_abstract(c: &ClassNode) -> bool {
    c.kind == ClassKind::Interface || c.methods.iter().any(|m| m.contains("{abstract}"))
}

/// Typst string literal.
fn lit(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for ch in s.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\r' => {}
            '\t' => out.push_str("\\t"),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

/// Editor px → Typst length.
fn pt(px: f64) -> String {
    format!("{:.2}pt", px * PX_TO_PT)
}

fn point(p: P, origin: P) -> String {
    format!("({}, {})", pt(p.x - origin.x), pt(p.y - origin.y))
}

pub fn render(diagram: &Diagram, style: &StyleProfile) -> String {
    let s = style;
    let c = &s.colors;
    let fonts: Vec<String> = s
        .font
        .iter()
        .filter(|f| !matches!(f.as_str(), "serif" | "sans-serif" | "monospace"))
        .map(|f| lit(f))
        .collect();
    let stroke = format!("{} + rgb({})", pt(s.border_width), lit(&c.border));
    let edge_stroke = format!("{} + rgb({})", pt(s.edge_width), lit(&c.edge));

    let mut out = String::new();
    let _ = writeln!(
        out,
        "// Generated by Diagramator from style \"{}\" — do not edit, it is overwritten on save.\n\
         // Usage: #import \"diagram.typ\": diagram\n//        #diagram()  or  #diagram(scale: 80%)\n",
        s.name.replace('\n', " ")
    );
    let dash_pattern = format!("({}, {})", pt(s.edge_dash_length), pt(s.edge_dash_gap));
    let dash_stroke = format!(
        "(paint: rgb({}), thickness: {}, dash: {})",
        lit(&c.border),
        pt(s.border_width),
        dash_pattern
    );
    // Shared helpers keep the per-class output small.
    let _ = writeln!(
        out,
        r#"#let _row(body, align-to: left) = block(width: 100%, height: {lh}, inset: (x: {px}), clip: true, align(align-to + horizon, body))
#let _icon(is-circle, fill) = box(baseline: 15%, if is-circle {{ circle(radius: {ir}, fill: rgb(fill)) }} else {{ square(size: {is}, fill: rgb(fill)) }})
#let _member(t, is-static, is-abstract, icon) = _row({{
  if icon != none {{ _icon(icon.at(0), icon.at(1)); h(0.3em) }}
  set text(style: if is-abstract {{ "italic" }} else {{ "normal" }})
  if is-static {{ underline(t) }} else {{ t }}
}})
#let _section(items) = block(width: 100%, inset: (y: {py}), spacing: 0pt, {{
  if items.len() == 0 {{ block(height: {lh}) }}
  for (t, st, ab, icon) in items {{ _member(t, st, ab, icon) }}
}})
#let _badge(letter) = box(baseline: 20%, circle(radius: {br}, fill: rgb({badge}), stroke: {bstroke}, align(center + horizon, text(size: {bsize}, weight: "bold", letter))))
#let _class(x, y, cw, ch, stereo, show-stereo, tmpl-header, name, is-abstract, letter, hide-attrs, attrs, methods) = place(dx: x, dy: y, block(
  width: cw, height: ch, stroke: {stroke}, fill: rgb({fill}), radius: {radius}, clip: true, inset: {bw},
  stack(
    block(width: 100%, fill: rgb({hfill}), inset: (y: {py}), spacing: 0pt, {{
      if tmpl-header != none {{ _row(align-to: center, text(style: "italic", size: {ssize}, tmpl-header)) }}
      if show-stereo and stereo != none {{ _row(align-to: center, text(size: {ssize}, stereo)) }}
      _row(align-to: center, {{
        if letter != none {{ _badge(letter); h(0.3em) }}
        text(size: {nsize}, weight: {weight}, style: if is-abstract {{ "italic" }} else {{ "normal" }}, name)
      }})
    }}),
    if hide-attrs {{ none }} else {{ block(width: 100%, height: {bw}, fill: rgb({border})) }},
    if hide-attrs {{ none }} else {{ _section(attrs) }},
    block(width: 100%, height: {bw}, fill: rgb({border})),
    _section(methods),
  ),
))
#let _corner(x, y, w, h, content) = place(dx: x, dy: y, block(
  width: w, height: h, stroke: {dstroke}, inset: (x: 4pt, y: 2pt),
  align(center + horizon, text(size: {ssize}, content)),
))
#let _note(x, y, w, h, content, img) = place(dx: x, dy: y, block(
  width: w, height: h, stroke: {dstroke}, inset: {px}, clip: true,
  stack(dir: ttb, spacing: {py},
    if img != none {{ box(width: 100%, height: 55%, clip: true, align(center, img)) }},
    text(size: {fsize}, content),
  ),
))
#let _edge(dash, ..pts) = {{
  let pts = pts.pos()
  for i in range(pts.len() - 1) {{
    place(line(start: pts.at(i), end: pts.at(i + 1), stroke: (paint: rgb({edge}), thickness: {ew}, dash: dash)))
  }}
}}
#let _head(filled, ..pts) = place(polygon(fill: if filled {{ rgb({edge}) }} else {{ white }}, stroke: {estroke}, ..pts))
#let _open(a, tip, b) = {{ _edge(none, a, tip); _edge(none, tip, b) }}
"#,
        lh = pt(s.line_height),
        px = pt(s.padding_x),
        py = pt(s.padding_y),
        br = pt(s.line_height * 0.4),
        ir = pt(s.line_height * 0.3),
        is = pt(s.line_height * 0.5),
        badge = lit(&c.badge),
        bstroke = stroke,
        bsize = pt(s.font_size * 0.8),
        fsize = pt(s.font_size),
        stroke = stroke,
        fill = lit(&c.fill),
        hfill = lit(&c.header_fill),
        radius = pt(s.corner_radius),
        ssize = pt(s.stereotype_font_size),
        nsize = pt(s.name_font_size),
        weight = lit(if s.name_bold { "bold" } else { "regular" }),
        edge = lit(&c.edge),
        ew = pt(s.edge_width),
        estroke = edge_stroke,
        bw = pt(s.border_width),
        border = lit(&c.border),
        dstroke = dash_stroke,
    );

    // Everything is drawn relative to the diagram's top-left corner.
    let rects: Vec<Rect> = diagram.classes.iter().map(|c| Rect::of(&c.position)).collect();
    let note_rects: Vec<Rect> = diagram.notes.iter().map(|n| Rect::of(&n.position)).collect();
    let has_loop = |id: &str| diagram.relations.iter().any(|r| r.source == id && r.target == id);
    let is_corner_template = |cls: &ClassNode| {
        s.template_notation == TemplateNotation::Corner && !cls.template_params.is_empty()
    };
    let (mut min, mut max) = (P { x: f64::MAX, y: f64::MAX }, P { x: f64::MIN, y: f64::MIN });
    for (cls, r) in diagram.classes.iter().zip(&rects) {
        let loop_extra = if has_loop(&cls.id) { LOOP + s.arrow_size } else { 0.0 };
        let corner_extra = if is_corner_template(cls) { CORNER_H } else { 0.0 };
        min.x = min.x.min(r.x);
        min.y = min.y.min(r.y - loop_extra.max(corner_extra));
        max.x = max.x.max(r.x + r.w + loop_extra);
        max.y = max.y.max(r.y + r.h);
    }
    for r in &note_rects {
        min.x = min.x.min(r.x);
        min.y = min.y.min(r.y);
        max.x = max.x.max(r.x + r.w);
        max.y = max.y.max(r.y + r.h);
    }
    if diagram.classes.is_empty() && diagram.notes.is_empty() {
        min = P { x: 0.0, y: 0.0 };
        max = min;
    }
    let origin = P { x: min.x - MARGIN, y: min.y - MARGIN };
    let (width, height) = (max.x - min.x + 2.0 * MARGIN, max.y - min.y + 2.0 * MARGIN);

    let _ = writeln!(out, "#let diagram(scale: 100%) = {{");
    let _ = writeln!(
        out,
        "  set text(font: ({}), size: {}, fill: rgb({}), lang: \"ru\")\n  set block(spacing: 0pt)",
        fonts.join(", ") + if fonts.len() == 1 { "," } else { "" },
        pt(s.font_size),
        lit(&c.text)
    );
    let _ = writeln!(out, "  let body = box(width: {}, height: {}, {{", pt(width), pt(height));

    let icon_of = |m: &str| -> String {
        if s.member_icon_style == MemberIconStyle::Text {
            return "none".into();
        }
        let (symbol, _) = split_visibility(m);
        let is_circle = s.member_icon_style == MemberIconStyle::Circle || !m.contains('(');
        format!("({}, {})", is_circle, lit(visibility_color(symbol)))
    };
    for (cls, r) in diagram.classes.iter().zip(&rects) {
        let members = |items: &[String], is_methods: bool| -> String {
            let parts: Vec<String> = items
                .iter()
                .map(|m| {
                    let formatted = if is_methods {
                        format_method(m, s.show_method_params, s.show_method_return_type)
                    } else {
                        m.clone()
                    };
                    let text = if s.member_icon_style == MemberIconStyle::Text {
                        formatted
                    } else {
                        split_visibility(&formatted).1.to_owned()
                    };
                    format!(
                        "({}, {}, {}, {})",
                        lit(&text),
                        m.ends_with("{static}"),
                        m.contains("{abstract}"),
                        icon_of(m)
                    )
                })
                .collect();
            // Trailing comma keeps one-element arrays arrays.
            format!("({}{})", parts.join(", "), if parts.len() == 1 { "," } else { "" })
        };
        let hide_attrs = s.interface_hides_attributes && cls.kind == ClassKind::Interface;
        let tmpl_header = (s.template_notation == TemplateNotation::Header && !cls.template_params.is_empty())
            .then(|| lit(&format!("template<{}>", cls.template_params.join(", "))))
            .unwrap_or_else(|| "none".into());
        let _ = writeln!(
            out,
            "    _class({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})",
            pt(r.x - origin.x),
            pt(r.y - origin.y),
            pt(r.w),
            pt(r.h),
            stereotype(cls.kind).map_or("none".into(), lit),
            s.show_stereotype,
            tmpl_header,
            lit(&cls.name),
            is_abstract(cls),
            if s.kind_badge { lit(badge(cls.kind)) } else { "none".into() },
            hide_attrs,
            members(if cls.attributes_collapsed { &[] } else { &cls.attributes }, false),
            members(if cls.methods_collapsed { &[] } else { &cls.methods }, true),
        );
        if is_corner_template(cls) {
            let _ = writeln!(
                out,
                "    _corner({}, {}, {}, {}, {})",
                pt(r.x + r.w - CORNER_W - origin.x),
                pt(r.y - CORNER_H - origin.y),
                pt(CORNER_W),
                pt(CORNER_H),
                lit(&cls.template_params.join(", ")),
            );
        }
    }

    for (note, r) in diagram.notes.iter().zip(&note_rects) {
        let img_expr = note
            .image
            .as_deref()
            .and_then(note_image_ext_and_data)
            .map(|(ext, _)| format!("image({})", lit(&note_image_path(&note.id, ext))))
            .unwrap_or_else(|| "none".into());
        let _ = writeln!(
            out,
            "    _note({}, {}, {}, {}, {}, {})",
            pt(r.x - origin.x),
            pt(r.y - origin.y),
            pt(r.w),
            pt(r.h),
            lit(&note.text),
            img_expr,
        );
        let Some(linked) = &note.linked_class else { continue };
        let Some(ti) = diagram.classes.iter().position(|c| &c.id == linked) else { continue };
        let dst = &rects[ti];
        let (a, b) = (r.border_point(dst), dst.border_point(r));
        let _ = writeln!(out, "    _edge({}, {}, {})", dash_pattern, point(a, origin), point(b, origin));
    }

    let index = |id: &str| diagram.classes.iter().position(|c| c.id == id);
    for rel in &diagram.relations {
        let (Some(si), Some(ti)) = (index(&rel.source), index(&rel.target)) else {
            continue;
        };
        let (dashed, head_s, head_t) = notation(rel.kind);
        let dash = if dashed { dash_pattern.as_str() } else { "none" };
        let src = &rects[si];
        // Polyline from source to target; heads are drawn at the first/last point.
        let pts: Vec<P> = if rel.route.len() >= 2 {
            rel.route.iter().map(|p| P { x: p.x, y: p.y }).collect()
        } else if si == ti {
            let right = src.x + src.w;
            let start_y = src.y + 24f64.min(src.h / 3.0);
            let end_x = right - 40f64.min(src.w / 4.0);
            vec![
                P { x: right, y: start_y },
                P { x: right + LOOP, y: start_y },
                P { x: right + LOOP, y: src.y - LOOP },
                P { x: end_x, y: src.y - LOOP },
                P { x: end_x, y: src.y },
            ]
        } else {
            let dst = &rects[ti];
            vec![src.border_point(dst), dst.border_point(src)]
        };
        let pts_str: Vec<String> = pts.iter().map(|&p| point(p, origin)).collect();
        let _ = writeln!(out, "    _edge({}, {})", dash, pts_str.join(", "));
        let n = pts.len();
        head(&mut out, &head_t, pts[n - 2], pts[n - 1], s.arrow_size, origin);
        head(&mut out, &head_s, pts[1], pts[0], s.arrow_size, origin);
    }

    let _ = writeln!(out, "  }})");
    let _ = writeln!(out, "  if scale == 100% {{ body }} else {{ std.scale(scale, reflow: true, body) }}");
    let _ = writeln!(out, "}}");
    out
}

/// Arrowhead at `tip`, for a segment arriving from `from`.
fn head(out: &mut String, kind: &Head, from: P, tip: P, size: f64, origin: P) {
    let (dx, dy) = (tip.x - from.x, tip.y - from.y);
    let len = (dx * dx + dy * dy).sqrt();
    if len == 0.0 {
        return;
    }
    let (ux, uy) = (dx / len, dy / len);
    let (nx, ny) = (-uy, ux);
    // Point `back` along the edge and `side` across it, measured from the tip.
    let at = |back: f64, side: f64| point(P { x: tip.x - ux * back + nx * side, y: tip.y - uy * back + ny * side }, origin);
    let l = size;
    let _ = match kind {
        Head::None => Ok(()),
        Head::HollowTriangle => writeln!(out, "    _head(false, {}, {}, {})", point(tip, origin), at(l, l / 2.0), at(l, -l / 2.0)),
        Head::FilledDiamond | Head::HollowDiamond => writeln!(
            out,
            "    _head({}, {}, {}, {}, {})",
            matches!(kind, Head::FilledDiamond),
            point(tip, origin),
            at(l * 0.9, l * 0.4),
            at(l * 1.8, 0.0),
            at(l * 0.9, -l * 0.4)
        ),
        Head::OpenArrow => writeln!(out, "    _open({}, {}, {})", at(l * 0.8, l * 0.4), point(tip, origin), at(l * 0.8, -l * 0.4)),
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ir::{Position, Relation};
    use crate::style::PRESETS;
    use std::path::Path;

    fn sample() -> Diagram {
        let class = |id: &str, name: &str, kind, x, y| ClassNode {
            id: id.into(),
            name: name.into(),
            kind,
            attributes: vec!["- name: \"quoted\" \\ string".into(), "+ count: int {static}".into()],
            methods: vec!["+ area(): double {abstract}".into()],
            template_params: Vec::new(),
            attributes_collapsed: false,
            methods_collapsed: false,
            position: Position { x, y, width: 200.0, height: 120.0 },
        };
        let template_class = ClassNode {
            id: "d".into(),
            name: "Container".into(),
            kind: ClassKind::Class,
            attributes: vec!["- items: T[]".into()],
            methods: vec!["+ add(item: T): void".into()],
            template_params: vec!["T".into()],
            attributes_collapsed: false,
            methods_collapsed: false,
            position: Position { x: 600.0, y: 0.0, width: 200.0, height: 120.0 },
        };
        Diagram {
            classes: vec![
                class("a", "Shape", ClassKind::Interface, 0.0, 0.0),
                class("b", "Circle", ClassKind::Class, 0.0, 250.0),
                class("c", "Точка", ClassKind::Struct, 300.0, 250.0),
                template_class,
            ],
            relations: vec![
                Relation { source: "b".into(), target: "a".into(), kind: RelationType::Realization, route: vec![] },
                Relation { source: "b".into(), target: "c".into(), kind: RelationType::Composition, route: vec![] },
                Relation { source: "c".into(), target: "c".into(), kind: RelationType::Aggregation, route: vec![] },
                Relation {
                    source: "c".into(),
                    target: "a".into(),
                    kind: RelationType::Dependency,
                    // Orthogonal route as the editor's router would produce it.
                    route: vec![
                        crate::ir::Point { x: 400.0, y: 250.0 },
                        crate::ir::Point { x: 400.0, y: 60.0 },
                        crate::ir::Point { x: 200.0, y: 60.0 },
                    ],
                },
            ],
            notes: vec![crate::ir::Note {
                id: "n1".into(),
                text: "Comment for Shape".into(),
                position: Position { x: -220.0, y: 20.0, width: 150.0, height: 90.0 },
                linked_class: Some("a".into()),
                // Minimal 1x1 transparent PNG, to exercise the Typst image.decode() path.
                image: Some(
                    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
                        .into(),
                ),
            }],
        }
    }

    /// Compiles the output with the real `typst` CLI for every preset; skipped if typst is missing.
    #[test]
    fn compiles_with_typst() {
        let typst = std::env::var("TYPST").unwrap_or_else(|_| "typst".into());
        if std::process::Command::new(&typst).arg("--version").output().is_err() {
            eprintln!("typst not found; skipping");
            return;
        }
        // Output is kept for eyeballing: target/typst-preview/<preset>.pdf
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/typst-preview");
        for (name, json) in PRESETS {
            let style = StyleProfile::from_json(json).unwrap();
            let dir = root.join(name);
            std::fs::create_dir_all(&dir).unwrap();
            write_note_attachments(&dir, &sample()).unwrap();
            std::fs::write(dir.join("diagram.typ"), render(&sample(), &style)).unwrap();
            let main = dir.join("main.typ");
            std::fs::write(&main, "#set page(width: auto, height: auto, margin: 10pt)\n#import \"diagram.typ\": diagram\n#diagram()\n#diagram(scale: 50%)\n").unwrap();
            let out = std::process::Command::new(&typst)
                .arg("compile")
                .arg(&main)
                .arg(root.join(format!("{name}.png")))
                .arg("--ppi=110")
                .output()
                .unwrap();
            assert!(out.status.success(), "{name}: {}", String::from_utf8_lossy(&out.stderr));
        }
    }

    #[test]
    fn escapes_strings() {
        assert_eq!(lit(r#"a"b\c"#), r#""a\"b\\c""#);
    }
}
