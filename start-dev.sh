#!/bin/bash

echo "🚀 Starting aethermsaid hub Electron Development Server..."
echo ""
echo "This will:"
echo "  1. Start Vite dev server on http://localhost:3000"
echo "  2. Launch Electron app with hot reload"
echo "  3. Open DevTools for debugging"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
    pnpm approve-builds
fi

# Start development
pnpm run dev:electron
