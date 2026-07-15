FROM node:20-alpine

# 保持容器目录层级与仓库一致，模板路径解析可以直接复用本地逻辑。
WORKDIR /app/ppt-ai-app

COPY ppt-ai-app/package.json ppt-ai-app/package-lock.json ./
RUN npm ci --omit=dev

COPY ppt-ai-app/src ./src
COPY ppt-ai-app/scripts ./scripts
COPY templates /app/templates

# JSON 数据库和本地文件存储统一写入 Compose 挂载的持久化目录。
RUN mkdir -p /data/storage

ENV NODE_ENV=production
EXPOSE 5177

CMD ["node", "src/server.js"]
