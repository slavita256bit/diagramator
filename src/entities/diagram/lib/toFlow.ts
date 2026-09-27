import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { ClassNode, Diagram, Relation, RelationType } from "@/shared/types";
import { UML_MARKER } from "../ui/UmlMarkers";

export type ClassFlowNode = Node<{ cls: ClassNode }, "umlClass">;

export function toFlowNodes(diagram: Diagram): ClassFlowNode[] {
  return diagram.classes.map((cls) => ({
    id: cls.id,
    type: "umlClass",
    position: { x: cls.position.x, y: cls.position.y },
    width: cls.position.width,
    data: { cls },
  }));
}

interface EdgeStyle {
  dashed: boolean;
  markerStart?: string;
  markerEnd?: Edge["markerEnd"];
}

/** UML notation per relation kind. Edges go from `source` (dependent side) to `target`. */
const EDGE_STYLES: Record<RelationType, EdgeStyle> = {
  inheritance: { dashed: false, markerEnd: UML_MARKER.hollowTriangle },
  realization: { dashed: true, markerEnd: UML_MARKER.hollowTriangle },
  composition: { dashed: false, markerStart: UML_MARKER.filledDiamond, markerEnd: { type: MarkerType.Arrow } },
  aggregation: { dashed: false, markerStart: UML_MARKER.hollowDiamond, markerEnd: { type: MarkerType.Arrow } },
  association: { dashed: false, markerEnd: { type: MarkerType.Arrow } },
  dependency: { dashed: true, markerEnd: { type: MarkerType.Arrow } },
};

export function toFlowEdges(diagram: Diagram): Edge[] {
  return diagram.relations.map((rel: Relation) => {
    const style = EDGE_STYLES[rel.type];
    return {
      id: `${rel.source}->${rel.target}:${rel.type}`,
      source: rel.source,
      target: rel.target,
      type: "floating",
      markerStart: style.markerStart,
      markerEnd: style.markerEnd,
      style: { strokeDasharray: style.dashed ? "6 4" : undefined, strokeWidth: 1.5 },
      data: { relation: rel.type },
    };
  });
}
