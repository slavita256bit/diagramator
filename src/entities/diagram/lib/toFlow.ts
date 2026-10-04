import type { Edge, Node } from "@xyflow/react";
import type { ClassNode, Diagram, Note, Relation, RelationType, StyleProfile } from "@/shared/types";
import { UML_MARKER } from "../ui/UmlMarkers";

export type ClassFlowNode = Node<{ cls: ClassNode; style: StyleProfile }, "umlClass">;
export type NoteFlowNode = Node<{ note: Note }, "umlNote">;

export function toFlowNodes(diagram: Diagram, style: StyleProfile): ClassFlowNode[] {
  return diagram.classes.map((cls) => ({
    id: cls.id,
    type: "umlClass",
    position: { x: cls.position.x, y: cls.position.y },
    width: cls.position.width,
    height: cls.position.height,
    data: { cls, style },
  }));
}

export function toFlowNoteNodes(diagram: Diagram): NoteFlowNode[] {
  return diagram.notes.map((note) => ({
    id: note.id,
    type: "umlNote",
    position: { x: note.position.x, y: note.position.y },
    width: note.position.width,
    height: note.position.height,
    data: { note },
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
  composition: { dashed: false, markerStart: UML_MARKER.filledDiamond, markerEnd: UML_MARKER.openArrow },
  aggregation: { dashed: false, markerStart: UML_MARKER.hollowDiamond, markerEnd: UML_MARKER.openArrow },
  association: { dashed: false, markerEnd: UML_MARKER.openArrow },
  dependency: { dashed: true, markerEnd: UML_MARKER.openArrow },
};

export function toFlowEdges(diagram: Diagram, style: StyleProfile): Edge[] {
  const dash = `${style.edgeDashLength} ${style.edgeDashGap}`;
  return diagram.relations.map((rel: Relation) => {
    const edgeStyle = EDGE_STYLES[rel.type];
    return {
      id: `${rel.source}->${rel.target}:${rel.type}`,
      source: rel.source,
      target: rel.target,
      type: "floating",
      markerStart: edgeStyle.markerStart,
      markerEnd: edgeStyle.markerEnd,
      style: { strokeDasharray: edgeStyle.dashed ? dash : undefined },
      data: { relation: rel.type, route: rel.route },
    };
  });
}

/** Dashed, arrowhead-less connector from a note to the class it's attached to (GOST fig 4.5). */
export function toFlowNoteEdges(diagram: Diagram, style: StyleProfile): Edge[] {
  const dash = `${style.edgeDashLength} ${style.edgeDashGap}`;
  return diagram.notes
    .filter((n) => n.linkedClass)
    .map((n) => ({
      id: `note:${n.id}->${n.linkedClass}`,
      source: n.id,
      target: n.linkedClass!,
      type: "floating",
      style: { strokeDasharray: dash },
      data: {},
    }));
}
