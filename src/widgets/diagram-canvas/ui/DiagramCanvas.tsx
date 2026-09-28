import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Box, Typography } from "@mui/material";
import {
  classMoved,
  FloatingEdge,
  selectDiagram,
  styleVars,
  toFlowEdges,
  toFlowNodes,
  UmlClassNode,
  UmlMarkers,
  type ClassFlowNode,
} from "@/entities/diagram";
import { selectStyle, selectThemeMode } from "@/entities/settings";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";

const nodeTypes: NodeTypes = { umlClass: UmlClassNode };
const edgeTypes: EdgeTypes = { floating: FloatingEdge };

export function DiagramCanvas() {
  const dispatch = useAppDispatch();
  const diagram = useAppSelector(selectDiagram);
  const mode = useAppSelector(selectThemeMode);
  const style = useAppSelector(selectStyle);
  const vars = useMemo(() => styleVars(style), [style]);
  const [nodes, setNodes, onNodesChange] = useNodesState<ClassFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Rebuild the flow only when a new diagram is loaded or the style resizes boxes
  // (drags are kept locally and mirrored into the store on drag stop).
  const diagramKey = diagram ? diagram.classes.map((c) => c.id).join("|") : "";
  useEffect(() => {
    if (!diagram) return;
    setNodes(toFlowNodes(diagram));
    setEdges(toFlowEdges(diagram));
  }, [diagramKey, style, setNodes, setEdges]);

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
        onNodeDragStop={(_, __, dragged) =>
          dragged.forEach((n) => dispatch(classMoved({ id: n.id, x: n.position.x, y: n.position.y })))
        }
        nodesConnectable={false}
        colorMode={mode}
        minZoom={0.05}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </Box>
  );
}
