import { Hono } from "hono";
import { widgetQueries, type Widget } from "../db/schema";

const widgets = new Hono();

// Generate short unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Get all widgets
widgets.get("/", (c) => {
  const allWidgets = widgetQueries.getAll.all() as Widget[];
  return c.json(allWidgets);
});

// Get single widget
widgets.get("/:id", (c) => {
  const id = c.req.param("id");
  const widget = widgetQueries.getById.get(id) as Widget | null;

  if (!widget) {
    return c.json({ error: "Widget not found" }, 404);
  }

  return c.json(widget);
});

// Create widget
widgets.post("/", async (c) => {
  const body = await c.req.json();
  const id = generateId();

  const widget = {
    id,
    place_id: body.place_id,
    name: body.name || null,
    theme: body.theme || "light",
    layout: body.layout || "carousel",
    max_reviews: body.max_reviews || 5,
    min_rating: body.min_rating || 4,
    show_avatar: body.show_avatar !== false ? 1 : 0,
    show_date: body.show_date !== false ? 1 : 0,
    show_rating: body.show_rating !== false ? 1 : 0,
    custom_css: body.custom_css || null,
  };

  if (!widget.place_id) {
    return c.json({ error: "place_id is required" }, 400);
  }

  widgetQueries.create.run(
    widget.id,
    widget.place_id,
    widget.name,
    widget.theme,
    widget.layout,
    widget.max_reviews,
    widget.min_rating,
    widget.show_avatar,
    widget.show_date,
    widget.show_rating,
    widget.custom_css
  );

  const created = widgetQueries.getById.get(id) as Widget;
  return c.json(created, 201);
});

// Update widget
widgets.put("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = widgetQueries.getById.get(id) as Widget | null;

  if (!existing) {
    return c.json({ error: "Widget not found" }, 404);
  }

  const body = await c.req.json();

  widgetQueries.update.run(
    body.place_id ?? existing.place_id,
    body.name ?? existing.name,
    body.theme ?? existing.theme,
    body.layout ?? existing.layout,
    body.max_reviews ?? existing.max_reviews,
    body.min_rating ?? existing.min_rating,
    body.show_avatar !== undefined ? (body.show_avatar ? 1 : 0) : (existing.show_avatar ? 1 : 0),
    body.show_date !== undefined ? (body.show_date ? 1 : 0) : (existing.show_date ? 1 : 0),
    body.show_rating !== undefined ? (body.show_rating ? 1 : 0) : (existing.show_rating ? 1 : 0),
    body.custom_css ?? existing.custom_css,
    id
  );

  const updated = widgetQueries.getById.get(id) as Widget;
  return c.json(updated);
});

// Delete widget
widgets.delete("/:id", (c) => {
  const id = c.req.param("id");
  const existing = widgetQueries.getById.get(id) as Widget | null;

  if (!existing) {
    return c.json({ error: "Widget not found" }, 404);
  }

  widgetQueries.delete.run(id);
  return c.json({ success: true });
});

export default widgets;
