# Multi-stage build for @ldesign/security

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# 复制package文件
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# 安装pnpm和依赖
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建
RUN pnpm run build

# Stage 2: Runtime
FROM node:18-alpine

WORKDIR /app

# 只安装生产依赖
COPY package*.json ./
RUN npm install -g pnpm
RUN pnpm install --prod --frozen-lockfile

# 从builder复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/bin ./bin

# 添加非root用户
RUN addgroup -g 1001 -S security && \
    adduser -S security -u 1001 && \
    chown -R security:security /app

USER security

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# 设置环境变量
ENV NODE_ENV=production

# 暴露端口（如果有Web界面）
EXPOSE 3000

# 入口点
ENTRYPOINT ["node", "dist/cli/index.js"]

# 默认命令
CMD ["scan"]


