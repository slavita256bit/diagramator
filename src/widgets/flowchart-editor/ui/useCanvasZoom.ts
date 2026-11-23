import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { FlowchartPoint } from "@/shared/types";
import { canvasPoint } from "../model/flowchart";

export function useCanvasZoom(active: boolean, viewport: RefObject<HTMLDivElement | null>,
  svg: RefObject<SVGSVGElement | null>, cancelDrag: () => void) {
  const [zoom, setZoom] = useState(1);
  const target = useRef<{ canvas: FlowchartPoint; screen: FlowchartPoint } | null>(null);
  const cancel = useRef(cancelDrag);
  cancel.current = cancelDrag;

  useLayoutEffect(() => {
    const matrix = svg.current?.getScreenCTM(), area = viewport.current;
    const anchor = target.current;
    target.current = null;
    if (!matrix || !area || !anchor) return;
    const { x, y } = anchor.canvas;
    area.scrollLeft += matrix.a * x + matrix.c * y + matrix.e - anchor.screen.x;
    area.scrollTop += matrix.b * x + matrix.d * y + matrix.f - anchor.screen.y;
  }, [zoom, svg, viewport]);

  useEffect(() => {
    const area = viewport.current;
    if (!active || !area) return;
    let pinch = 0;
    let gesture = 1;
    const apply = (factor: number, screen: FlowchartPoint, reset = false) => {
      const canvas = canvasPoint(svg.current?.getScreenCTM(), screen);
      if (!canvas || !Number.isFinite(factor) || factor <= 0) return;
      target.current = { canvas, screen };
      setZoom((value) => reset ? 1 : Math.max(0.25, Math.min(4, value * factor)));
    };
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? area.clientHeight : 1);
      apply(Math.exp(-Math.max(-120, Math.min(120, delta)) * 0.012), { x: event.clientX, y: event.clientY });
    };
    const touch = (event: TouchEvent) => {
      if (event.touches.length !== 2) { pinch = 0; return; }
      event.preventDefault();
      const [a, b] = [event.touches[0], event.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (!pinch) cancel.current();
      else if (distance > 0) apply(distance / pinch, { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
      pinch = distance;
    };
    const gestureStart = (event: Event) => { event.preventDefault(); gesture = 1; cancel.current(); };
    const gestureChange = (event: Event) => {
      event.preventDefault();
      if (pinch) return;
      const input = event as MouseEvent & { scale?: number };
      if (typeof input.scale !== "number" || input.scale <= 0) return;
      apply(input.scale / gesture, { x: input.clientX, y: input.clientY });
      gesture = input.scale;
    };
    const key = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || !["+", "=", "-", "0"].includes(event.key)) return;
      event.preventDefault();
      const bounds = area.getBoundingClientRect();
      apply(event.key === "-" ? 1 / 1.2 : 1.2, { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }, event.key === "0");
    };
    area.addEventListener("wheel", wheel, { passive: false });
    for (const name of ["touchstart", "touchmove", "touchend", "touchcancel"] as const) {
      area.addEventListener(name, touch, { passive: false });
    }
    area.addEventListener("gesturestart", gestureStart);
    area.addEventListener("gesturechange", gestureChange);
    area.addEventListener("keydown", key);
    return () => {
      area.removeEventListener("wheel", wheel);
      for (const name of ["touchstart", "touchmove", "touchend", "touchcancel"] as const) area.removeEventListener(name, touch);
      area.removeEventListener("gesturestart", gestureStart);
      area.removeEventListener("gesturechange", gestureChange);
      area.removeEventListener("keydown", key);
    };
  }, [active, viewport, svg]);
  return zoom;
}
