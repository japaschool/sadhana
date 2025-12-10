# Use the official Node.js 20 image, which supports multi-arch including arm64
# node:20-slim
FROM --platform=linux/arm64 node:20-alpine 

# Set working directory
# WORKDIR /workspace
WORKDIR /app

# COPY package*.json ./
COPY . .

CMD ["npm", "run", "dev"]

# Install any dependencies you want globally (optional)
RUN npm install -g npm npm-check-updates

# Install additional tools (optional)
# RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Set default user
USER node
