import { memo, useRef, useState, type ChangeEvent } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";
import { noteImageSet, noteLinked, noteRemoved, noteResized, noteTextChanged, selectDiagram } from "../model/diagramSlice";
import type { NoteFlowNode } from "../lib/toFlow";
import "./umlNote.css";

const MIN_WIDTH = 140;
const MIN_HEIGHT = 70;

/** Freestanding comment box (GOST fig 4.5), optionally linked to one class. */
export const UmlNoteNode = memo(function UmlNoteNode({ data, selected }: NodeProps<NoteFlowNode>) {
  const { note } = data;
  const dispatch = useAppDispatch();
  const diagram = useAppSelector(selectDiagram);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const fileInput = useRef<HTMLInputElement>(null);

  const commit = () => {
    setEditing(false);
    if (text !== note.text) dispatch(noteTextChanged({ id: note.id, text }));
  };

  const onLink = (e: ChangeEvent<HTMLSelectElement>) => dispatch(noteLinked({ id: note.id, classId: e.target.value || null }));

  const onPickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") dispatch(noteImageSet({ id: note.id, image: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`uml-note${selected ? " selected" : ""}`}>
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        onResizeEnd={(_, params) =>
          dispatch(noteResized({ id: note.id, x: params.x, y: params.y, width: params.width, height: params.height }))
        }
      />
      {/* `nodrag`/`nopan` alone isn't quite enough: React Flow's node-click/select handling
          fires on the bubbled `click`, separately from drag, so it can still steal focus from
          a <select> mid-open or race our dispatch — stop both pointerdown and click. */}
      <div
        className="uml-note-bar nodrag nopan"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <select className="uml-note-link" value={note.linkedClass ?? ""} onChange={onLink} title="Link to class">
          <option value="">No link</option>
          {diagram?.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="button" className="uml-note-icon-btn" title="Attach image" onClick={() => fileInput.current?.click()}>
          📎
        </button>
        <input ref={fileInput} type="file" accept="image/*" style={{ display: "none" }} onChange={onPickImage} />
        <button
          type="button"
          className="uml-note-icon-btn"
          title="Delete note"
          onClick={() => dispatch(noteRemoved(note.id))}
        >
          ✕
        </button>
      </div>
      {note.image && (
        <div className="uml-note-image nodrag nopan" onPointerDown={(e) => e.stopPropagation()}>
          <img src={note.image} alt="" />
          <button
            type="button"
            className="uml-note-image-remove"
            title="Remove image"
            onClick={(e) => {
              e.stopPropagation();
              dispatch(noteImageSet({ id: note.id, image: undefined }));
            }}
          >
            ✕
          </button>
        </div>
      )}
      {editing ? (
        <textarea
          className="uml-note-text nodrag nopan"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="uml-note-text" onDoubleClick={() => setEditing(true)}>
          {note.text || "Double-click to edit…"}
        </div>
      )}
    </div>
  );
});
