FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 LAN_ONLY=false RUNTIME_MODE=vps ALLOW_CLIENT_API_KEYS=false
WORKDIR /app
COPY --chown=node:node package.json server.js roleplay-ai-prototype-v3.html ./
COPY --chown=node:node lib ./lib
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data
USER node
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node","server.js"]
