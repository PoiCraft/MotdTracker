#!/bin/bash
# Frontend build script

set -e

echo "=== Building MotdTracker React Frontend ==="

cd "$(dirname "$0")/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build the frontend
echo "Building production bundle..."
npm run build

echo ""
echo "✅ Frontend build complete!"
echo "Output directory: static/dist/"
echo ""
echo "The Rust backend will automatically serve the built frontend from /static/dist/"
