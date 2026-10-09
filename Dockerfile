# Root Dockerfile so Render (or any Docker host) can build the app, which lives
# in the onyx-ai/ subfolder. Zero runtime dependencies — npm install is a no-op
# but kept for forward-compat. The server reads $PORT (Render injects it).
FROM node:22-alpine
WORKDIR /app
COPY onyx-ai/package.json ./
RUN npm install --omit=dev
COPY onyx-ai/ ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server/index.js"]
