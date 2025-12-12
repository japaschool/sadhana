# Use the official Node.js 20 image, which supports multi-arch including arm64
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
RUN apk update && apk add --no-cache git && rm -rf /var/cache/apk/*

# Set default user
USER node
