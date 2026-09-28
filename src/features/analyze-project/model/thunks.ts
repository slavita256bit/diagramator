import { loadFailed, loadStarted, loadSucceeded, measureClass } from "@/entities/diagram";
import { backend } from "@/shared/api";
import type { AppThunk } from "@/shared/model/hooks";
import type { Diagram, StyleProfile } from "@/shared/types";

/** Size boxes for the current style; Rust only estimates them for the initial layout. */
function sized(diagram: Diagram, style: StyleProfile): Diagram {
  for (const c of diagram.classes) Object.assign(c.position, measureClass(c, style));
  return diagram;
}

function load(title: string, fetch: (dir: string) => Promise<Diagram>): AppThunk<Promise<void>> {
  return async (dispatch, getState) => {
    if (!backend.available) {
      dispatch(loadStarted("sample (browser mode)"));
      dispatch(loadSucceeded(sized(backend.sampleDiagram(), getState().settings.style)));
      return;
    }
    const dir = await backend.pickDirectory(title);
    if (!dir) return;
    dispatch(loadStarted(dir));
    try {
      dispatch(loadSucceeded(sized(await fetch(dir), getState().settings.style)));
    } catch (e) {
      dispatch(loadFailed(String(e)));
    }
  };
}

/** Pick a C++/Java source folder, run Doxygen on it and load the diagram. */
export const analyzeProject = () => load("Select source folder", backend.analyzeProject);

/** Load a diagram from an existing Doxygen XML output folder. */
export const openDoxygenXml = () => load("Select Doxygen XML folder", backend.loadDoxygenXml);
