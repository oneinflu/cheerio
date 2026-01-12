FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Expose port (DigitalOcean App Platform expects 8080 by default, but we use 3000. 
# We can configure this in App Platform settings)
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start server
CMD ["npm", "start"]
