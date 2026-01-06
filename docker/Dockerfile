# Build a base container for Giverny to work on diffreviewer

# Start with Go in Debian Trixie.
FROM golang:1.25.5-trixie

RUN apt update -y

# Install node

RUN apt-get install -y nodejs npm

# Install headless playwright MCP
# Install system dependencies for headless browsers
RUN apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libatspi2.0-0 \
    libwayland-client0

# Install playwright and MCP server globally
RUN npm install -g @playwright/test @playwright/mcp

# Install playwright browsers (headless)
RUN npx playwright install --with-deps chromium

