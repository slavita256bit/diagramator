import { loadFailed, loadStarted, loadSucceeded, measureClass } from "@/entities/diagram";
import { recentOpened, styleSet } from "@/entities/settings";
import { backend } from "@/shared/api";
import type { AppThunk } from "@/shared/model/hooks";
import type { Diagram, StyleProfile } from "@/shared/types";

/** Size boxes for the current style; Rust only estimates them for the initial layout. */
function sized(diagram: Diagram, style: StyleProfile): Diagram {
  for (const c of diagram.classes) Object.assign(c.position, measureClass(c, style));
  return diagram;
}

/** Run Doxygen on `dir`; restore positions and style from its `diagramator.json`. */
export const openProject =
  (dir: string): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    dispatch(loadStarted(dir));
    try {
      const { diagram, project } = await backend.analyzeProject(dir);
      if (project?.style) dispatch(styleSet(project.style));
      dispatch(loadSucceeded({ diagram: sized(diagram, getState().settings.style), projectDir: dir }));
      dispatch(recentOpened(dir));
    } catch (e) {
      dispatch(loadFailed(String(e)));
    }
  };

/** Copy a bundled example to a writable folder and open it. */
export const openExample =
  (name: string): AppThunk<Promise<void>> =>
  async (dispatch) => {
    try {
      await dispatch(openProject(await backend.prepareExample(name)));
    } catch (e) {
      dispatch(loadFailed(String(e)));
    }
  };

/** Pick a C++/Java source folder and open it as a project. */
export const analyzeProject = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  if (!backend.available) {
    dispatch(loadStarted("sample (browser mode)"));
    const diagram = sized(backend.sampleDiagram(), getState().settings.style);
    dispatch(loadSucceeded({ diagram, projectDir: null }));
    return;
  }
  const dir = await backend.pickDirectory("Select source folder");
  if (dir) await dispatch(openProject(dir));
};

/** Load a diagram from an existing Doxygen XML output folder (no project file, no autosave). */
export const openDoxygenXml = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const dir = await backend.pickDirectory("Select Doxygen XML folder");
  if (!dir) return;
  dispatch(loadStarted(dir));
  try {
    const diagram = sized(await backend.loadDoxygenXml(dir), getState().settings.style);
    dispatch(loadSucceeded({ diagram, projectDir: null }));
  } catch (e) {
    dispatch(loadFailed(String(e)));
  }
};
