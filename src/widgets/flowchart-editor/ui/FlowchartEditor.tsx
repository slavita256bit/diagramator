import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Alert, AppBar, Box, Button, Checkbox, FormControlLabel, IconButton, ListItemText, Menu, MenuItem, Stack, TextField, Toolbar, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { Flowchart, FlowchartLabel, FlowchartNode, FlowchartNodeKind, FlowchartPoint, FlowchartRoute } from "@/shared/types";
import example from "../../../../examples/flowcharts/order.json";
import { canvasPoint, commentBounds, connectPorts, dimensions, labelAnchor, labelPosition, moveBlock, nearestSegment, parseFlowchart, placeNewBlock, PORT_SIDES, resolvePoint, routeFraction, routeGeometry, shiftSegment, snapBlock, type Port } from "../model/flowchart";
import { passesThroughObstacle, resolvedRoutes } from "../model/resolvedGeometry";
import { commentHeight, fontMillimeters, lineHeight, wrapText } from "../model/textLayout";
import { useFlowchartFiles } from "../model/useFlowchartFiles";
import { useCanvasZoom } from "./useCanvasZoom";

const kinds: FlowchartNodeKind[] = ["terminal", "process", "predefined", "decision", "input-output", "loop-start", "loop-end", "connector"];
const initial = () => parseFlowchart(JSON.stringify(example));
const id = () => crypto.randomUUID();
type Selection = { kind: "node" | "label" | "comment" | "route"; id: string };

function Block({ node, selected, size }: { node: FlowchartNode; selected: boolean; size: number }) {
  size = node.textSize ?? size;
  const { width: w, height: h } = dimensions(node);
  const fill = selected ? "#e8f2ff" : "white";
  const shape = node.kind === "decision" ? <polygon points={`0,${-h / 2} ${w / 2},0 0,${h / 2} ${-w / 2},0`} />
    : node.kind === "input-output" ? <polygon points={`${-w / 2 + h / 2},${-h / 2} ${w / 2},${-h / 2} ${w / 2 - h / 2},${h / 2} ${-w / 2},${h / 2}`} />
      : node.kind === "connector" ? <circle r={5} />
        : node.kind === "loop-start" ? <polygon points={`${-w / 2 + 3},${-h / 2} ${w / 2 - 3},${-h / 2} ${w / 2},${-h / 2 + 3} ${w / 2},${h / 2} ${-w / 2},${h / 2} ${-w / 2},${-h / 2 + 3}`} />
          : node.kind === "loop-end" ? <polygon points={`${-w / 2},${-h / 2} ${w / 2},${-h / 2} ${w / 2},${h / 2 - 3} ${w / 2 - 3},${h / 2} ${-w / 2 + 3},${h / 2} ${-w / 2},${h / 2 - 3}`} />
            : <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={node.kind === "terminal" ? 5 : 0} />;
  const textWidth = node.kind === "decision" || node.kind === "input-output" ? w / 2 : w - (node.kind === "predefined" ? 8 : 4);
  const lines = wrapText(node.text, size, textWidth);
  return <g transform={`translate(${node.position.x} ${node.position.y})`} style={{ cursor: "move" }}>
    <g fill={fill} stroke={selected ? "#1976d2" : "#222"} strokeWidth="0.25">{shape}
      {node.kind === "predefined" && <path d={`M ${-w / 2 + 3} ${-h / 2} v ${h} M ${w / 2 - 3} ${-h / 2} v ${h}`} />}
    </g>
    <text textAnchor="middle" dominantBaseline="middle" fontFamily="Arial, sans-serif" fontSize={fontMillimeters(size)} fill="#111" stroke="none" pointerEvents="none">
      {lines.map((line, i) => <tspan key={i} x="0" y={(i - (lines.length - 1) / 2) * lineHeight(size)}>
        {node.emphasis && line.includes(node.emphasis.text)
          ? line.split(node.emphasis.text).map((part, index) => <tspan key={index}>
            {index > 0 && <tspan fontSize={fontMillimeters(node.emphasis!.size)}>{node.emphasis!.text}</tspan>}{part}
          </tspan>) : line}
      </tspan>)}
    </text>
  </g>;
}

export function FlowchartEditor({ active, onSwitchMode }: { active: boolean; onSwitchMode: () => void }) {
  const [chart, setChart] = useState<Flowchart>(initial);
  const [committed, setCommitted] = useState(chart);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [error, setError] = useState("");
  const [addMenu, setAddMenu] = useState<HTMLElement | null>(null);
  const [recentMenu, setRecentMenu] = useState<HTMLElement | null>(null);
  const [connection, setConnection] = useState<{ from?: Port; reconnect?: { route: FlowchartRoute; end: number } } | null>(null);
  const [hoverPort, setHoverPort] = useState<Port | null>(null);
  const [guides, setGuides] = useState<Partial<FlowchartPoint>>({});
  const svg = useRef<SVGSVGElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const inspector = useRef<HTMLDivElement>(null);
  const selectedBlock = useRef<SVGGElement>(null);
  const revealBlock = useRef<string | null>(null);
  const drag = useRef<{ pointer: number; offset: FlowchartPoint; original: FlowchartPoint; draft: Flowchart | null;
    update: (position: FlowchartPoint) => Flowchart } | null>(null);
  const [history, setHistory] = useState<{ past: Flowchart[]; future: Flowchart[] }>({ past: [], future: [] });
  const historyRef = useRef(history);
  const chartRef = useRef(chart);
  const cancelGesture = () => {
    if (!drag.current) return;
    drag.current = null;
    setGuides({});
    setChart(chartRef.current);
  };
  const zoom = useCanvasZoom(active, viewport, svg, cancelGesture);
  const commit = (next: Flowchart) => {
    const updated = { past: [...historyRef.current.past, chartRef.current].slice(-50), future: [] };
    historyRef.current = updated;
    setHistory(updated);
    chartRef.current = next;
    setChart(next);
    setCommitted(next);
  };
  const undo = (redo: boolean) => {
    cancelGesture();
    const h = historyRef.current;
    const from = redo ? h.future : h.past;
    const next = from.at(-1);
    if (!next) return;
    setConnection(null);
    setHoverPort(null);
    const current = chartRef.current;
    chartRef.current = next;
    setChart(next);
    setCommitted(next);
    const updated = redo ? { past: [...h.past, current], future: from.slice(0, -1) }
      : { past: from.slice(0, -1), future: [...h.future, current] };
    historyRef.current = updated;
    setHistory(updated);
  };
  const files = useFlowchartFiles(committed, (next) => {
    drag.current = null;
    chartRef.current = next;
    setChart(next);
    setCommitted(next);
    setSelected(null);
    setConnection(null);
    setError("");
    historyRef.current = { past: [], future: [] };
    setHistory(historyRef.current);
  });
  const save = files.save;
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const element = event.target instanceof HTMLElement ? event.target : null;
      const isTextField = element?.matches("input, textarea") || element?.isContentEditable;
      const menuOpen = !!(addMenu || recentMenu || element?.closest("[role='menu'], [role='listbox'], [role='dialog']"));
      if (event.key === "Escape" && !menuOpen) {
        cancelGesture();
        setConnection(null);
        setHoverPort(null);
        setSelected(null);
        return;
      }
      if (event.key === "Delete" && !isTextField && !menuOpen && selected) {
        event.preventDefault();
        if (!event.repeat) deleteSelected(selected);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!event.repeat) void save();
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z" || event.altKey) return;
      // Inspector controls commit directly into document history.
      if (isTextField && !inspector.current?.contains(element)) return;
      event.preventDefault();
      undo(event.shiftKey);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [active, save, selected, addMenu, recentMenu]);
  const at = (event: PointerEvent<SVGElement>) =>
    canvasPoint(svg.current?.getScreenCTM(), { x: event.clientX, y: event.clientY });
  const begin = (event: PointerEvent<SVGElement>, selection: Selection, position: FlowchartPoint, update: (position: FlowchartPoint) => Flowchart) => {
    if (event.button !== 0 || event.isPrimary === false || drag.current) return;
    event.stopPropagation();
    viewport.current?.focus({ preventScroll: true });
    setSelected(selection);
    if (connection) return;
    const point = at(event);
    if (!point) return;
    drag.current = { pointer: event.pointerId, offset: { x: position.x - point.x, y: position.y - point.y }, original: position, draft: null, update };
    svg.current?.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointer !== event.pointerId) return;
    const { offset, original, update } = drag.current;
    const point = at(event);
    if (!point) return;
    const delta = { x: point.x + offset.x - original.x, y: point.y + offset.y - original.y };
    const position = { x: original.x + Math.round(delta.x * 10) / 10, y: original.y + Math.round(delta.y * 10) / 10 };
    const previous = chartRef.current;
    if (Math.hypot(delta.x, delta.y) < 0.5) setGuides({});
    const draft = Math.hypot(delta.x, delta.y) < 0.5 ? null : update(position);
    drag.current.draft = draft;
    setChart(draft ?? previous);
  };
  const end = (event: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointer !== event.pointerId) return;
    const { draft } = drag.current;
    drag.current = null;
    setGuides({});
    if (draft && draft !== chartRef.current) commit(draft);
  };
  const cancelDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointer !== event.pointerId) return;
    cancelGesture();
  };
  const node = selected?.kind === "node" ? chart.nodes.find((n) => n.id === selected.id) : undefined;
  const label = selected?.kind === "label" ? chart.labels.find((n) => n.id === selected.id) : undefined;
  const comment = selected?.kind === "comment" ? chart.comments.find((n) => n.id === selected.id) : undefined;
  const route = selected?.kind === "route" ? chart.routes.find((n) => n.id === selected.id) : undefined;
  const geometry = useMemo(() => resolvedRoutes(chart), [chart]);
  const invalidRoutes = chart.routes.filter((r) => geometry.get(r.id)!.length < 2);
  const selectedPoints = route ? geometry.get(route.id)! : [];
  const updateNode = (patch: Partial<FlowchartNode>) => node && commit({ ...chart, nodes: chart.nodes.map((n) => n.id === node.id ? { ...n, ...patch } : n) });
  const updateRoute = (next: FlowchartRoute) => commit({ ...chart, routes: chart.routes.map((item) => item.id === next.id ? next : item) });
  const beginSegmentDrag = (event: PointerEvent<SVGElement>, route: FlowchartRoute, points: FlowchartPoint[], index: number) => {
    const a = points[index], b = points[index + 1];
    if (!a || !b) return;
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const axis = a.y === b.y ? "y" : "x";
    begin(event, { kind: "route", id: route.id }, center, (position) => {
      const previous = chartRef.current;
      if (Math.abs(position[axis] - center[axis]) < 0.5) return previous;
      return { ...previous, routes: previous.routes.map((item) =>
        item.id === route.id ? shiftSegment(previous, item, points, index, position) : item) };
    });
  };
  const addBlock = (kind: FlowchartNodeKind) => {
    setAddMenu(null);
    const canvas = svg.current;
    const bounds = viewport.current?.getBoundingClientRect();
    const matrix = canvas?.getScreenCTM();
    const topLeft = bounds && canvasPoint(matrix, { x: bounds.left, y: bounds.top });
    const bottomRight = bounds && canvasPoint(matrix, { x: bounds.right, y: bounds.bottom });
    const current = chartRef.current;
    const x = Math.max(0, topLeft?.x ?? 0), y = Math.max(0, topLeft?.y ?? 0);
    const visible = bottomRight && { x, y, w: Math.min(current.canvas.width, bottomRight.x) - x,
      h: Math.min(current.canvas.height, bottomRight.y) - y };
    const blockId = id();
    const next = placeNewBlock(current, kind, blockId, visible ?? undefined, geometry);
    if (!next) { setError("There is no room for another block on this page."); return; }
    setConnection(null);
    setError("");
    revealBlock.current = blockId;
    commit(next);
    setSelected({ kind: "node", id: blockId });
  };
  useLayoutEffect(() => {
    if (!revealBlock.current || revealBlock.current !== node?.id) return;
    revealBlock.current = null;
    selectedBlock.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [node?.id]);
  const choosePort = (port: Port) => {
    if (!connection) return;
    try {
      if (connection.reconnect) {
        const { route, end } = connection.reconnect;
        const previous = route.points[end];
        const next = { ...route, points: route.points.map((point, i) => i === end ? port : point) };
        commit({ ...chart, routes: chart.routes.map((item) => item.id === route.id ? next : item),
          labels: chart.labels.map((item) => item.anchor?.route === route.id && "node" in previous &&
            item.anchor.along === undefined && "node" in item.anchor &&
            item.anchor.node === previous.node && item.anchor.side === previous.side ? { ...item, anchor: { ...port, route: route.id } } : item) });
      } else if (connection.from) {
        const next = connectPorts(chart, connection.from, port, id());
        commit({ ...chart, routes: [...chart.routes, next] });
        setSelected({ kind: "route", id: next.id });
      } else {
        setConnection({ from: port });
        return;
      }
      setConnection(null);
      setHoverPort(null);
      setError("");
    } catch (error) { setError(String(error)); }
  };
  const addLabel = (anchor: NonNullable<FlowchartLabel["anchor"]>) => {
    const next = { id: id(), anchor, position: { x: 8, y: -3 }, width: 12, text: "Label" };
    commit({ ...chart, labels: [...chart.labels, next] });
    setSelected({ kind: "label", id: next.id });
  };
  const routeStart = route?.points[0];
  const labelRoutes = chart.routes.filter((item) => geometry.get(item.id)!.length >= 2);
  const attachLabel = (anchor: NonNullable<FlowchartLabel["anchor"]>) => {
    if (!label) return;
    const current = labelPosition(label, chart.nodes, geometry);
    const origin = labelAnchor({ ...label, anchor }, chart.nodes, geometry);
    commit({ ...chart, labels: chart.labels.map((item) => item.id === label.id
      ? { ...item, anchor, position: { x: current.x - origin.x, y: current.y - origin.y } } : item) });
  };
  const updateComment = (patch: { text?: string; width?: number; side?: "left" | "right" }) => {
    if (!comment) return;
    const next = { ...comment, ...patch };
    next.height = commentHeight(next.text, chart.canvas.textSize, next.width);
    commit({ ...chart, comments: chart.comments.map((item) => item.id === next.id ? next : item) });
  };
  const preview = connection?.from && hoverPort
    ? routeGeometry({ id: "preview", points: [connection.from, hoverPort], arrow: false }, chart.nodes)
    : [];
  const switchMode = () => {
    cancelGesture();
    setConnection(null);
    setHoverPort(null);
    setAddMenu(null);
    setRecentMenu(null);
    onSwitchMode();
  };
  function deleteSelected(selection: Selection) {
    const chart = chartRef.current;
    if (selection.kind === "node" && !window.confirm("Delete this block and its connections, labels and comments?")) return;
    cancelGesture();
    if (selection.kind === "node") {
      const junctions = chart.junctions?.map((junction) => junction.anchor?.node === selection.id
        ? { id: junction.id, position: resolvePoint({ junction: junction.id }, chart.nodes, chart.junctions) } : junction);
      const routes = chart.routes.filter((r) => !r.points.some((p) => "node" in p && p.node === selection.id))
        .map((route) => ({ ...route, points: route.points.map((point) => {
          if (!("x" in point) || (point.alignX !== selection.id && point.alignY !== selection.id)) return point;
          const absolute = resolvePoint(point, chart.nodes);
          return {
            x: point.alignX === selection.id ? absolute.x : point.x,
            y: point.alignY === selection.id ? absolute.y : point.y,
            alignX: point.alignX === selection.id ? undefined : point.alignX,
            alignY: point.alignY === selection.id ? undefined : point.alignY,
          };
        }) }));
      commit({ ...chart, nodes: chart.nodes.filter((n) => n.id !== selection.id),
        comments: chart.comments.filter((c) => c.node !== selection.id),
        labels: chart.labels.filter(({ anchor }) => !anchor || (anchor.route
          ? routes.some((r) => r.id === anchor.route)
          : "node" in anchor && anchor.node !== selection.id)),
        routes, junctions });
    } else if (selection.kind === "label") commit({ ...chart, labels: chart.labels.filter((l) => l.id !== selection.id) });
    else if (selection.kind === "comment") commit({ ...chart, comments: chart.comments.filter((c) => c.id !== selection.id) });
    else commit({ ...chart, routes: chart.routes.filter((r) => r.id !== selection.id),
      labels: chart.labels.filter((l) => l.anchor?.route !== selection.id) });
    setConnection(null);
    setHoverPort(null);
    setSelected(null);
  }
  if (!active) return null;
  return <>
    <AppBar position="static" elevation={0}><Toolbar variant="dense" sx={{ gap: 1, flexWrap: "wrap" }}>
      <Button color="inherit" onClick={switchMode} sx={{ textTransform: "none", fontSize: "1.25rem", fontWeight: 700 }}>Diagramator</Button>
      <Typography variant="subtitle1">Block scheme</Typography>
      <Button color="inherit" disabled={files.busy} onClick={() => void files.open()}>Open</Button>
      {files.recents.length > 0 && <Button color="inherit" disabled={files.busy} onClick={(event) => setRecentMenu(event.currentTarget)}>Recent</Button>}
      <Menu anchorEl={recentMenu} open={!!recentMenu} onClose={() => setRecentMenu(null)}>
        {files.recents.map((path) => <Box key={path} component="li" sx={{ display: "flex", alignItems: "center" }}>
          <MenuItem onClick={() => { setRecentMenu(null); void files.open(path); }}>
            <ListItemText primary={path.split(/[\\/]/).at(-1)} secondary={path} />
          </MenuItem>
          <IconButton aria-label={`Remove ${path} from recents`} onClick={() => files.forget(path)}><CloseIcon fontSize="small" /></IconButton>
        </Box>)}
      </Menu>
      <Button color="inherit" disabled={files.busy} onClick={() => void save()}>Save{files.dirty ? " *" : ""}</Button>
      <Button color="inherit" disabled={files.busy} onClick={() => void save(true)}>Save as</Button>
      <Button color="inherit" disabled={!history.past.length} onClick={() => undo(false)}>Undo</Button>
      <Button color="inherit" disabled={!history.future.length} onClick={() => undo(true)}>Redo</Button>
      <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>{files.busy ? "Working…" : files.path ?? "Unsaved scheme"}</Typography>
      <input ref={files.input} type="file" accept=".json,application/json" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void files.pick(file);
        event.target.value = "";
      }} />
    </Toolbar></AppBar>
    {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
    {files.error && <Alert severity="error">{files.error}</Alert>}
    {files.exportError && <Alert severity="warning">JSON saved. Typst export was not updated. {files.exportError}</Alert>}
    {invalidRoutes.length > 0 && <Alert severity="warning">Move the endpoints of {invalidRoutes.map((r) => r.id).join(", ")} apart to render the connection.</Alert>}
    <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
      <Box ref={viewport} tabIndex={0} aria-label="Block scheme canvas"
        sx={{ flex: 1, minWidth: 0, overflow: "auto", bgcolor: "#e9edf1", p: 2, "&:focus": { outline: "none" } }}>
        <svg ref={svg} viewBox={`0 0 ${chart.canvas.width} ${chart.canvas.height}`}
          width={chart.canvas.width * 3 * zoom} height={chart.canvas.height * 3 * zoom}
          style={{ background: "white", display: "block", touchAction: "none" }} onPointerMove={move} onPointerUp={end}
          onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag} onPointerDown={() => {
            viewport.current?.focus({ preventScroll: true });
            setSelected(null);
          }}>
          <defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
          {chart.routes.map((r) => {
            const routePoints = geometry.get(r.id)!;
            if (routePoints.length < 2) return null;
            const points = routePoints.map((p) => `${p.x},${p.y}`).join(" ");
            return <g key={r.id}>
              <polyline points={points} fill="none" stroke={selected?.id === r.id ? "#1976d2" : "#222"}
                strokeWidth="0.3" markerEnd={r.arrow ? "url(#flow-arrow)" : undefined} />
              <polyline points={points} fill="none" stroke="transparent" strokeWidth="4" style={{ cursor: "pointer" }}
                onPointerDown={(event) => {
                  const point = at(event);
                  if (point) beginSegmentDrag(event, r, routePoints, nearestSegment(routePoints, point));
                }} />
            </g>;
          })}
          {chart.labels.map((label) => {
            const { x, y } = labelPosition(label, chart.nodes, geometry);
            return <text key={label.id} x={x} y={y} dominantBaseline="hanging" textAnchor="middle" fontFamily="Arial, sans-serif"
              fontSize={fontMillimeters(chart.canvas.textSize)} fill={selected?.id === label.id ? "#1976d2" : "#111"} style={{ cursor: "move" }}
              onPointerDown={(event) => begin(event, { kind: "label", id: label.id }, { x, y }, (position) => {
                const previous = chartRef.current;
                return { ...previous, labels: previous.labels.map((l) => l.id === label.id
                  ? { ...l, position: { x: l.position.x + position.x - x, y: l.position.y + position.y - y } } : l) };
              })}>
              {wrapText(label.text, chart.canvas.textSize, label.width).map((line, i) => <tspan key={i} x={x} dy={i ? lineHeight(chart.canvas.textSize) : 0}>{line}</tspan>)}
            </text>;
          })}
          {chart.comments.map((c) => {
            const edge = resolvePoint({ node: c.node, side: c.side }, chart.nodes);
            const sign = c.side === "right" ? 1 : -1;
            const x = edge.x + sign * c.gap;
            const box = commentBounds(c, chart);
            const lines = wrapText(c.text, chart.canvas.textSize, c.width - 6);
            const leading = lineHeight(chart.canvas.textSize);
            return <g key={c.id} onPointerDown={(event) => {
              event.stopPropagation();
              viewport.current?.focus({ preventScroll: true });
              setSelected({ kind: "comment", id: c.id });
            }} style={{ cursor: "pointer" }}>
              <path d={`M ${edge.x} ${edge.y} H ${x}`} stroke="#555" strokeWidth="0.3" strokeDasharray="1 1" />
              <path d={`M ${x + sign * 2} ${edge.y - c.height / 2} H ${x} V ${edge.y + c.height / 2} H ${x + sign * 2}`} fill="none" stroke="#222" strokeWidth="0.3" />
              <text x={box.x + 3} y={edge.y - lines.length * leading / 2} dominantBaseline="hanging"
                fontFamily="Arial, sans-serif" fontSize={fontMillimeters(chart.canvas.textSize)} fill="#111">
                {lines.map((line, i) => <tspan key={i} x={box.x + 3} dy={i ? leading : 0}>{line}</tspan>)}
              </text>
            </g>;
          })}
          {chart.nodes.map((n) => <g key={n.id} ref={node?.id === n.id ? selectedBlock : undefined}
            onPointerDown={(event) => begin(event, { kind: "node", id: n.id }, n.position, (position) => {
              const current = chartRef.current;
              const snapped = snapBlock(current.nodes, n, position, 7 / (3 * zoom));
              setGuides(snapped.guides);
              return snapped.point.x === n.position.x && snapped.point.y === n.position.y
                ? current : moveBlock(current, n.id, snapped.point);
            })}>
            <Block node={n} selected={selected?.id === n.id} size={chart.canvas.textSize} />
          </g>)}
          <g stroke="#1976d2" strokeWidth={0.35 / zoom} strokeDasharray="2 1" pointerEvents="none">
            {guides.x !== undefined && <line x1={guides.x} x2={guides.x} y1={0} y2={chart.canvas.height} />}
            {guides.y !== undefined && <line x1={0} x2={chart.canvas.width} y1={guides.y} y2={guides.y} />}
            {label?.anchor && (() => {
              const from = labelAnchor(label, chart.nodes, geometry), to = labelPosition(label, chart.nodes, geometry);
              return <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
            })()}
          </g>
          {route && !connection && selectedPoints.slice(0, -1).map((a, i) => {
            const b = selectedPoints[i + 1];
            if (Math.hypot(a.x - b.x, a.y - b.y) * 3 * zoom < 18) return null;
            const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const axis = a.y === b.y ? "y" : "x";
            return <circle key={i} cx={center.x} cy={center.y} r={1.8 / zoom} fill="white" stroke="#1976d2" strokeWidth={0.5 / zoom}
              style={{ cursor: axis === "y" ? "ns-resize" : "ew-resize" }} onPointerDown={(event) =>
                beginSegmentDrag(event, route, selectedPoints, i)} />;
          })}
          {preview.length > 1 && <polyline points={preview.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none" stroke="#1976d2" strokeWidth={0.5} strokeDasharray="2 1" pointerEvents="none" />}
          {connection && chart.nodes.flatMap((node) => PORT_SIDES.map((side) => {
            const port = { node: node.id, side };
            const { x, y } = resolvePoint(port, chart.nodes);
            return <circle key={`${node.id}:${side}`} cx={x} cy={y} r={2.2}
              fill={connection.from?.node === node.id && connection.from.side === side ? "#1976d2" : "white"}
              stroke="#1976d2" strokeWidth={0.6} role="button" tabIndex={0} aria-label={`${node.text.split("\n")[0] || node.kind}, ${side} port`}
              style={{ cursor: "crosshair" }} onPointerDown={(event) => { event.stopPropagation(); choosePort(port); }}
              onPointerEnter={() => setHoverPort(port)} onPointerLeave={() => setHoverPort(null)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choosePort(port); } }} />;
          }))}
        </svg>
      </Box>
      <Stack ref={inspector} spacing={2} sx={{ width: 280, p: 2, overflow: "auto", flexShrink: 0 }}>
        <Typography variant="subtitle1">Block scheme</Typography>
        <Button variant="outlined" onClick={(event) => setAddMenu(event.currentTarget)}>Add block</Button>
        <Menu anchorEl={addMenu} open={!!addMenu} onClose={() => setAddMenu(null)}>
          {kinds.map((kind) => <MenuItem key={kind} onClick={() => addBlock(kind)}>{kind}</MenuItem>)}
        </Menu>
        <Button variant={connection ? "contained" : "outlined"}
          onClick={() => { setConnection(connection ? null : {}); setHoverPort(null); }}>
          {connection ? "Cancel connection" : "Connect ports"}
        </Button>
        {connection && <Typography variant="body2">{connection.reconnect ? "Pick the replacement port." : connection.from ? "Pick the destination port." : "Pick the starting port."}</Typography>}
        {node && <>
          <Typography variant="subtitle2">Selected block</Typography>
          <TextField label="Text" multiline minRows={2} value={node.text} onChange={(e) => updateNode({ text: e.target.value })} />
          <TextField label="Text size (pt)" type="number" size="small" value={node.textSize ?? ""}
            placeholder={String(chart.canvas.textSize)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 1, max: 72, step: 0.5 } }}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) updateNode({ textSize: undefined });
              else if (Number(value) >= 1 && Number(value) <= 72) updateNode({ textSize: Number(value) });
            }} />
          <TextField select size="small" label="Type" value={node.kind} onChange={(event) => updateNode({ kind: event.target.value as FlowchartNodeKind })}>
            {kinds.map((kind) => <MenuItem key={kind} value={kind}>{kind}</MenuItem>)}
          </TextField>
          <Button onClick={() => addLabel({ node: node.id, side: "bottom" })}>Add block label</Button>
          <Button onClick={() => {
            const c = { id: id(), node: node.id, side: "right" as const, gap: 8, width: 48,
              height: commentHeight("Comment", chart.canvas.textSize, 48), text: "Comment" };
            commit({ ...chart, comments: [...chart.comments, c] });
            setSelected({ kind: "comment", id: c.id });
          }}>Add comment</Button>
        </>}
        {label && <>
          <TextField label="Label" value={label.text} onChange={(e) => commit({ ...chart, labels: chart.labels.map((l) => l.id === label.id ? { ...l, text: e.target.value } : l) })} />
          <TextField select size="small" label="Attached to" value={label.anchor?.route ? `route:${label.anchor.route}` : label.anchor && "node" in label.anchor ? `block:${label.anchor.node}` : ""} onChange={(event) => {
            const value = event.target.value;
            if (value.startsWith("block:")) { attachLabel({ node: value.slice(6), side: "bottom" }); return; }
            const selectedRoute = labelRoutes.find((item) => value === `route:${item.id}`);
            if (selectedRoute) {
              const points = geometry.get(selectedRoute.id)!;
              attachLabel({ route: selectedRoute.id, along: routeFraction(points, labelPosition(label, chart.nodes, geometry)) });
            }
          }}>
            <MenuItem value="" disabled>Choose a block or connection</MenuItem>
            {chart.nodes.map((block) => <MenuItem key={`block:${block.id}`} value={`block:${block.id}`}>Block · {block.text.split("\n")[0] || block.kind}</MenuItem>)}
            {chart.routes.map((item) => {
              const port = item.points[0];
              const name = "node" in port ? chart.nodes.find((block) => block.id === port.node)?.text.split("\n")[0] || port.node : item.id;
              return <MenuItem key={`route:${item.id}`} value={`route:${item.id}`} disabled={!labelRoutes.includes(item)}>
                Connection · {name}{"node" in port ? ` (${port.side})` : ""}
              </MenuItem>;
            })}
          </TextField>
        </>}
        {comment && <>
          <TextField label="Comment" multiline minRows={4} value={comment.text} onChange={(event) => updateComment({ text: event.target.value })} />
          <TextField select label="Side" value={comment.side} onChange={(event) => updateComment({ side: event.target.value as "left" | "right" })}>
            <MenuItem value="left">Left</MenuItem><MenuItem value="right">Right</MenuItem>
          </TextField>
          <TextField type="number" label="Width (mm)" value={comment.width} onChange={(event) => {
            const width = Number(event.target.value);
            if (Number.isFinite(width) && width > 6 && width <= chart.canvas.width) updateComment({ width });
          }} />
        </>}
        {route && <>
          <FormControlLabel control={<Checkbox checked={route.arrow} onChange={(event) => updateRoute({ ...route, arrow: event.target.checked })} />} label="Arrow" />
          <Typography variant="body2">Drag a line or its handles to move that segment.</Typography>
          {passesThroughObstacle(route, selectedPoints, chart) && <Alert severity="warning">This connection crosses a block or comment.</Alert>}
          <Button onClick={() => setConnection({ reconnect: { route, end: 0 } })}>Change start port</Button>
          <Button onClick={() => setConnection({ reconnect: { route, end: route.points.length - 1 } })}>Change end port</Button>
          <Button disabled={selectedPoints.length < 2} onClick={() => addLabel({ route: route.id, along: 0.3 })}>Add branch label</Button>
          {routeStart && "node" in routeStart && "node" in route.points.at(-1)! && !route.points.some((point) => "junction" in point) &&
            <Button onClick={() => updateRoute({ ...route, points: [routeStart, route.points.at(-1)!], automatic: true })}>Auto-route</Button>}
          {route.points.map((p, i) => !("x" in p) ? null : <Stack key={i} direction="row" spacing={1}>
            {(["x", "y"] as const).map((axis) => <TextField key={axis} type="number" size="small"
              label={`Bend ${i} ${axis}${(axis === "x" ? p.alignX : p.alignY) ? " offset" : ""} (mm)`} value={p[axis]} onChange={(e) => {
              const value = Number(e.target.value);
              if (e.target.value && Number.isFinite(value)) updateRoute({ ...route, automatic: false,
                points: route.points.map((point, index) => index === i && "x" in point ? { ...point, [axis]: value } : point) });
            }} />)}
          </Stack>)}
        </>}
        {selected && <Button color="error" onClick={() => deleteSelected(selected)}>Delete {selected.kind}</Button>}
        {!selected && <Typography variant="body2" color="text.secondary">Select a block, label, comment, or connection to edit it. Drag blocks and labels to move them.</Typography>}
      </Stack>
    </Box>
  </>;
}
