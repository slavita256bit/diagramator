# Flowchart prototype

`order.json` is an editable-data copy of the course project's order flowchart.
Coordinates, label widths, and comment dimensions are in millimeters. Nodes use
center coordinates. Route points can refer to a port or shared junction, or
store a bend in page coordinates or relative to a block. Labels can follow a
block port or a branch. Text uses newlines and can include a span with a
different font size. Connector nodes can use matching text for continuation pairs.

`flowchart.typ` renders this model through a caller-supplied `bsuir-core`
block-schemes module. `order-flow.typ` retains the report's `order-flow()` API.
The example assumes `bsuir-core` is a sibling of the Diagramator directory and
Typst's root includes both. To compile the standalone example from Diagramator:

```sh
typst compile --root .. examples/flowcharts/preview.typ target/flowchart-preview.svg
```

In Diagramator, click the app name to switch to the block-scheme workspace.
Choose **Connect ports** to draw a connection. Choose an existing connection
to drag its segments or change its endpoints. New connections use automatic
routing until you edit their segments.

Desktop saves use the same stem for the JSON source and generated Typst file.
The save directory or one of its parents must contain
`bsuir-core/src/block-schemes/lib.typ` for Typst generation. Once the JSON file
has a path, the editor saves committed edits automatically. If compilation
fails, the JSON draft is saved and the previous generated Typst file is kept.
Use **Save as** when either file has changed outside the editor.
