import { loadFailed, loadStarted, loadSucceeded } from "@/entities/diagram";
import { backend } from "@/shared/api";
import type { AppThunk } from "@/shared/model/hooks";
import type { Diagram } from "@/shared/types";

function load(title: string, fetch: (dir: string) => Promise<Diagram>): AppThunk<Promise<void>> {
  return async (dispatch) => {
    if (!backend.available) {
      dispatch(loadStarted("sample (browser mode)"));
      dispatch(loadSucceeded(backend.sampleDiagram()));
      return;
    }
    const dir = await backend.pickDirectory(title);
    if (!dir) return;
    dispatch(loadStarted(dir));
    try {
      dispatch(loadSucceeded(await fetch(dir)));
    } catch (e) {
      dispatch(loadFailed(String(e)));
    }
  };
}

/** Pick a C++/Java source folder, run Doxygen on it and load the diagram. */
export const analyzeProject = () => load("Select source folder", backend.analyzeProject);

/** Load a diagram from an existing Doxygen XML output folder. */
export const openDoxygenXml = () => load("Select Doxygen XML folder", backend.loadDoxygenXml);
