FROM node:20-slim
RUN apt-get update && apt-get install -y netcat-openbsd && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json install.js ./
RUN npm install --foreground-scripts
