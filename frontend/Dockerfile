FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html index.html
COPY tsconfig.json tsconfig.json
COPY tsconfig.test.json tsconfig.test.json
COPY vite.config.ts vite.config.ts
COPY src src

EXPOSE 4000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "4000"]
