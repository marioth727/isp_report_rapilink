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

# FORCE REBUILD
ENV CACHE_BUST=2026-01-27-SED-METHOD

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Create template directory
RUN mkdir -p /etc/nginx/templates

# Copy Custom Config to Templates (Not conf.d directly yet)
COPY nginx.conf /etc/nginx/templates/nginx.conf

# Copy Startup Script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Copy compiled assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start with custom script
CMD ["/start.sh"]
