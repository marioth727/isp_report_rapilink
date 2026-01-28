# Stage 1: Build the Application
FROM node:20-alpine as build

WORKDIR /app

# Install dependencies (only package files for caching)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# DEBUG: List files to ensure source is copied correctly
RUN echo "--- DEBUG: Source Files in /app ---" && ls -la

# Build arguments for Vite (Environment Variables)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Set environment variables during build time
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV NODE_ENV=production

# Build the project
RUN npm run build

# DEBUG: Verify build output
RUN echo "--- DEBUG: Build Output in /app/dist ---" && ls -la dist || echo "DIST NOT FOUND"

# CRITICAL: Fail build if index.html is missing
RUN test -f dist/index.html || (echo "ERROR: index.html missing in dist folder" && exit 1)

# Stage 2: Serve with Nginx
FROM nginx:alpine

# FORCE REBUILD: Change this timestamp to bust cache
ENV CACHE_BUST=2026-01-27-FIX-404

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy custom nginx configuration (STATIC - protects $uri)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy api proxies configuration (TEMPLATE - processes Env Vars)
COPY api_proxies.conf /etc/nginx/templates/api_proxies.conf.template

# Copy compiled assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
