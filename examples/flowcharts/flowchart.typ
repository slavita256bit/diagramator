// Render the JSON model with a caller-supplied bsuir-core block-schemes module.
// Text is plain text, not executable Typst markup.
#let draw-flowchart(data, blocks) = {
  assert(data.version == 1, message: "Unsupported flowchart version")
  let constructors = (
    terminal: blocks.terminal,
    process: blocks.process,
    predefined: blocks.predefined,
    decision: blocks.decision,
    "input-output": blocks.input-output,
    "loop-start": blocks.loop-start,
    "loop-end": blocks.loop-end,
    connector: blocks.connector,
  )
  let content(body, emphasis: none) = {
    for (index, line) in body.split("\n").enumerate() {
      if index > 0 { linebreak() }
      if emphasis != none and emphasis.text in line {
        for (part, fragment) in line.split(emphasis.text).enumerate() {
          if part > 0 { text(size: emphasis.size * 1pt, emphasis.text) }
          text(fragment)
        }
      } else { text(line) }
    }
  }
  let nodes = (:)
  for item in data.nodes {
    assert(item.id not in nodes, message: "Duplicate node ID: " + item.id)
    let body = content(item.text, emphasis: item.at("emphasis", default: none))
    if "textSize" in item { body = text(size: item.textSize * 1pt, body) }
    nodes.insert(item.id, constructors.at(item.kind)(item.position.x * 1mm, item.position.y * 1mm, body))
  }
  let port-point(point) = blocks.port(nodes.at(point.node), point.side)
  let junctions = (:)
  for item in data.at("junctions", default: ()) {
    let anchor = if "anchor" in item { port-point(item.anchor) } else { (0mm, 0mm) }
    junctions.insert(item.id, (anchor.at(0) + item.position.x * 1mm, anchor.at(1) + item.position.y * 1mm))
  }
  let route-point(point) = {
    if "junction" in point { junctions.at(point.junction) }
    else if "node" in point { port-point(point) }
    else {
      let x = if "alignX" in point { nodes.at(point.alignX).x } else { 0mm }
      let y = if "alignY" in point { nodes.at(point.alignY).y } else { 0mm }
      (x + point.x * 1mm, y + point.y * 1mm)
    }
  }
  // Match the editor's orthogonal resolution while retaining manual points in JSON.
  let route-geometry(points) = {
    let result = (route-point(points.first()),)
    for index in range(1, points.len()) {
      let previous = points.at(index - 1)
      let next = points.at(index)
      let a = route-point(previous)
      let b = route-point(next)
      if a.at(0) != b.at(0) and a.at(1) != b.at(1) {
        if "node" in previous and "node" in next {
          let from-vertical = previous.side in ("top", "bottom")
          let to-vertical = next.side in ("top", "bottom")
          if from-vertical == to-vertical {
            let middle = if from-vertical { (a.at(1) + b.at(1)) / 2 } else { (a.at(0) + b.at(0)) / 2 }
            let first = if from-vertical { (a.at(0), middle) } else { (middle, a.at(1)) }
            let second = if from-vertical { (b.at(0), middle) } else { (middle, b.at(1)) }
            if result.last() != first { result.push(first) }
            if result.last() != second { result.push(second) }
            if result.last() != b { result.push(b) }
            continue
          }
        }
        let vertical = if "node" in previous { previous.side in ("top", "bottom") }
          else if "node" in next { next.side in ("left", "right") } else { true }
        let elbow = if vertical { (a.at(0), b.at(1)) } else { (b.at(0), a.at(1)) }
        if result.last() != elbow { result.push(elbow) }
      }
      if result.last() != b { result.push(b) }
    }
    result
  }
  let items = data.nodes.map(item => nodes.at(item.id))
  let routes = (:)
  for item in data.routes {
    let points = route-geometry(item.points)
    assert(points.len() >= 2, message: "Connection " + item.id + " has coincident points")
    routes.insert(item.id, points)
    items.push(blocks.route(..points, arrow: item.arrow))
  }
  let point-along(points, fraction) = {
    let segments = points.windows(2)
    let distance(segment) = {
      let (a, b) = segment
      calc.abs(b.at(0) - a.at(0)) + calc.abs(b.at(1) - a.at(1))
    }
    let remaining = segments.map(distance).sum() * fraction
    for segment in segments {
      let length = distance(segment)
      if length > 0mm and remaining <= length {
        let (a, b) = segment
        let ratio = remaining / length
        return (a.at(0) + (b.at(0) - a.at(0)) * ratio, a.at(1) + (b.at(1) - a.at(1)) * ratio)
      }
      remaining -= length
    }
    points.last()
  }
  for item in data.labels {
    let anchor = if "anchor" not in item { (0mm, 0mm) }
      else if "along" in item.anchor { point-along(routes.at(item.anchor.route), item.anchor.along) }
      else { route-point(item.anchor) }
    items.push(blocks.label(anchor.at(0) + item.position.x * 1mm, anchor.at(1) + item.position.y * 1mm,
      content(item.text), width: item.width * 1mm))
  }
  for item in data.comments {
    items += blocks.attached-comment(nodes.at(item.node), content(item.text), side: item.side,
      gap: item.gap * 1mm, width: item.width * 1mm, height: item.height * 1mm)
  }
  set text(hyphenate: false)
  blocks.scheme(width: data.canvas.width * 1mm, height: data.canvas.height * 1mm,
    text-size: data.canvas.textSize * 1pt, ..items)
}
