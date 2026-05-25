FROM node:24-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html index.html
COPY tsconfig.json tsconfig.json
COPY tsconfig.test.json tsconfig.test.json
COPY vite.config.ts vite.config.ts
COPY src src

ARG VITE_DICTIONARY_API_BASE
ENV VITE_DICTIONARY_API_BASE=$VITE_DICTIONARY_API_BASE
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
