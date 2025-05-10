# Stage 1: Build the application
FROM node:22-slim AS builder

# Set up Chinese Debian sources
RUN mkdir -p /etc/apt && \
    echo "deb http://mirrors.aliyun.com/debian/ bookworm main non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb http://mirrors.aliyun.com/debian/ bookworm-updates main non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb http://mirrors.aliyun.com/debian-security/ bookworm-security main non-free non-free-firmware" >> /etc/apt/sources.list

# Install ffmpeg and build tools
RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    build-essential \
    python3 \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --registry=https://registry.npmmirror.com

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production image
FROM node:22-slim

# Set up Chinese Debian sources
RUN mkdir -p /etc/apt && \
    echo "deb http://mirrors.aliyun.com/debian/ bookworm main non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb http://mirrors.aliyun.com/debian/ bookworm-updates main non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb http://mirrors.aliyun.com/debian-security/ bookworm-security main non-free non-free-firmware" >> /etc/apt/sources.list

# Install ffmpeg for runtime
RUN apt-get update && \
    apt-get install -y ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Install Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3000

# Run the application
CMD ["npm", "start"]