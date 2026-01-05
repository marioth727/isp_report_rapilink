# Etapa 1: Build
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Variables de construcción para Vite
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# Etapa 2: Runtime
FROM node:20-slim AS runtime

WORKDIR /app

# Solo copiamos lo necesario para correr el servidor
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./
COPY --from=build /app/package*.json ./

# Instalamos solo dependencias de producción
RUN npm install --omit=dev

EXPOSE 3000

CMD ["node", "server.js"]
