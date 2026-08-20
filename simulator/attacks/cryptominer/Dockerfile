FROM node:20-slim
WORKDIR /app
COPY package.json install.js ./
RUN npm install --foreground-scripts
