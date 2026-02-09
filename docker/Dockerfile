FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy prisma schema
COPY prisma ./prisma
RUN npx prisma generate

# Copy built application
COPY dist ./dist

# Create logs directory
RUN mkdir -p logs

# Run as non-root user
USER node

CMD ["node", "dist/index.js"]
