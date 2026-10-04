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
  classMoved,
  FloatingEdge,
  noteMoved,
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
import { selectStyle } from "@/entities/settings";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";

const nodeTypes: NodeTypes = { umlClass: UmlClassNode, umlNote: UmlNoteNode };
const edgeTypes: EdgeTypes = { floating: FloatingEdge };

export function DiagramCanvas() {
  const dispatch = useAppDispatch();
  const diagram = useAppSelector(selectDiagram);
  const style = useAppSelector(selectStyle);
  const vars = useMemo(() => styleVars(style), [style]);
  // MiniMap re-renders on every drag frame; off by default (costly in WebKitGTK).
  const [miniMap, setMiniMap] = useState(false);
  const onNodeDragStop = useCallback<OnNodeDrag<ClassFlowNode | NoteFlowNode>>(
    (_, __, dragged) =>
      dragged.forEach((n) => {
        const action = n.type === "umlNote" ? noteMoved : classMoved;
        dispatch(action({ id: n.id, x: n.position.x, y: n.position.y }));
      }),
    [dispatch],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<ClassFlowNode | NoteFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

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
            `${c.id}:${c.position.x}:${c.position.y}:${c.position.width}:${c.position.height}:${c.attributesCollapsed}:${c.methodsCollapsed}`,
        )
        .join("|") +
      "#" +
      diagram.notes
        .map((n) => `${n.id}:${n.position.x}:${n.position.y}:${n.position.width}:${n.position.height}:${n.linkedClass ?? ""}:${n.text}`)
        .join("|")
    : "";
  useEffect(() => {
    if (!diagram) return;
    setNodes([...toFlowNodes(diagram, style), ...toFlowNoteNodes(diagram)]);
  }, [nodesSignature, style, setNodes]);
  // Edges follow the router's output (relations change only when routes are recomputed) and
  // note links (which don't need routing — a note connector is always a plain line).
  const relations = diagram?.relations;
  const noteLinks = diagram?.notes.map((n) => n.linkedClass).join("|");
  useEffect(() => {
    if (diagram) setEdges([...toFlowEdges(diagram, style), ...toFlowNoteEdges(diagram, style)]);
  }, [relations, noteLinks, style, setEdges]);

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
    <Box sx={{ flex: 1, minHeight: 0 }} style={vars}>
      <UmlMarkers size={style.arrowSize} />
      <ReactFlow
        key={diagramKey}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
        <Background />
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
