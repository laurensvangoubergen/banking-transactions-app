FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Create necessary directories
RUN mkdir -p uploads logs

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S banking -u 1001
RUN chown -R banking:nodejs /app
USER banking

EXPOSE 3000

CMD ["node", "src/app.js"]