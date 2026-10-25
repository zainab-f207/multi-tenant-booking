FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Build-time placeholders only. These are not real credentials.
ENV POSTGRES_DB=build_database
ENV POSTGRES_USER=build_user
ENV POSTGRES_PASSWORD=build_only_password
ENV POSTGRES_PORT=5432
ENV APP_DB_USER=build_app_user
ENV APP_DB_PASSWORD=build_only_app_password
ENV DATABASE_URL=postgresql://build_user:build_only_password@localhost:5432/build_database
ENV APP_DATABASE_URL=postgresql://build_app_user:build_only_app_password@localhost:5432/build_database
ENV REDIS_URL=redis://localhost:6379

RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Keep the dependencies required by the custom TypeScript server.
COPY --from=builder /app ./

EXPOSE 3000
CMD ["npm", "start"]