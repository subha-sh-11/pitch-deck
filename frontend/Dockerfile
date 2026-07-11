# Stage 1: Build the Next.js app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Next.js 16 requires NEXT_PUBLIC_API_BASE_URL during build for client-side bundle hydration.
# We set it to the default reverse proxy route.
ENV NEXT_PUBLIC_API_BASE_URL=/api/v1
RUN npm run build

# Stage 2: Serve the Next.js app
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]
