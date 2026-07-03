# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

ARG GEMINI_API_KEY
ARG VITE_GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve
FROM nginx:stable-alpine

# Copy built assets from stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback for client-side routes
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
