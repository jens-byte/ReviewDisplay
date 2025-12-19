import { useState, useEffect, useRef } from "react";
import "./App.css";

const API_URL = import.meta.env.DEV ? "http://localhost:3000" : "";

interface Widget {
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

interface Review {
  id: string;
  author_name: string;
  author_photo: string | null;
  rating: number;
  text: string;
  relative_time: string;
}

type View = "list" | "create" | "edit";

function App() {
  const [view, setView] = useState<View>("list");
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWidgets();
  }, []);

  async function fetchWidgets() {
    try {
      const res = await fetch(`${API_URL}/api/widgets`);
      const data = await res.json();
      setWidgets(data);
    } catch {
      setError("Failed to load widgets");
    } finally {
      setLoading(false);
    }
  }

  function handleCreate() {
    setEditingWidget(null);
    setView("create");
  }

  function handleEdit(widget: Widget) {
    setEditingWidget(widget);
    setView("edit");
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this widget?")) return;
    try {
      await fetch(`${API_URL}/api/widgets/${id}`, { method: "DELETE" });
      setWidgets(widgets.filter((w) => w.id !== id));
    } catch {
      alert("Failed to delete widget");
    }
  }

  function handleSave(widget: Widget) {
    if (view === "create") {
      setWidgets([widget, ...widgets]);
    } else {
      setWidgets(widgets.map((w) => (w.id === widget.id ? widget : w)));
    }
    setView("list");
  }

  return (
    <div className="app">
      <header className="header">
        <h1>
          <span>★</span> ReviewDisplay
        </h1>
        {view !== "list" && (
          <button className="btn btn-secondary" onClick={() => setView("list")}>
            ← Back to Widgets
          </button>
        )}
      </header>

      <main className="main">
        {error && <div className="alert alert-error">{error}</div>}

        {view === "list" && (
          <WidgetList
            widgets={widgets}
            loading={loading}
            onCreate={handleCreate}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}

        {(view === "create" || view === "edit") && (
          <WidgetEditor
            widget={editingWidget}
            onSave={handleSave}
            onCancel={() => setView("list")}
          />
        )}
      </main>
    </div>
  );
}

function WidgetList({
  widgets,
  loading,
  onCreate,
  onEdit,
  onDelete,
}: {
  widgets: Widget[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (w: Widget) => void;
  onDelete: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading widgets...
      </div>
    );
  }

  return (
    <>
      <div className="widget-list-header">
        <h2>Your Widgets</h2>
        <button className="btn btn-primary" onClick={onCreate}>
          + Create Widget
        </button>
      </div>

      {widgets.length === 0 ? (
        <div className="empty-state card">
          <h3>No widgets yet</h3>
          <p>Create your first review widget to get started.</p>
        </div>
      ) : (
        <div className="widget-grid">
          {widgets.map((widget) => (
            <div key={widget.id} className="card widget-card">
              <div className="widget-card-header">
                <div>
                  <h3>{widget.name || "Untitled Widget"}</h3>
                  <p className="widget-card-meta">
                    {widget.layout} • {widget.theme} theme
                  </p>
                </div>
              </div>
              <p className="widget-card-meta">Place ID: {widget.place_id}</p>
              <div className="widget-card-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onEdit(widget)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => onDelete(widget.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function WidgetEditor({
  widget,
  onSave,
  onCancel,
}: {
  widget: Widget | null;
  onSave: (w: Widget) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    place_id: widget?.place_id || "",
    name: widget?.name || "",
    theme: widget?.theme || "light",
    layout: widget?.layout || "carousel",
    max_reviews: widget?.max_reviews || 5,
    min_rating: widget?.min_rating || 4,
    show_avatar: widget?.show_avatar ?? true,
    show_date: widget?.show_date ?? true,
    show_rating: widget?.show_rating ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const isEditing = widget !== null;

  async function loadPreview() {
    if (!form.place_id) return;
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/reviews/${form.place_id}`);
      const data = await res.json();
      if (data.reviews && data.reviews.length > 0) {
        setReviews(data.reviews.slice(0, form.max_reviews));
      } else {
        // API returned error or no reviews, use mock data
        setReviews(getMockReviews());
      }
    } catch {
      // Preview failed, use mock data
      setReviews(getMockReviews());
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    if (form.place_id) {
      loadPreview();
    } else {
      setReviews(getMockReviews());
    }
  }, [form.place_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.place_id) {
      alert("Place ID is required");
      return;
    }

    setSaving(true);
    try {
      const url = isEditing
        ? `${API_URL}/api/widgets/${widget.id}`
        : `${API_URL}/api/widgets`;
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const saved = await res.json();
      onSave(saved);
    } catch {
      alert("Failed to save widget");
    } finally {
      setSaving(false);
    }
  }

  function getEmbedCode() {
    if (!widget) return "Save the widget first to get embed code";
    const baseUrl = window.location.origin.replace(":5173", ":3000");
    return `<div id="review-widget" data-widget-id="${widget.id}"></div>
<script src="${baseUrl}/embed/${widget.id}.js"></script>`;
  }

  function copyEmbedCode() {
    navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="editor-layout">
      <div className="editor-panel">
        <div className="card">
          <h2>{isEditing ? "Edit Widget" : "Create Widget"}</h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Widget Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My Business Reviews"
              />
            </div>

            <div className="form-group">
              <label>Google Place ID *</label>
              <input
                type="text"
                value={form.place_id}
                onChange={(e) => setForm({ ...form, place_id: e.target.value })}
                placeholder="ChIJ..."
                required
              />
              <p className="form-hint">
                Find your Place ID at{" "}
                <a
                  href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                  target="_blank"
                  rel="noopener"
                >
                  Google's Place ID Finder
                </a>
              </p>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Theme</label>
                <select
                  value={form.theme}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      theme: e.target.value as "light" | "dark",
                    })
                  }
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="form-group">
                <label>Layout</label>
                <select
                  value={form.layout}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      layout: e.target.value as Widget["layout"],
                    })
                  }
                >
                  <option value="badge">Badge</option>
                  <option value="carousel">Carousel</option>
                  <option value="grid">Grid</option>
                  <option value="list">List</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Max Reviews</label>
                <select
                  value={form.max_reviews}
                  onChange={(e) =>
                    setForm({ ...form, max_reviews: parseInt(e.target.value) })
                  }
                >
                  {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Min Rating</label>
                <select
                  value={form.min_rating}
                  onChange={(e) =>
                    setForm({ ...form, min_rating: parseInt(e.target.value) })
                  }
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}+ stars
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Display Options</label>
              <Toggle
                label="Show avatar"
                checked={form.show_avatar}
                onChange={(v) => setForm({ ...form, show_avatar: v })}
              />
              <Toggle
                label="Show date"
                checked={form.show_date}
                onChange={(v) => setForm({ ...form, show_date: v })}
              />
              <Toggle
                label="Show rating"
                checked={form.show_rating}
                onChange={(v) => setForm({ ...form, show_rating: v })}
              />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Widget"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onCancel}
              >
                Cancel
              </button>
            </div>
          </form>

          {isEditing && (
            <div className="embed-section">
              <h3>
                Embed Code
                {copied && <span className="copied">Copied!</span>}
              </h3>
              <div className="embed-code">
                <button
                  className="btn btn-sm btn-secondary copy-btn"
                  onClick={copyEmbedCode}
                >
                  Copy
                </button>
                <pre>{getEmbedCode()}</pre>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="preview-panel">
        <h2>Preview</h2>
        <div className="preview-container">
          {previewLoading ? (
            <div className="loading">
              <div className="spinner" />
              Loading preview...
            </div>
          ) : (
            <WidgetPreview
              reviews={reviews.filter((r) => r.rating >= form.min_rating).slice(0, form.max_reviews)}
              config={form}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="toggle-group">
      <div
        className={`toggle ${checked ? "active" : ""}`}
        onClick={() => onChange(!checked)}
      />
      <span className="toggle-label">{label}</span>
    </div>
  );
}

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

function Stars({ rating, size = 18 }: { rating: number; size?: number }) {
  return (
    <div style={{ display: "flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= rating ? "#F4B400" : "#E0E0E0"}>
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      ))}
    </div>
  );
}

function Summary({ rating, totalReviews, theme }: { rating: number; totalReviews: number; theme: string }) {
  const isDark = theme === "dark";
  return (
    <div className="preview-summary" style={{ color: isDark ? "#e8e8e8" : "#3c4043" }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{rating.toFixed(1)} stars</div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <Stars rating={Math.round(rating)} size={24} />
      </div>
      <div style={{ fontSize: 13, color: isDark ? "#9aa0a6" : "#70757a", marginBottom: 16, lineHeight: 1.4 }}>
        Based on {totalReviews}<br />reviews
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, color: isDark ? "#9aa0a6" : "#70757a" }}>
        <GoogleLogo />
        <span>Google<br />reviews</span>
      </div>
    </div>
  );
}

function CarouselPreview({
  reviews,
  config,
  avgRating,
  totalReviews,
}: {
  reviews: Review[];
  config: { theme: string; show_avatar: boolean; show_date: boolean; show_rating: boolean };
  avgRating: number;
  totalReviews: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollButtons = () => {
    if (!trackRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = trackRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
  };

  useEffect(() => {
    updateScrollButtons();
  }, [reviews]);

  const scroll = (direction: "left" | "right") => {
    if (!trackRef.current) return;
    const scrollAmount = 300;
    trackRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
    setTimeout(updateScrollButtons, 300);
  };

  return (
    <div className="preview-carousel">
      <Summary rating={avgRating} totalReviews={totalReviews} theme={config.theme} />
      <button
        className="carousel-nav carousel-nav-prev"
        onClick={() => scroll("left")}
        style={{ opacity: canScrollLeft ? 1 : 0.3 }}
        disabled={!canScrollLeft}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div
        ref={trackRef}
        className="preview-carousel-track"
        onScroll={updateScrollButtons}
      >
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} config={config} />
        ))}
      </div>
      <button
        className="carousel-nav carousel-nav-next"
        onClick={() => scroll("right")}
        style={{ opacity: canScrollRight ? 1 : 0.3 }}
        disabled={!canScrollRight}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}

function WidgetPreview({
  reviews,
  config,
}: {
  reviews: Review[];
  config: {
    theme: string;
    layout: string;
    show_avatar: boolean;
    show_date: boolean;
    show_rating: boolean;
  };
}) {
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 4.5;
  const totalReviews = reviews.length || 19;
  const isDark = config.theme === "dark";

  if (config.layout === "badge") {
    return (
      <div style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 32px",
        background: isDark ? "#2d2d2d" : "#fff",
        border: `1px solid ${isDark ? "#3c4043" : "#e8eaed"}`,
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}>
        <div style={{ fontSize: 48, color: isDark ? "#e8e8e8" : "#3c4043", marginBottom: 8 }}>
          {avgRating.toFixed(1)}
        </div>
        <Stars rating={Math.round(avgRating)} size={24} />
        <div style={{ fontSize: 13, color: isDark ? "#9aa0a6" : "#70757a", margin: "8px 0 16px" }}>
          Based on {totalReviews} reviews
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: isDark ? "#9aa0a6" : "#70757a" }}>
          <GoogleLogo />
          <span>Google reviews</span>
        </div>
      </div>
    );
  }

  const reviewCards = reviews.map((review) => (
    <ReviewCard key={review.id} review={review} config={config} />
  ));

  if (config.layout === "carousel") {
    return (
      <CarouselPreview
        reviews={reviews}
        config={config}
        avgRating={avgRating}
        totalReviews={totalReviews}
      />
    );
  }

  if (config.layout === "grid") {
    return (
      <div>
        <Summary rating={avgRating} totalReviews={totalReviews} theme={config.theme} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
          {reviewCards}
        </div>
      </div>
    );
  }

  // List layout
  return (
    <div>
      <Summary rating={avgRating} totalReviews={totalReviews} theme={config.theme} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {reviewCards}
      </div>
    </div>
  );
}

function ReviewCard({
  review,
  config,
}: {
  review: Review;
  config: {
    theme: string;
    show_avatar: boolean;
    show_date: boolean;
    show_rating: boolean;
  };
}) {
  const isDark = config.theme === "dark";
  return (
    <div style={{
      flexShrink: 0,
      width: config.show_avatar ? "auto" : 280,
      minWidth: 280,
      background: isDark ? "#2d2d2d" : "#fff",
      border: `1px solid ${isDark ? "#3c4043" : "#e8eaed"}`,
      borderRadius: 8,
      padding: 16,
      boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <Stars rating={review.rating} size={18} />
        <GoogleLogo />
      </div>
      {config.show_date && (
        <div style={{ fontSize: 12, color: isDark ? "#9aa0a6" : "#70757a", marginBottom: 12 }}>
          {review.relative_time}
        </div>
      )}
      <p style={{
        fontSize: 14,
        lineHeight: 1.5,
        color: isDark ? "#e8e8e8" : "#3c4043",
        margin: "0 0 12px 0",
        display: "-webkit-box",
        WebkitLineClamp: 4,
        WebkitBoxOrient: "vertical" as const,
        overflow: "hidden",
      }}>
        {review.text}
      </p>
      <div style={{ fontSize: 13, fontWeight: 500, color: isDark ? "#e8e8e8" : "#3c4043" }}>
        {review.author_name}
      </div>
    </div>
  );
}

function getMockReviews(): Review[] {
  return [
    {
      id: "1",
      author_name: "John Smith",
      author_photo: null,
      rating: 5,
      text: "Excellent service! The team was professional and delivered exactly what we needed. Highly recommended.",
      relative_time: "2 weeks ago",
    },
    {
      id: "2",
      author_name: "Sarah Johnson",
      author_photo: null,
      rating: 5,
      text: "Great experience from start to finish. Very responsive and the quality exceeded our expectations.",
      relative_time: "1 month ago",
    },
    {
      id: "3",
      author_name: "Mike Williams",
      author_photo: null,
      rating: 4,
      text: "Good work overall. Communication could be slightly better but the end result was solid.",
      relative_time: "2 months ago",
    },
  ];
}

export default App;
