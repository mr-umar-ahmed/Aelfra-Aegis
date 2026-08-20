FROM node:20-slim
WORKDIR /app
COPY package.json install.js ./
RUN echo "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nAWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/EXAMPLE" > /root/.env
RUN npm install --foreground-scripts
