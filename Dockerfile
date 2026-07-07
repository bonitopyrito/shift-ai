# Runs the whole app in one container. Railway/Render/Fly auto-detect this,
# which makes "put it on a URL and send him the link" a one-click deploy.
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# SQLite lives in /app/data — attach a persistent volume there through your
# host's UI (Railway: service → Attach Volume → mount path /app/data).
# Railway rejects Dockerfile VOLUME instructions, so none is declared here.

CMD ["npm", "start"]
