FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY lib ./lib
COPY artifacts ./artifacts

RUN pnpm install --frozen-lockfile=false
RUN pnpm run build
RUN pnpm --filter api-server build

EXPOSE 10000
ENV PORT=10000
ENV NODE_ENV=production

CMD ["pnpm", "--filter", "api-server", "start"]
