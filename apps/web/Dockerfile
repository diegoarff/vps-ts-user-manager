FROM oven/bun:1 AS builder
WORKDIR /app
ENV SKIP_ENV_VALIDATION=1

COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache bun install

ENV NODE_ENV=production
RUN cd apps/web && bun run build
ENV SKIP_ENV_VALIDATION=

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

# Only the build output is required at runtime; Nitro traces argon2 and
# workspace deps into .output so node_modules is not needed.
COPY --from=builder /app/apps/web/.output /app/apps/web/.output

WORKDIR /app/apps/web
CMD ["node", ".output/server/index.mjs"]
