import { memo, type CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ClassNode, StyleProfile } from "@/shared/types";
import { cssFontFamily } from "@/shared/config";
import { useAppDispatch } from "@/shared/model/hooks";
import { classesResized, sectionCollapseToggled } from "../model/diagramSlice";
import { formatMethodSignature, isAbstractClass, measureClass, splitVisibility, STEREOTYPE } from "../lib/measure";
import type { ClassFlowNode } from "../lib/toFlow";
import "./umlClass.css";

type SectionKind = "attributes" | "methods";

/** Toggles a section and resizes the box in the same dispatch batch (mirrors `applyStyle`). */
function toggleSectionCollapse(cls: ClassNode, section: SectionKind, style: StyleProfile) {
  const after: ClassNode = {
    ...cls,
    attributesCollapsed: section === "attributes" ? !cls.attributesCollapsed : cls.attributesCollapsed,
    methodsCollapsed: section === "methods" ? !cls.methodsCollapsed : cls.methodsCollapsed,
  };
  return [sectionCollapseToggled({ classId: cls.id, section }), classesResized({ [cls.id]: measureClass(after, style) })] as const;
}

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

function Icon({ color, isCircle }: { color: string; isCircle: boolean }) {
  return <span className={`uml-icon ${isCircle ? "uml-icon-circle" : "uml-icon-square"}`} style={{ background: color }} />;
}

function Section({
  items,
  isMethods,
  collapsed,
  style: s,
  onToggle,
}: {
  items: string[];
  isMethods: boolean;
  collapsed: boolean;
  style: StyleProfile;
  onToggle: () => void;
}) {
  const shown = collapsed ? [] : items;
  return (
    <div className="uml-section">
      {/* nodrag/nopan alone isn't quite enough: React Flow's node-click/select handling is
          bound separately from drag and fires on the bubbled `click`, which can race our own
          re-render (occasionally "losing" the toggle) — so stop both pointerdown *and* click
          from reaching it. */}
      <button
        type="button"
        className="uml-collapse-toggle nodrag nopan"
        title={collapsed ? "Expand" : "Collapse"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {collapsed ? "▸" : "▾"}
      </button>
      {shown.length === 0 && <div className="uml-row" />}
      {shown.map((raw, i) => {
        const text = isMethods ? formatMethodSignature(raw, s.showMethodParams, s.showMethodReturnType) : raw;
        const { rest, color } = splitVisibility(text);
        const display = s.memberIconStyle === "text" ? text : rest;
        const isCircle = s.memberIconStyle === "circle" || !isMethods;
        return (
          <div
            key={i}
            title={text}
            className={`uml-row${raw.endsWith("{static}") ? " uml-static" : ""}${raw.includes("{abstract}") ? " uml-italic" : ""}`}
          >
            {s.memberIconStyle !== "text" && <Icon color={color} isCircle={isCircle} />}
            {display}
          </div>
        );
      })}
    </div>
  );
}

/** UML class box: name compartment, attributes, operations. Plain DOM for drag performance. */
export const UmlClassNode = memo(function UmlClassNode({ data, selected }: NodeProps<ClassFlowNode>) {
  const { cls, style: s } = data;
  const dispatch = useAppDispatch();
  const stereotype = s.showStereotype ? STEREOTYPE[cls.kind] : undefined;
  // GOST: interfaces omit the attributes compartment entirely, not just show it empty.
  const hideAttrs = s.interfaceHidesAttributes && cls.kind === "interface";
  const isTemplate = cls.templateParams.length > 0;
  const templateHeader = isTemplate && s.templateNotation === "header" ? `template<${cls.templateParams.join(", ")}>` : undefined;
  const toggle = (section: SectionKind) => toggleSectionCollapse(cls, section, s).forEach(dispatch);

  return (
    // Outer wrapper doesn't clip overflow (unlike `.uml-class`, which must, for rounded
    // corners/header fill) — the template corner box is positioned outside the class box's
    // own bounds, so it needs to live outside that clipping boundary or it's invisible.
    <div className="uml-node-root">
      {/* React Flow needs handles to render edges; FloatingEdge ignores their position. */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} isConnectable={false} />
      {isTemplate && s.templateNotation === "corner" && (
        <div className="uml-template-corner">{cls.templateParams.join(", ")}</div>
      )}
      <div className={`uml-class${selected ? " selected" : ""}`}>
        <div className="uml-head">
          {templateHeader && <div className="uml-row uml-template-header">{templateHeader}</div>}
          {stereotype && <div className="uml-row uml-stereotype">{stereotype}</div>}
          <div className={`uml-row uml-name${isAbstractClass(cls) ? " uml-italic" : ""}`} title={cls.name}>
            <span className="uml-badge">{BADGE[cls.kind]}</span>
            {cls.name}
          </div>
        </div>
        {!hideAttrs && (
          <Section
            items={cls.attributes}
            isMethods={false}
            collapsed={cls.attributesCollapsed}
            style={s}
            onToggle={() => toggle("attributes")}
          />
        )}
        <Section
          items={cls.methods}
          isMethods
          collapsed={cls.methodsCollapsed}
          style={s}
          onToggle={() => toggle("methods")}
        />
      </div>
    </div>
  );
});
