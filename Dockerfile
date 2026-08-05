FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

# 配置通过 volume 挂载（config.json / data/tokens.json 不入镜像）
EXPOSE 9000

CMD ["node", "src/index.js"]
