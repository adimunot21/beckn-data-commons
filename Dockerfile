# syntax=docker/dockerfile:1
#
# Single parameterized image for all four TS services. Compose passes
# --build-arg SERVICE=<bap|bpp|access-manager|mcp-server>. Repo root is the
# build context so pnpm can resolve the whole workspace (shared packages).

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

# ---- build stage: install workspace, build the target service + its deps ----
FROM base AS build
ARG SERVICE
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter "@bdc/${SERVICE}..." build

# ---- runtime stage ----
FROM base AS runtime
ARG SERVICE
ENV NODE_ENV=production
ENV SERVICE=${SERVICE}
COPY --from=build /app /app
WORKDIR /app/services/${SERVICE}
CMD ["node", "dist/index.js"]
