import { useCallback, useEffect, useRef, useState } from "react";
import { backend } from "@/shared/api";
import type { FlowchartRevision } from "@/shared/api/backend";
import type { Flowchart } from "@/shared/types";
import { labelPosition, parseFlowchart } from "./flowchart";
import { attachLegacyBranchLabels, resolvedRoutes } from "./resolvedGeometry";

const emptyRevision = { json: null, typst: null };
const recentKey = "diagramator.recentBlockSchemes";

function readRecents(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(recentKey) ?? "[]");
    return Array.isArray(stored) ? stored.filter((path): path is string => typeof path === "string").slice(0, 10) : [];
  } catch { return []; }
}

export function useFlowchartFiles(chart: Flowchart, load: (chart: Flowchart) => void) {
  const [file, setFile] = useState<{ path: string; revision: FlowchartRevision } | null>(null);
  const [saved, setSaved] = useState(chart);
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recents, setRecents] = useState(readRecents);
  const pending = useRef(false);
  const attempted = useRef<Flowchart | null>(null);
  const latestChart = useRef(chart);
  latestChart.current = chart;
  const input = useRef<HTMLInputElement>(null);
  const dirty = saved !== chart;

  useEffect(() => {
    try { localStorage.setItem(recentKey, JSON.stringify(recents)); } catch { /* optional */ }
  }, [recents]);
  const remember = useCallback((path: string) => {
    setRecents((previous) => [path, ...previous.filter((item) => item !== path)].slice(0, 10));
  }, []);
  const accept = (contents: string, nextFile: typeof file) => {
    const next = attachLegacyBranchLabels(parseFlowchart(contents));
    load(next);
    setFile(nextFile);
    setSaved(next);
    setError("");
    setExportError("");
    attempted.current = null;
    if (nextFile) remember(nextFile.path);
  };
  const run = useCallback(async (operation: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try { await operation(); }
    catch (error) { setError(String(error)); }
    finally { pending.current = false; setBusy(false); }
  }, []);
  const open = (path?: string) => run(async () => {
    if (dirty && !window.confirm("Discard unsaved block-scheme changes?")) return;
    if (!backend.available) { input.current?.click(); return; }
    const current = latestChart.current;
    const destination = path ?? await backend.pickFile("Open block scheme", ["json"]);
    if (!destination) return;
    const revision = await backend.readFlowchart(destination);
    if (revision.json === null) throw new Error("The block-scheme file no longer exists.");
    if (current !== latestChart.current && !window.confirm("Discard changes made while opening the file?")) return;
    accept(revision.json, { path: destination, revision });
  });
  const pick = (selected: File) => run(async () => accept(await selected.text(), null));

  const save = useCallback((saveAs = false) => run(async () => {
    if (backend.available) {
      const destination = saveAs || !file
        ? await backend.pickSavePath("Save block scheme", file?.path ?? "flowchart.json", ["json"])
        : file.path;
      if (!destination) return;
      const snapshot = latestChart.current;
      attempted.current = snapshot;
      const geometry = resolvedRoutes(snapshot);
      const render = { ...snapshot,
        routes: snapshot.routes.map((route) => ({ ...route, points: geometry.get(route.id)! })),
        labels: snapshot.labels.map((label) => ({ ...label, anchor: undefined, position: labelPosition(label, snapshot.nodes, geometry) })),
      };
      const result = await backend.writeFlowchart(destination, JSON.stringify(snapshot, null, 2) + "\n",
        JSON.stringify(render), destination === file?.path ? file.revision : emptyRevision);
      setFile({ path: destination, revision: result.revision });
      setExportError(result.export_error ?? "");
      setSaved(snapshot);
      remember(destination);
    } else {
      const snapshot = latestChart.current;
      const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2) + "\n"], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "flowchart.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setSaved(snapshot);
    }
    setError("");
  }), [file, remember, run]);

  useEffect(() => {
    if (!file || !dirty || busy || attempted.current === chart || error) return;
    const timer = setTimeout(() => { void save(); }, 600);
    return () => clearTimeout(timer);
  }, [file, chart, dirty, busy, error, save]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return { path: file?.path, dirty, busy, error, exportError, input, open, pick, save,
    recents, forget: (path: string) => setRecents((previous) => previous.filter((item) => item !== path)) };
}
