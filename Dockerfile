FROM node:18-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 8000

CMD ["node", "server.js"]
