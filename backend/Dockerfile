# ==========================================
# Stage 1: Build the Go binary
# ==========================================
FROM golang:1.24-alpine AS builder

WORKDIR /src

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy module definition
COPY go.mod ./

# Copy source code
COPY . .

# Build statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/server ./cmd/main.go

# ==========================================
# Stage 2: Minimal runtime image
# ==========================================
FROM alpine:3.20

WORKDIR /app

# Install CA certs for upstream HTTPS calls (DeepSeek, Virse, ImgBB, etc.)
RUN apk add --no-cache ca-certificates tzdata

# Copy binary from builder
COPY --from=builder /bin/server /app/server

# Data persistence directory
RUN mkdir -p /app/data

ENV PORT=8080
ENV DATA_DIR=/app/data

EXPOSE 8080

VOLUME ["/app/data"]

ENTRYPOINT ["/app/server"]
