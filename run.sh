#!/bin/bash

# Animly Startup Script
# This script loads environment variables and runs both the Next.js frontend and FastAPI backend.

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Animly Pipeline...${NC}"

# 1. Load Environment Variables
if [ -f .env ]; then
    echo -e "${GREEN}Loading API keys from .env file...${NC}"
    export $(grep -v '^#' .env | xargs)
else
    echo -e "${RED}Warning: .env file not found in root directory! API integrations may fail.${NC}"
fi

# Function to handle cleanup on exit
cleanup() {
    echo -e "\n${RED}Shutting down Animly services...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# 2. Start FastAPI Backend
echo -e "${GREEN}Starting FastAPI Backend on port 8000...${NC}"
cd backend
# Ensure venv exists and activate it
if [ ! -d "venv" ]; then
    echo "Setting up Python virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt -q
python3 app/main.py &
BACKEND_PID=$!
cd ..

# 3. Start Next.js Frontend
echo -e "${GREEN}Starting Next.js Frontend on port 3000...${NC}"
cd frontend
# Ensure node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi
npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "${BLUE}Animly is running!${NC}"
echo -e "Frontend: http://localhost:3000"
echo -e "Backend:  http://localhost:8000"
echo -e "Press Ctrl+C to stop both servers."

# Wait for both background processes
wait $BACKEND_PID $FRONTEND_PID
