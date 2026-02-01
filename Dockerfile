# Build stage
FROM geoffreybooth/meteor-base:3.1 AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY .meteor .meteor

# Install npm dependencies
RUN meteor npm ci

# Copy the rest of the application
COPY . .

# Build the Meteor application
RUN meteor build --server-only --directory /built-app

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy built app from builder stage
COPY --from=builder /built-app/bundle .

# Install production dependencies
WORKDIR /app/programs/server
RUN npm install --production

WORKDIR /app

ENV PORT=3000

EXPOSE 3000

CMD ["node", "main.js"]
