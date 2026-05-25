FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.json
COPY src src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4001

CMD ["npm", "start"]
