# Astro participant app for Rahti (OpenShift). Serves the prerendered pages
# with the Node adapter on port 8080. Rahti runs the container as an
# arbitrary UID, so the files only need to be world-readable.

FROM node:22-alpine AS build
WORKDIR /app
# The lock file lives at the workspace root (societal-discussion/package-lock.json);
# the versions in package.json are exact, so a plain install is reproducible enough.
COPY package.json ./
RUN npm install --no-package-lock
COPY . .
# Both values are inlined at build time (spec V11a: one switch per deploy).
ARG PUBLIC_API_URL
ARG PUBLIC_PROVIDER_BLOCK=finnish
ENV PUBLIC_API_URL=$PUBLIC_API_URL \
    PUBLIC_PROVIDER_BLOCK=$PUBLIC_PROVIDER_BLOCK
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
COPY --from=build /app/package.json ./
RUN npm install --omit=dev --no-package-lock && chmod -R a+rX /app
COPY --from=build /app/dist ./dist
USER 1001
EXPOSE 8080
CMD ["node", "dist/server/entry.mjs"]
