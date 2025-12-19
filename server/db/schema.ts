import { Database } from "bun:sqlite";

const DB_PATH = process.env.DATABASE_PATH || "./data/reviews.db";

export const db = new Database(DB_PATH, { create: true });

// Initialize schema
db.run(`
  CREATE TABLE IF NOT EXISTS widgets (
    id TEXT PRIMARY KEY,
    place_id TEXT NOT NULL,
    name TEXT,
    theme TEXT DEFAULT 'light',
    layout TEXT DEFAULT 'carousel',
    max_reviews INTEGER DEFAULT 5,
    min_rating INTEGER DEFAULT 4,
    show_avatar INTEGER DEFAULT 1,
    show_date INTEGER DEFAULT 1,
    show_rating INTEGER DEFAULT 1,
    custom_css TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    place_id TEXT NOT NULL,
    author_name TEXT,
    author_photo TEXT,
    rating INTEGER,
    text TEXT,
    time INTEGER,
    relative_time TEXT,
    fetched_at TEXT DEFAULT (datetime('now'))
  )
`);

db.run(`CREATE INDEX IF NOT EXISTS idx_reviews_place_id ON reviews(place_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_reviews_fetched_at ON reviews(fetched_at)`);

// Types
export interface Widget {
  id: string;
  place_id: string;
  name: string | null;
  theme: "light" | "dark";
  layout: "badge" | "carousel" | "grid" | "list";
  max_reviews: number;
  min_rating: number;
  show_avatar: boolean;
  show_date: boolean;
  show_rating: boolean;
  custom_css: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  place_id: string;
  author_name: string;
  author_photo: string | null;
  rating: number;
  text: string;
  time: number;
  relative_time: string;
  fetched_at: string;
}

// Widget queries
export const widgetQueries = {
  create: db.prepare(`
    INSERT INTO widgets (id, place_id, name, theme, layout, max_reviews, min_rating, show_avatar, show_date, show_rating, custom_css)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getById: db.prepare(`SELECT * FROM widgets WHERE id = ?`),

  getAll: db.prepare(`SELECT * FROM widgets ORDER BY created_at DESC`),

  update: db.prepare(`
    UPDATE widgets
    SET place_id = ?, name = ?, theme = ?, layout = ?, max_reviews = ?, min_rating = ?,
        show_avatar = ?, show_date = ?, show_rating = ?, custom_css = ?, updated_at = datetime('now')
    WHERE id = ?
  `),

  delete: db.prepare(`DELETE FROM widgets WHERE id = ?`),
};

// Review queries
export const reviewQueries = {
  upsert: db.prepare(`
    INSERT OR REPLACE INTO reviews (id, place_id, author_name, author_photo, rating, text, time, relative_time, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `),

  getByPlaceId: db.prepare(`
    SELECT * FROM reviews WHERE place_id = ? ORDER BY time DESC
  `),

  getLastFetchTime: db.prepare(`
    SELECT MAX(fetched_at) as last_fetch FROM reviews WHERE place_id = ?
  `),

  deleteOld: db.prepare(`
    DELETE FROM reviews WHERE place_id = ? AND fetched_at < datetime('now', '-7 days')
  `),
};
