#!/bin/bash

# Test runner for Prompt Generation Tab
# Ensures both the webview and server are running before tests

echo "🧪 Prompt Generation Tab Test Suite"
echo "===================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if dependencies are installed
echo -e "${YELLOW}Checking dependencies...${NC}"
if ! command -v bun &> /dev/null; then
    echo -e "${RED}Error: bun is not installed${NC}"
    exit 1
fi

# Install Playwright browsers if needed
echo -e "${YELLOW}Installing Playwright browsers if needed...${NC}"
npx playwright install chromium

# Function to check if a port is in use
check_port() {
    lsof -i:$1 &> /dev/null
}

# Start the webview dev server if not running
if ! check_port 5173; then
    echo -e "${YELLOW}Starting webview dev server...${NC}"
    cd "$(dirname "$0")/.."
    npm run dev &
    WEBVIEW_PID=$!
    sleep 5 # Wait for server to start
else
    echo -e "${GREEN}Webview already running on port 5173${NC}"
fi

# Check if OpenCode server is running (optional)
if check_port 8881; then
    echo -e "${GREEN}OpenCode server detected on port 8881${NC}"
    SERVER_AVAILABLE=true
else
    echo -e "${YELLOW}OpenCode server not running on port 8881 (tests will use simulation)${NC}"
    SERVER_AVAILABLE=false
fi

# Run tests based on arguments
if [ "$1" = "headed" ]; then
    echo -e "${YELLOW}Running tests in headed mode...${NC}"
    npm run test:headed -- --project=chromium
elif [ "$1" = "debug" ]; then
    echo -e "${YELLOW}Running tests in debug mode...${NC}"
    npm run test:debug -- --project=chromium
elif [ "$1" = "ui" ]; then
    echo -e "${YELLOW}Opening Playwright UI...${NC}"
    npm run test:ui
elif [ "$1" = "all" ]; then
    echo -e "${YELLOW}Running all browser tests...${NC}"
    npm run test
elif [ "$1" = "report" ]; then
    echo -e "${YELLOW}Opening test report...${NC}"
    npm run test:report
else
    echo -e "${YELLOW}Running Prompt Generation tests...${NC}"
    npm run test:prompt -- --project=chromium
fi

TEST_EXIT_CODE=$?

# Cleanup
if [ ! -z "$WEBVIEW_PID" ]; then
    echo -e "${YELLOW}Stopping webview dev server...${NC}"
    kill $WEBVIEW_PID
fi

# Report results
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo -e "${RED}❌ Some tests failed. Check the output above.${NC}"
fi

exit $TEST_EXIT_CODE