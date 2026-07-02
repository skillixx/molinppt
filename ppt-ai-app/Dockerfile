FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
EXPOSE 5177

CMD ["node", "src/server.js"]
