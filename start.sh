#!/bin/sh

echo "--- STARTING DOKPLOY DEPLOYMENT SCRIPT ---"

# Check if environment variables are present
if [ -z "$VITE_WISPHUB_API_KEY" ]; then
    echo "WARNING: VITE_WISPHUB_API_KEY is missing or empty!"
else
    echo "Injecting VITE_WISPHUB_API_KEY..."
fi

if [ -z "$VITE_SMARTOLT_API_KEY" ]; then
    echo "WARNING: VITE_SMARTOLT_API_KEY is missing or empty!"
else
    echo "Injecting VITE_SMARTOLT_API_KEY..."
fi

# Copy the config to the actual Nginx directory
cp /etc/nginx/templates/nginx.conf /etc/nginx/conf.d/default.conf

# Perform safe replacement using sed
# We look for the literal string __VITE_...__ and replace it with the Env Var content
sed -i "s|__VITE_WISPHUB_API_KEY__|$VITE_WISPHUB_API_KEY|g" /etc/nginx/conf.d/default.conf
sed -i "s|__VITE_SMARTOLT_API_KEY__|$VITE_SMARTOLT_API_KEY|g" /etc/nginx/conf.d/default.conf

echo "Configuration prepared. Starting Nginx..."
cat /etc/nginx/conf.d/default.conf | grep "proxy_set_header" # Debug (Shows keys in logs, careful, but necessary for now)

exec nginx -g 'daemon off;'
