FROM node:20-slim

# Install Chromium and dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy application code
COPY . .

# Build TypeScript for worker
# Create a worker-specific tsconfig that emits JS with proper path resolution
RUN echo '{\n\
  "compilerOptions": {\n\
    "target": "es2020",\n\
    "module": "commonjs",\n\
    "lib": ["es2020", "dom"],\n\
    "moduleResolution": "node",\n\
    "esModuleInterop": true,\n\
    "skipLibCheck": true,\n\
    "strict": false,\n\
    "noEmit": false,\n\
    "jsx": "react-jsx",\n\
    "outDir": "./dist",\n\
    "rootDir": "./src",\n\
    "baseUrl": "./src",\n\
    "paths": {\n\
      "@/*": ["./*"]\n\
    },\n\
    "resolveJsonModule": true,\n\
    "allowSyntheticDefaultImports": true\n  },\n  "include": [\n\
    "src/lib/worker/**/*",\n\
    "src/lib/database.ts",\n\
    "src/lib/supabase-server.ts",\n\
    "src/lib/supabase-worker.ts",\n\
    "src/lib/supabase.ts",\n\
    "src/lib/notification-service.ts",\n\
    "src/lib/logger.ts",\n\
    "src/lib/image-utils.ts",\n\
    "src/lib/utils.ts",\n\
    "src/lib/menu-data-migration.ts",\n\
    "src/lib/templates/v2/**/*",\n\
    "src/lib/templates/export/texture-utils.ts",\n\
    "src/lib/templates/export/puppeteer-shared.ts",\n\
    "src/types/**/*"\n  ],\n  "exclude": ["**/*.test.ts", "**/__tests__/**/*", "src/lib/templates/*.ts"]\n}' > tsconfig.worker.json

# Compile TypeScript with path resolution
RUN npx tsc -p tsconfig.worker.json

# Run path fix script (already copied with COPY . .)
RUN node fix-paths.js

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Create non-root user
RUN useradd -m -u 1001 worker
RUN chown -R worker:worker /app
USER worker

# Expose health check port
EXPOSE 3000

# Start worker
CMD ["node", "dist/lib/worker/index.js"]
