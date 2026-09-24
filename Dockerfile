FROM node:22-alpine AS deps

WORKDIR /app

COPY ./src/package.json ./src/package-lock.json ./

RUN npm ci --omit=dev

FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

# O runtime so executa `node server.js`: remover o npm reduz a superficie da imagem.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --from=deps /app/node_modules ./node_modules
COPY ./src .

USER node

EXPOSE 8080

CMD ["node", "server.js"]
