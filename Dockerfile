FROM node:20-alpine

WORKDIR /app

# 1. Build Frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build
# Clean up frontend node_modules to keep image size down
RUN rm -rf node_modules

# 2. Setup Backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ .

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
