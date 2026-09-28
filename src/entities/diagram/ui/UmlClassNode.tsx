import { memo, type CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { StyleProfile } from "@/shared/types";
import { cssFontFamily } from "@/shared/config";
import { isAbstractClass, STEREOTYPE } from "../lib/measure";
import type { ClassFlowNode } from "../lib/toFlow";
import "./umlClass.css";

const BADGE: Record<string, string> = { class: "C", struct: "S", interface: "I", enum: "E", union: "U" };

/** CSS variables consumed by `umlClass.css`; set once on the canvas container. */
export function styleVars(s: StyleProfile): CSSProperties {
  const px = (n: number) => `${n}px`;
  return {
    "--uml-font": cssFontFamily(s.font),
    "--uml-size": px(s.fontSize),
    "--uml-name-size": px(s.nameFontSize),
    "--uml-stereo-size": px(s.stereotypeFontSize),
    "--uml-lh": px(s.lineHeight),
    "--uml-px": px(s.paddingX),
    "--uml-py": px(s.paddingY),
    "--uml-bw": px(s.borderWidth),
    "--uml-radius": px(s.cornerRadius),
    "--uml-name-weight": s.nameBold ? "bold" : "normal",
    "--uml-badge-display": s.kindBadge ? "inline-block" : "none",
    "--uml-text": s.colors.text,
    "--uml-border": s.colors.border,
    "--uml-fill": s.colors.fill,
    "--uml-head-fill": s.colors.headerFill,
    "--uml-badge": s.colors.badge,
    "--uml-edge": s.colors.edge,
    "--uml-ew": px(s.edgeWidth),
    "--xy-edge-stroke": s.colors.edge,
  } as CSSProperties;
}

function Section({ items }: { items: string[] }) {
  return (
    <div className="uml-section">
      {items.length === 0 && <div className="uml-row" />}
      {items.map((m, i) => (
        <div
          key={i}
          title={m}
          className={`uml-row${m.endsWith("{static}") ? " uml-static" : ""}${m.includes("{abstract}") ? " uml-italic" : ""}`}
        >
          {m}
        </div>
      ))}
    </div>
  );
}

/** UML class box: name compartment, attributes, operations. Plain DOM for drag performance. */
export const UmlClassNode = memo(function UmlClassNode({ data, selected }: NodeProps<ClassFlowNode>) {
  const { cls } = data;
  const stereotype = STEREOTYPE[cls.kind];
  return (
    <div className={`uml-class${selected ? " selected" : ""}`}>
      {/* React Flow needs handles to render edges; FloatingEdge ignores their position. */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} isConnectable={false} />
      <div className="uml-head">
        {stereotype && <div className="uml-row uml-stereotype">{stereotype}</div>}
        <div className={`uml-row uml-name${isAbstractClass(cls) ? " uml-italic" : ""}`} title={cls.name}>
          <span className="uml-badge">{BADGE[cls.kind]}</span>
          {cls.name}
        </div>
      </div>
      <Section items={cls.attributes} />
      <Section items={cls.methods} />
    </div>
  );
});
