#!/bin/bash
# Update ReviewDisplay to latest version
# Run on server: sudo bash /var/www/reviewdisplay/deploy/update.sh

set -e

cd /var/www/reviewdisplay

echo "=== Updating ReviewDisplay ==="

# Pull latest changes
echo "Pulling latest changes..."
git pull origin main

# Install any new dependencies
echo "Installing dependencies..."
bun install
cd dashboard && bun install && cd ..

# Rebuild dashboard
echo "Rebuilding dashboard..."
cd dashboard && bun run build && cd ..

# Restart service
echo "Restarting service..."
systemctl restart reviewdisplay

echo ""
echo "=== Update Complete ==="
systemctl status reviewdisplay --no-pager
