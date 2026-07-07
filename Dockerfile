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

# SQLite lives here — mount a volume so leads survive restarts
VOLUME /app/data

CMD ["npm", "start"]
