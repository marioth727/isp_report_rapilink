# Stage 1: Build the Application
FROM node:20-alpine as build

WORKDIR /app

# Install dependencies (only package files for caching)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build arguments for Vite (Environment Variables)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Set environment variables during build time
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV NODE_ENV=production

# Build the project
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

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
