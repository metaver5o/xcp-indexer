FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY . .
VOLUME ["/app/data"]
ENV DB_PATH=/app/data/indexer.db
EXPOSE 3002
CMD ["node", "index.js"]
