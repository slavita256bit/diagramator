import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  ControlButton,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeTypes,
  type NodeTypes,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Box, Typography } from "@mui/material";
import MapIcon from "@mui/icons-material/Map";
import {
  classesHidden,
  nodesMoved,
  undo,
  redo,
  computeRoutesAsync,
  FloatingEdge,
  selectDiagram,
  styleVars,
  toFlowEdges,
  toFlowNodes,
  toFlowNoteEdges,
  toFlowNoteNodes,
  UmlClassNode,
  UmlNoteNode,
  UmlMarkers,
  type ClassFlowNode,
  type NoteFlowNode,
} from "@/entities/diagram";
import { APP_THEMES } from "@/shared/config";
import { selectHiddenRelationTypes, selectStyle, selectTheme, selectedClassesChanged } from "@/entities/settings";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";

const nodeTypes: NodeTypes = { umlClass: UmlClassNode, umlNote: UmlNoteNode };
const edgeTypes: EdgeTypes = { floating: FloatingEdge };

export function DiagramCanvas() {
  const dispatch = useAppDispatch();
  const diagram = useAppSelector(selectDiagram);
  const style = useAppSelector(selectStyle);
  const hiddenTypes = useAppSelector(selectHiddenRelationTypes);
  const canvasTheme = APP_THEMES[useAppSelector(selectTheme)];
  const vars = useMemo(() => styleVars(style), [style]);
  // MiniMap re-renders on every drag frame; off by default (costly in WebKitGTK).
  const [miniMap, setMiniMap] = useState(false);
  const onNodeDragStop = useCallback<OnNodeDrag<ClassFlowNode | NoteFlowNode>>(
    (_, __, dragged) => dispatch(nodesMoved(dragged.map((n) => ({
      id: n.id, x: n.position.x, y: n.position.y, type: n.type === "umlNote" ? "umlNote" as const : "umlClass" as const,
    })))),
    [dispatch],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<ClassFlowNode | NoteFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const selectedIds = nodes.filter((n) => n.selected && n.type === "umlClass").map((n) => n.id).sort().join("\u0000");
  useEffect(() => {
    dispatch(selectedClassesChanged(selectedIds ? selectedIds.split("\u0000") : []));
  }, [dispatch, selectedIds]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']"))) return;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (!event.repeat) dispatch(event.shiftKey ? redo() : undo());
      } else if (event.key === "Delete" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        const ids = nodes.filter((node) => node.selected && node.type === "umlClass").map((node) => node.id);
        if (ids.length) { event.preventDefault(); dispatch(classesHidden(ids)); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, nodes]);

  // `key` for <ReactFlow>: only the id set, so unrelated node edits don't remount the
  // whole canvas (losing zoom/pan/minimap state) on every drag-stop.
  const diagramKey = diagram
    ? diagram.classes.map((c) => c.id).join("|") + "#" + diagram.notes.map((n) => n.id).join("|")
    : "";
  // Separate, finer-grained signature for rebuilding the *nodes array*: must also catch
  // position/size/collapse/note changes that don't touch the id set (auto-arrange, collapse
  // toggle, note edits) — otherwise the box node never gets the new data and stays stale
  // while edges (routed off the store, not off this array) redraw for the new positions.
  // Live drags are excluded on purpose: `classMoved`/`noteMoved` only dispatch once, at drag
  // stop, with the same value React Flow already shows, so this just harmlessly re-confirms it.
  const nodesSignature = diagram
    ? diagram.classes
        .map(
          (c) =>
            `${c.id}:${c.position.x}:${c.position.y}:${c.position.width}:${c.position.height}:${c.attributesCollapsed}:${c.methodsCollapsed}:${c.hidden}`,
        )
        .join("|") +
      "#" +
      diagram.notes
        .map((n) => `${n.id}:${n.position.x}:${n.position.y}:${n.position.width}:${n.position.height}:${n.linkedClass ?? ""}:${n.text}`)
        .join("|")
    : "";
  useEffect(() => {
    if (!diagram) return;
    setNodes((previous) => [...toFlowNodes(diagram, style), ...toFlowNoteNodes(diagram)].map((node) => ({
      ...node, selected: previous.find((old) => old.id === node.id)?.selected,
    })));
  }, [nodesSignature, style, setNodes]);
  // Edges follow the router's output (relations change only when routes are recomputed) and
  // note links (which don't need routing — a note connector is always a plain line).
  const relations = diagram?.relations;
  const liveMovement = nodes.some((n) => n.dragging)
    ? nodes.map((n) => `${n.id}:${n.position.x}:${n.position.y}`).join("|") : "";
  const visibility = diagram?.classes.map((c) => `${c.id}:${c.hidden}`).join("|");
  const noteLinks = diagram?.notes.map((n) => n.linkedClass).join("|");
  useEffect(() => {
    if (!diagram) return;
    const updateEdges = (display: typeof diagram) => {
      setEdges((previous) => [...toFlowEdges(display, style, hiddenTypes), ...toFlowNoteEdges(display, style)].map((edge) => ({
        ...edge, selected: previous.find((e) => e.id === edge.id)?.selected,
        data: { ...edge.data, live: !!liveMovement },
      })));
    };
    if (!liveMovement) { updateEdges(diagram); return; }
    const positions = new Map(nodes.map((n) => [n.id, n.position]));
    const display = { ...diagram, classes: diagram.classes.map((c) => ({ ...c,
      position: { ...c.position, ...positions.get(c.id) } })) };
    const controller = new AbortController();
    void computeRoutesAsync(display, style, controller.signal).then((routes) => {
      if (!controller.signal.aborted) updateEdges({ ...display,
        relations: display.relations.map((r, i) => ({ ...r, route: routes[i] })) });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) console.error("Live routing failed", error);
    });
    return () => controller.abort();
  }, [relations, noteLinks, visibility, style, hiddenTypes, setEdges, liveMovement]);

  if (!diagram) {
    return (
      <Box sx={{ flex: 1, display: "grid", placeItems: "center", color: "text.secondary" }}>
        <Typography>Analyze a C++/Java source folder to generate a class diagram.</Typography>
      </Box>
    );
  }
  if (diagram.classes.length === 0) {
    return (
      <Box sx={{ flex: 1, display: "grid", placeItems: "center", color: "text.secondary" }}>
        <Typography>No classes found in the selected folder.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, bgcolor: canvasTheme.canvas }} style={vars}>
      <UmlMarkers size={style.arrowSize} />
      <ReactFlow
        key={diagramKey}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        deleteKeyCode={null}
        onNodeDragStop={onNodeDragStop}
        onlyRenderVisibleElements
        nodesConnectable={false}
        // Always light, regardless of the app's theme toggle: style-profile colors (GOST's
        // black-on-white, etc.) are authored for a light canvas, matching the exported
        // document — following dark mode here made edges/borders nearly invisible against a
        // dark background instead.
        colorMode="light"
        minZoom={0.05}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background color={canvasTheme.canvasDots} />
        <Controls>
          <ControlButton title="Toggle minimap" onClick={() => setMiniMap((v) => !v)}>
            <MapIcon />
          </ControlButton>
        </Controls>
        {miniMap && <MiniMap pannable zoomable />}
      </ReactFlow>
    </Box>
  );
}
