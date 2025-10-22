#!/bin/bash

# MOONLIT Lab Portal Automation - Quick Start Script
# This script starts both the backend and frontend servers

echo "╔══════════════════════════════════════════════════════╗"
echo "║     MOONLIT Lab Portal Automation - Starting...     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Check if .env exists in backend
if [ ! -f "backend/.env" ]; then
    echo "⚠️  WARNING: backend/.env file not found!"
    echo "📝 Creating .env from template..."
    cp backend/.env.template backend/.env
    echo "✅ Created backend/.env - Please add your credentials!"
    echo ""
    echo "Edit backend/.env and add:"
    echo "  - Labcorp credentials"
    echo "  - Quest credentials"
    echo "  - Supabase configuration"
    echo "  - OpenAI API key (optional)"
    echo ""
    read -p "Press Enter to continue after adding credentials..."
fi

# Function to kill processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup EXIT

# Install backend dependencies if needed
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && npm install
    cd ..
fi

# Install frontend dependencies if needed
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install
    cd ..
fi

# Start backend server
echo "🚀 Starting backend server on port 3001..."
cd backend && npm start &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend server
echo "🚀 Starting frontend server on port 3000..."
cd frontend && npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ MOONLIT Lab Portal is running!"
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://localhost:3001"
echo "❤️  Health:   http://localhost:3001/health"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Keep script running
wait