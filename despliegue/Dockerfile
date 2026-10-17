# Imagen única del Observatorio: API (Express) + página web (React compilada).
# Se construye desde la raíz del repositorio (ver docker-compose.yml).

FROM node:22-bookworm-slim AS compilar
WORKDIR /app
COPY backend/package.json backend/package-lock.json backend/
COPY frontend/package.json frontend/package-lock.json frontend/
RUN npm ci --prefix backend && npm ci --prefix frontend
COPY backend backend
COPY frontend frontend
RUN npm run build --prefix backend \
 && npm run build --prefix frontend \
 && npm prune --omit=dev --prefix backend

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PUERTO=3000 \
    FRONTEND_DIR=/app/frontend \
    UPLOADS_DIR=/app/uploads
WORKDIR /app/backend
COPY --from=compilar /app/backend/package.json ./
COPY --from=compilar /app/backend/node_modules node_modules
COPY --from=compilar /app/backend/dist dist
COPY --from=compilar /app/backend/docs docs
COPY --from=compilar /app/frontend/dist /app/frontend
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:3000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/servidor.js"]
