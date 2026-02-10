# Build stage for mobile frontend
FROM node:20-slim AS frontend-build
WORKDIR /app/mobile
COPY mobile/package*.json ./
RUN npm ci
COPY mobile/ ./
RUN npm run build

# Production stage
FROM python:3.11-slim
WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built mobile frontend
COPY --from=frontend-build /app/mobile/dist ./mobile-dist/

# Create sessions directory
RUN mkdir -p sessions/quick

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Run the server
WORKDIR /app/backend
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
