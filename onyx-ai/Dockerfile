# Container image for Onyx AI (used by Fly.io or any Docker host; Render uses
# the native Node runtime via ../render.yaml and does not need this file).
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/index.js"]
