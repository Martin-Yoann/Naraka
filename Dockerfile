FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV HOST=0.0.0.0 PORT=3100 NODE_ENV=production
EXPOSE 3100
CMD ["node", "server.mjs"]
