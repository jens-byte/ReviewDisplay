import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";

import widgets from "./routes/widgets";
import reviews from "./routes/reviews";
import embed from "./routes/embed";

// Initialize database
import "./db/schema";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// API routes
app.route("/api/widgets", widgets);
app.route("/api/reviews", reviews);
app.route("/embed", embed);

// Serve dashboard static files in production
app.use("/dashboard/*", serveStatic({ root: "./dashboard/dist" }));
app.get("/dashboard", serveStatic({ path: "./dashboard/dist/index.html" }));

// Health check
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Root redirect to dashboard
app.get("/", (c) => c.redirect("/dashboard"));

const port = parseInt(process.env.PORT || "3000");

console.log(`
  ╔═══════════════════════════════════════════╗
  ║     ReviewDisplay Server Started          ║
  ╠═══════════════════════════════════════════╣
  ║  API:        http://localhost:${port}/api     ║
  ║  Dashboard:  http://localhost:${port}/dashboard║
  ║  Health:     http://localhost:${port}/health   ║
  ╚═══════════════════════════════════════════╝
`);

export default {
  port,
  fetch: app.fetch,
};
