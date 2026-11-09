FROM node:22-bookworm-slim AS tools
WORKDIR /app
COPY package*.json ./
COPY backend/package.json ./backend/package.json
RUN npm ci
COPY . .
RUN npm run build:backend

FROM tools AS build
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
RUN npm run build

FROM node:22-bookworm-slim AS api-runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY backend/package.json ./backend/package.json
RUN npm ci --omit=dev --workspace backend --include-workspace-root=false
COPY --from=tools --chown=node:node /app/backend/dist ./backend/dist
USER node
WORKDIR /app/backend
EXPOSE 3001
CMD ["node", "dist/main.js"]

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node","server.js"]
