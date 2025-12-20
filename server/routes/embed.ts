import { Hono } from "hono";
import { widgetQueries, type Widget, type Review } from "../db/schema";
import { fetchGoogleReviews } from "../services/google";

const embed = new Hono();

// Serve widget data as JSON (for widget to fetch)
embed.get("/data/:widgetId", async (c) => {
  const widgetId = c.req.param("widgetId");
  const widget = widgetQueries.getById.get(widgetId) as Widget | null;

  if (!widget) {
    return c.json({ error: "Widget not found" }, 404);
  }

  try {
    const placeInfo = await fetchGoogleReviews(widget.place_id);

    // Filter reviews by min rating
    const filteredReviews = placeInfo.reviews
      .filter((r) => r.rating >= widget.min_rating)
      .slice(0, widget.max_reviews);

    return c.json({
      widget: {
        id: widget.id,
        theme: widget.theme,
        layout: widget.layout,
        visible_cards: widget.visible_cards || 2,
        show_avatar: Boolean(widget.show_avatar),
        show_date: Boolean(widget.show_date),
        show_rating: Boolean(widget.show_rating),
        custom_css: widget.custom_css,
      },
      place: {
        name: placeInfo.name,
        rating: placeInfo.rating,
        totalReviews: placeInfo.totalReviews,
      },
      reviews: filteredReviews,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// Serve embeddable widget script
embed.get("/:file", async (c) => {
  const file = c.req.param("file");

  // Only handle .js files
  if (!file.endsWith(".js")) {
    return c.text("Not found", 404);
  }

  const widgetId = file.replace(".js", "");
  const widget = widgetQueries.getById.get(widgetId) as Widget | null;

  if (!widget) {
    return c.text("console.error('ReviewWidget: Widget not found');", 404, {
      "Content-Type": "application/javascript",
    });
  }

  // Get the host from request for API URL
  const host = c.req.header("host") || "localhost:3000";
  const protocol = c.req.header("x-forwarded-proto") || "http";
  const baseUrl = `${protocol}://${host}`;

  const script = generateWidgetScript(widgetId, baseUrl);

  return c.text(script, 200, {
    "Content-Type": "application/javascript",
    "Cache-Control": "public, max-age=300",
  });
});

function generateWidgetScript(widgetId: string, baseUrl: string): string {
  return `
(function() {
  const WIDGET_ID = "${widgetId}";
  const API_URL = "${baseUrl}/embed/data/" + WIDGET_ID;

  const container = document.querySelector('[data-widget-id="${widgetId}"]') || document.getElementById('review-widget');
  if (!container) {
    console.error('ReviewWidget: Container not found');
    return;
  }

  container.innerHTML = '<div class="rw-loading">Loading reviews...</div>';

  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        container.innerHTML = '<div class="rw-error">' + data.error + '</div>';
        return;
      }
      renderWidget(container, data);
    })
    .catch(err => {
      container.innerHTML = '<div class="rw-error">Failed to load reviews</div>';
      console.error('ReviewWidget:', err);
    });

  function renderWidget(el, data) {
    const { widget, place, reviews } = data;

    // Inject styles
    if (!document.getElementById('rw-styles')) {
      const style = document.createElement('style');
      style.id = 'rw-styles';
      style.textContent = getStyles(widget.theme, widget.visible_cards || 2);
      document.head.appendChild(style);
    }

    // Render based on layout
    let html = '';
    switch (widget.layout) {
      case 'badge':
        html = renderBadge(place);
        break;
      case 'carousel':
        html = renderCarousel(reviews, widget, place);
        break;
      case 'grid':
        html = renderGrid(reviews, widget, place);
        break;
      case 'list':
      default:
        html = renderList(reviews, widget, place);
    }

    el.innerHTML = html;

    // Add carousel functionality
    if (widget.layout === 'carousel') {
      initCarousel(el);
    }

    // Add custom CSS if any
    if (widget.custom_css) {
      const customStyle = document.createElement('style');
      customStyle.textContent = widget.custom_css;
      el.appendChild(customStyle);
    }
  }

  // Google "G" logo SVG
  const googleLogo = \`<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>\`;

  function renderStars(rating, size = 20) {
    return Array(5).fill(0).map((_, i) =>
      \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="\${i < rating ? '#F4B400' : '#E0E0E0'}">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
      </svg>\`
    ).join('');
  }

  function truncateText(text, maxLength = 120) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...<span class="rw-more">more</span>';
  }

  function renderReviewCard(review, widget) {
    return \`
      <div class="rw-card">
        <div class="rw-card-header">
          <div class="rw-card-stars">\${renderStars(review.rating, 18)}</div>
          <div class="rw-card-google">\${googleLogo}</div>
        </div>
        <div class="rw-card-date">\${review.relative_time}</div>
        <p class="rw-card-text">\${truncateText(review.text)}</p>
        <div class="rw-card-author">\${review.author_name}</div>
      </div>
    \`;
  }

  function renderBadge(place) {
    return \`
      <div class="rw-badge">
        <div class="rw-badge-score">\${place.rating.toFixed(1)}</div>
        <div class="rw-badge-stars">\${renderStars(Math.round(place.rating), 24)}</div>
        <div class="rw-badge-meta">
          <span>Based on \${place.totalReviews} reviews</span>
        </div>
        <div class="rw-badge-google">
          \${googleLogo}
          <span>Google reviews</span>
        </div>
      </div>
    \`;
  }

  function renderSummary(place) {
    return \`
      <div class="rw-summary">
        <div class="rw-summary-score">\${place.rating.toFixed(1)} stars</div>
        <div class="rw-summary-stars">\${renderStars(Math.round(place.rating), 28)}</div>
        <div class="rw-summary-count">Based on \${place.totalReviews}<br>reviews</div>
        <div class="rw-summary-google">
          \${googleLogo}
          <span>Google<br>reviews</span>
        </div>
      </div>
    \`;
  }

  function renderCarousel(reviews, widget, place) {
    return \`
      <div class="rw-container">
        \${renderSummary(place)}
        <button class="rw-nav rw-nav-prev" aria-label="Previous">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <div class="rw-track">
          \${reviews.map(r => renderReviewCard(r, widget)).join('')}
        </div>
        <button class="rw-nav rw-nav-next" aria-label="Next">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>
    \`;
  }

  function renderGrid(reviews, widget, place) {
    return \`
      <div class="rw-grid-container">
        \${renderSummary(place)}
        <div class="rw-grid">
          \${reviews.map(r => renderReviewCard(r, widget)).join('')}
        </div>
      </div>
    \`;
  }

  function renderList(reviews, widget, place) {
    return \`
      <div class="rw-list-container">
        \${renderSummary(place)}
        <div class="rw-list">
          \${reviews.map(r => renderReviewCard(r, widget)).join('')}
        </div>
      </div>
    \`;
  }

  function initCarousel(el) {
    const track = el.querySelector('.rw-track');
    const prevBtn = el.querySelector('.rw-nav-prev');
    const nextBtn = el.querySelector('.rw-nav-next');
    if (!track || !prevBtn || !nextBtn) return;

    const cardWidth = 290;
    const gap = 16;
    const scrollAmount = cardWidth + gap;

    function updateButtons() {
      prevBtn.style.opacity = track.scrollLeft <= 0 ? '0.3' : '1';
      prevBtn.style.pointerEvents = track.scrollLeft <= 0 ? 'none' : 'auto';
      const maxScroll = track.scrollWidth - track.clientWidth;
      nextBtn.style.opacity = track.scrollLeft >= maxScroll - 5 ? '0.3' : '1';
      nextBtn.style.pointerEvents = track.scrollLeft >= maxScroll - 5 ? 'none' : 'auto';
    }

    prevBtn.addEventListener('click', () => {
      track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', () => {
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });

    track.addEventListener('scroll', updateButtons);
    updateButtons();
  }

  function getStyles(theme, visibleCards) {
    const isDark = theme === 'dark';
    const bg = isDark ? '#1f1f1f' : '#ffffff';
    const cardBg = isDark ? '#2d2d2d' : '#ffffff';
    const text = isDark ? '#e8e8e8' : '#3c4043';
    const textMuted = isDark ? '#9aa0a6' : '#70757a';
    const border = isDark ? '#3c4043' : '#e8eaed';
    const shadow = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)';
    const cardWidth = 280;
    const gap = 16;
    const trackMaxWidth = (cardWidth * visibleCards) + (gap * (visibleCards - 1)) + 20;

    return \`
      .rw-loading, .rw-error {
        padding: 40px 20px;
        text-align: center;
        color: \${textMuted};
        font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
      }
      .rw-error { color: #d93025; }

      /* Main Container */
      .rw-container {
        display: flex;
        align-items: center;
        gap: 16px;
        font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, sans-serif;
        padding: 8px 0;
      }

      /* Summary Sidebar */
      .rw-summary {
        flex-shrink: 0;
        text-align: center;
        padding: 20px 24px;
        min-width: 140px;
      }
      .rw-summary-score {
        font-size: 22px;
        font-weight: 400;
        color: \${text};
        margin-bottom: 8px;
      }
      .rw-summary-stars {
        display: flex;
        justify-content: center;
        gap: 2px;
        margin-bottom: 8px;
      }
      .rw-summary-count {
        font-size: 13px;
        color: \${textMuted};
        line-height: 1.4;
        margin-bottom: 16px;
      }
      .rw-summary-google {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 13px;
        color: \${textMuted};
        line-height: 1.3;
      }
      .rw-summary-google svg {
        flex-shrink: 0;
      }

      /* Navigation Buttons */
      .rw-nav {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 1px solid \${border};
        background: \${bg};
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: \${textMuted};
        transition: all 0.2s ease;
        box-shadow: 0 1px 3px \${shadow};
      }
      .rw-nav:hover {
        background: \${isDark ? '#3c4043' : '#f8f9fa'};
        color: \${text};
      }

      /* Track */
      .rw-track {
        display: flex;
        gap: 16px;
        overflow-x: auto;
        scroll-behavior: smooth;
        scrollbar-width: none;
        -ms-overflow-style: none;
        padding: 8px 4px;
        max-width: \${trackMaxWidth}px;
      }
      .rw-track::-webkit-scrollbar { display: none; }

      /* Review Card */
      .rw-card {
        flex-shrink: 0;
        width: 280px;
        background: \${cardBg};
        border: 1px solid \${border};
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 1px 2px \${shadow};
        transition: box-shadow 0.2s ease;
      }
      .rw-card:hover {
        box-shadow: 0 4px 12px \${shadow};
      }
      .rw-card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 4px;
      }
      .rw-card-stars {
        display: flex;
        gap: 1px;
      }
      .rw-card-google {
        flex-shrink: 0;
      }
      .rw-card-date {
        font-size: 12px;
        color: \${textMuted};
        margin-bottom: 12px;
      }
      .rw-card-text {
        font-size: 14px;
        line-height: 1.5;
        color: \${text};
        margin: 0 0 12px 0;
        display: -webkit-box;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .rw-more {
        color: #1a73e8;
        cursor: pointer;
      }
      .rw-card-author {
        font-size: 13px;
        font-weight: 500;
        color: \${text};
      }

      /* Badge */
      .rw-badge {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        padding: 24px 32px;
        background: \${cardBg};
        border: 1px solid \${border};
        border-radius: 8px;
        font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, sans-serif;
        box-shadow: 0 1px 3px \${shadow};
      }
      .rw-badge-score {
        font-size: 48px;
        font-weight: 400;
        color: \${text};
        line-height: 1;
        margin-bottom: 8px;
      }
      .rw-badge-stars {
        display: flex;
        gap: 2px;
        margin-bottom: 8px;
      }
      .rw-badge-meta {
        font-size: 13px;
        color: \${textMuted};
        margin-bottom: 16px;
      }
      .rw-badge-google {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: \${textMuted};
      }

      /* Grid Layout */
      .rw-grid-container {
        font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .rw-grid-container .rw-summary {
        margin-bottom: 16px;
      }
      .rw-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
      }
      .rw-grid .rw-card {
        width: auto;
      }

      /* List Layout */
      .rw-list-container {
        font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .rw-list-container .rw-summary {
        margin-bottom: 16px;
      }
      .rw-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .rw-list .rw-card {
        width: auto;
        max-width: 600px;
      }
      .rw-list .rw-card-text {
        -webkit-line-clamp: unset;
      }

      /* Responsive */
      @media (max-width: 640px) {
        .rw-container {
          flex-direction: column;
        }
        .rw-summary {
          padding: 16px;
        }
        .rw-nav {
          display: none;
        }
        .rw-track {
          padding-left: 16px;
          padding-right: 16px;
        }
      }
    \`;
  }
})();
`;
}

export default embed;
