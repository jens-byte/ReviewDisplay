# ReviewDisplay

A Google Reviews widget tool that lets you embed beautiful review widgets on any website. Similar to review-widget.net but self-hosted.

## Features

- **4 Widget Layouts**: Badge, Carousel, Grid, List
- **Light/Dark Themes**: Matches your website design
- **Google Branding**: Authentic Google-style review cards
- **Simple Embed**: Just 2 lines of HTML
- **Dashboard**: Easy widget configuration UI
- **Caching**: Reviews cached to minimize API costs

## Tech Stack

- **Runtime**: Bun
- **Backend**: Hono (fast web framework)
- **Database**: SQLite
- **Dashboard**: React + Vite
- **Widget**: Vanilla JS (~10KB)

## Local Development

### Prerequisites

- [Bun](https://bun.sh) installed
- Google Places API key (optional for testing)

### Setup

```bash
# Clone the repository
git clone https://github.com/jens-byte/ReviewDisplay.git
cd ReviewDisplay

# Install dependencies
bun install
cd dashboard && bun install && cd ..

# Create environment file
cp .env.example .env
# Edit .env and add your GOOGLE_PLACES_API_KEY

# Start the API server
bun run dev

# In another terminal, start the dashboard
bun run dashboard
```

- Dashboard: http://localhost:5173
- API: http://localhost:3000

## Deployment (DigitalOcean/Ubuntu)

### Quick Deploy

SSH into your server and run:

```bash
# Download and run setup script
curl -fsSL https://raw.githubusercontent.com/jens-byte/ReviewDisplay/main/deploy/setup.sh | sudo bash

# Configure Nginx and SSL (replace with your domain)
sudo bash /var/www/reviewdisplay/deploy/configure-nginx.sh yourdomain.com

# Edit environment variables
sudo nano /var/www/reviewdisplay/.env
# Add your GOOGLE_PLACES_API_KEY

# Restart the service
sudo systemctl restart reviewdisplay
```

### Manual Deploy

1. **Install Bun**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Clone & Install**
   ```bash
   cd /var/www
   git clone https://github.com/jens-byte/ReviewDisplay.git reviewdisplay
   cd reviewdisplay
   bun install
   cd dashboard && bun install && bun run build && cd ..
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   nano .env  # Add your API key
   ```

4. **Setup Nginx** (see `deploy/configure-nginx.sh`)

5. **Setup Systemd Service** (see `deploy/configure-nginx.sh`)

### Update Deployment

```bash
sudo bash /var/www/reviewdisplay/deploy/update.sh
```

### Useful Commands

```bash
# View logs
journalctl -u reviewdisplay -f

# Restart service
sudo systemctl restart reviewdisplay

# Check status
sudo systemctl status reviewdisplay
```

## Usage

1. Open the dashboard
2. Click "Create Widget"
3. Enter your Google Place ID ([Find your Place ID](https://developers.google.com/maps/documentation/places/web-service/place-id))
4. Customize the appearance
5. Copy the embed code
6. Paste into your website

### Embed Code Example

```html
<div id="review-widget" data-widget-id="abc123"></div>
<script src="https://yourdomain.com/embed/abc123.js"></script>
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `DATABASE_PATH` | SQLite database path | No |
| `GOOGLE_PLACES_API_KEY` | Google Places API key | Yes* |

*Required for fetching real reviews. Widget works with mock data without it.

## License

MIT
