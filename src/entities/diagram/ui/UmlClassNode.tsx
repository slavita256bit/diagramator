import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Box, Divider, Typography } from "@mui/material";
import type { ClassFlowNode } from "../lib/toFlow";

const STEREOTYPE: Partial<Record<string, string>> = {
  interface: "«interface»",
  struct: "«struct»",
  enum: "«enumeration»",
  union: "«union»",
};

function Member({ text }: { text: string }) {
  const isStatic = text.endsWith("{static}");
  const isAbstract = text.includes("{abstract}");
  return (
    <Typography
      component="div"
      noWrap
      title={text}
      sx={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 12,
        lineHeight: "18px",
        textDecoration: isStatic ? "underline" : undefined,
        fontStyle: isAbstract ? "italic" : undefined,
      }}
    >
      {text}
    </Typography>
  );
}

function Section({ items }: { items: string[] }) {
  return (
    <Box sx={{ px: 1.5, py: 1, minHeight: 18 }}>
      {items.map((m, i) => (
        <Member key={i} text={m} />
      ))}
    </Box>
  );
}

/** UML class box: name compartment, attributes, operations. */
export const UmlClassNode = memo(function UmlClassNode({ data, selected }: NodeProps<ClassFlowNode>) {
  const { cls } = data;
  const stereotype = STEREOTYPE[cls.kind];
  const isAbstract = cls.kind === "interface" || cls.methods.some((m) => m.includes("{abstract}"));
  return (
    <Box
      sx={{
        width: "100%",
        bgcolor: "background.paper",
        color: "text.primary",
        border: 1.5,
        borderColor: selected ? "primary.main" : "text.primary",
        borderRadius: 0.5,
        boxShadow: selected ? 4 : 1,
      }}
    >
      {/* React Flow needs handles to render edges; FloatingEdge ignores their position. */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} isConnectable={false} />
      <Box sx={{ px: 1.5, py: 0.75, textAlign: "center" }}>
        {stereotype && (
          <Typography component="div" sx={{ fontSize: 11, lineHeight: 1.2 }}>
            {stereotype}
          </Typography>
        )}
        <Typography
          component="div"
          noWrap
          title={cls.name}
          sx={{ fontWeight: 700, fontSize: 14, fontStyle: isAbstract ? "italic" : undefined }}
        >
          {cls.name}
        </Typography>
      </Box>
      <Divider sx={{ borderColor: "text.primary" }} />
      <Section items={cls.attributes} />
      <Divider sx={{ borderColor: "text.primary" }} />
      <Section items={cls.methods} />
    </Box>
  );
});
