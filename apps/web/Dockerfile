FROM node:22-bookworm-slim
WORKDIR /repo
RUN npm install --global pnpm@10.34.6
COPY . .
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "@waypoint/web", "start", "--hostname", "0.0.0.0"]
