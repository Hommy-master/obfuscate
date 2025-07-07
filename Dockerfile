# 使用Node.js 22官方镜像
FROM node:22-bookworm-slim

# 设置工作目录
WORKDIR /app

# 创建bin目录并复制dist内容
RUN mkdir -p bin
COPY dist/ ./bin/

# 验证复制结果（可选）
RUN ls -la bin/

# 保持容器运行（空命令）
CMD ["tail", "-f", "/dev/null"]