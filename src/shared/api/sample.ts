import type { Diagram } from "@/shared/types";

/** Demo diagram shown when running outside Tauri. Matches the C++ test fixture output. */
export const sampleDiagram: Diagram = {
  classes: [
    {
      id: "shape",
      name: "geo::Shape",
      kind: "class",
      attributes: ["# name_: std::string"],
      methods: ["+ ~Shape()", "+ area(): double {abstract}", "+ name(): const std::string&"],
      position: { x: 360, y: 0, width: 226, height: 128 },
    },
    {
      id: "circle",
      name: "geo::Circle",
      kind: "class",
      attributes: ["- center_: Point", "- radius_: double"],
      methods: ["+ Circle(center: Point, radius: double)", "+ area(): double", "+ count(): int {static}"],
      position: { x: 160, y: 230, width: 305, height: 146 },
    },
    {
      id: "rect",
      name: "geo::Rect",
      kind: "class",
      attributes: ["- topLeft_: Point", "- bottomRight_: Point"],
      methods: ["+ area(): double"],
      position: { x: 530, y: 230, width: 175, height: 110 },
    },
    {
      id: "point",
      name: "geo::Point",
      kind: "struct",
      attributes: ["+ x: double", "+ y: double"],
      methods: [],
      position: { x: 380, y: 470, width: 140, height: 110 },
    },
    {
      id: "canvas",
      name: "geo::Canvas",
      kind: "class",
      attributes: ["- shapes_: std::vector<std::unique_ptr<Shape>>", "- parent_: Canvas*"],
      methods: ["+ add(shape: std::unique_ptr<Shape>): void", "+ render(width: int, height: int): void"],
      position: { x: -80, y: -20, width: 355, height: 128 },
    },
  ],
  relations: [
    { source: "circle", target: "shape", type: "inheritance" },
    { source: "rect", target: "shape", type: "inheritance" },
    { source: "circle", target: "point", type: "composition" },
    { source: "rect", target: "point", type: "composition" },
    { source: "canvas", target: "shape", type: "composition" },
    { source: "canvas", target: "canvas", type: "association" },
  ],
};
