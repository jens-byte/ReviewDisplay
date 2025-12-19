#!/bin/bash
# ReviewDisplay Server Setup Script for Ubuntu 22.04/24.04
# Run this script on your DigitalOcean droplet as root

set -e

echo "=== ReviewDisplay Server Setup ==="

# Update system
echo "Updating system packages..."
apt update && apt upgrade -y

# Install dependencies
echo "Installing dependencies..."
apt install -y curl unzip git nginx certbot python3-certbot-nginx

# Install Bun
echo "Installing Bun..."
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Add Bun to PATH permanently
echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc

# Create app directory
echo "Setting up application directory..."
mkdir -p /var/www/reviewdisplay
cd /var/www/reviewdisplay

# Clone repository
echo "Cloning repository..."
git clone https://github.com/jens-byte/ReviewDisplay.git .

# Install dependencies
echo "Installing application dependencies..."
$BUN_INSTALL/bin/bun install
cd dashboard && $BUN_INSTALL/bin/bun install && cd ..

# Build dashboard
echo "Building dashboard..."
cd dashboard && $BUN_INSTALL/bin/bun run build && cd ..

# Create data directory
mkdir -p data

# Create environment file
echo "Creating environment file..."
cat > .env << 'ENVEOF'
PORT=3000
DATABASE_PATH=./data/reviews.db
# Add your Google Places API key below:
# GOOGLE_PLACES_API_KEY=your_api_key_here
ENVEOF

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Edit /var/www/reviewdisplay/.env and add your GOOGLE_PLACES_API_KEY"
echo "2. Run: sudo bash /var/www/reviewdisplay/deploy/configure-nginx.sh YOUR_DOMAIN"
echo "3. Run: sudo systemctl start reviewdisplay"
echo ""
