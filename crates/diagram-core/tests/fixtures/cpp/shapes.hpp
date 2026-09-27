#pragma once//! Locates the external tools (Doxygen, Typst).
//!
//! Lookup order:
//! 1. `<app data>/tools/<name>` — where the (future) updater installs newer releases;
//! 2. the bundled sidecar next to the app executable (Tauri `externalBin`);
//! 3. `<name>` on `PATH`.
#include <memory>
#include <string>
#include <vector>

namespace geo {

struct Point {
    double x;
    double y;
};

class Shape {
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;
    const std::string& name() const { return name_; }
protected:
    std::string name_;
};

class Circle : public Shape {
public:
    Circle(Point center, double radius);
    double area() const override;
    static int count();
private:
    Point center_;
    double radius_;
};

class Rect : public Shape {
public:
    double area() const override;
private:
    Point topLeft_;
    Point bottomRight_;
};

class Canvas {
public:
    void add(std::unique_ptr<Shape> shape);
    void render(int width, int height) const;
private:
    std::vector<std::unique_ptr<Shape>> shapes_;
    Canvas* parent_ = nullptr;
};

} // namespace geo
