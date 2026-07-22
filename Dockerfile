# Panel de Gestión O3 — un solo contenedor: build de Vite + servidor Fastify.
FROM node:22-slim

WORKDIR /app

# Deps (incluye devDeps: vite para el build y tsx para correr el server).
COPY package*.json ./
RUN npm ci

# Código y build del frontend (genera dist/).
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# El server sirve dist/ y las rutas /api. Conecta a Postgres vía DATABASE_URL.
CMD ["npm", "run", "start"]
