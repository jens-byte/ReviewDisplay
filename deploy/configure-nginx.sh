#!/bin/bash
# Configure Nginx and SSL for ReviewDisplay
# Usage: sudo bash configure-nginx.sh yourdomain.com

set -e

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "Usage: sudo bash configure-nginx.sh yourdomain.com"
    exit 1
fi

echo "=== Configuring Nginx for $DOMAIN ==="

# Create Nginx config
cat > /etc/nginx/sites-available/reviewdisplay << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXEOF

# Enable site
ln -sf /etc/nginx/sites-available/reviewdisplay /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
nginx -t

# Reload Nginx
systemctl reload nginx

# Setup systemd service
cat > /etc/systemd/system/reviewdisplay.service << 'SERVICEEOF'
[Unit]
Description=ReviewDisplay Google Reviews Widget
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/reviewdisplay
Environment=PATH=/root/.bun/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/root/.bun/bin/bun run server/index.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Enable and start service
systemctl daemon-reload
systemctl enable reviewdisplay
systemctl start reviewdisplay

echo ""
echo "=== Nginx configured ==="
echo ""
echo "Setting up SSL certificate..."

# Get SSL certificate
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email

echo ""
echo "=== Deployment Complete! ==="
echo ""
echo "Your ReviewDisplay is now live at: https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  - View logs:     journalctl -u reviewdisplay -f"
echo "  - Restart app:   systemctl restart reviewdisplay"
echo "  - Stop app:      systemctl stop reviewdisplay"
echo "  - Check status:  systemctl status reviewdisplay"
echo ""
