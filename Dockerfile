# Stage 1: Build
FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve
FROM nginx:stable-alpine

# Copy built assets from stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config if needed (optional, default is fine for simple SPA)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
