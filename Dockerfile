# Multi-stage not needed for a simple Node API, but we keep it lean.
FROM node:20-slim

WORKDIR /app

# Install deps first for layer caching
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# App source
COPY src ./src

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Run as non-root for security
USER node

CMD ["node", "src/server.js"]
