/** Custom SVG markers for UML arrowheads (React Flow only ships arrow/arrowclosed). */
export const UML_MARKER = {
  hollowTriangle: "uml-hollow-triangle",
  filledDiamond: "uml-filled-diamond",
  hollowDiamond: "uml-hollow-diamond",
  openArrow: "uml-open-arrow",
} as const;

/** Render once alongside <ReactFlow>; edges reference the markers by id. */
export function UmlMarkers({ size = 12 }: { size?: number }) {
  const stroke = "var(--uml-edge, #b1b1b7)";
  const bg = "var(--xy-background-color, #fff)";
  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden>
      <defs>
        <marker
          id={UML_MARKER.hollowTriangle}
          viewBox="0 0 20 20"
          refX="19"
          refY="10"
          markerWidth={size * 1.33}
          markerHeight={size * 1.33}
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path d="M1,1 L19,10 L1,19 Z" fill={bg} stroke={stroke} style={{ strokeWidth: "var(--uml-ew, 1.5)" }} />
        </marker>
        <marker
          id={UML_MARKER.openArrow}
          viewBox="0 0 20 20"
          refX="19"
          refY="10"
          markerWidth={size}
          markerHeight={size}
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path d="M1,2 L19,10 L1,18" fill="none" stroke={stroke} style={{ strokeWidth: "var(--uml-ew, 1.5)" }} />
        </marker>
        {(["filledDiamond", "hollowDiamond"] as const).map((key) => (
          <marker
            key={key}
            id={UML_MARKER[key]}
            viewBox="0 0 24 12"
            // Used as markerStart: orientation is reversed, so anchor the far tip
            // to keep the diamond outside the node.
            refX="23"
            refY="6"
            markerWidth={size * 1.8}
            markerHeight={size * 0.9}
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path
              d="M1,6 L12,1 L23,6 L12,11 Z"
              fill={key === "filledDiamond" ? stroke : bg}
              stroke={stroke}
              style={{ strokeWidth: "var(--uml-ew, 1.5)" }}
            />
          </marker>
        ))}
      </defs>
    </svg>
  );
}
