#!/bin/bash
set -e

OUT_DIR="frontend"

# Gather build info
GIT_HASH=$(git rev-parse --short HEAD)
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Write to build_info.json
cat > "$OUT_DIR/build_info.json" <<EOF
{
  "git_hash": "$GIT_HASH",
  "build_time": "$BUILD_TIME"
}
EOF

echo "✅ Generated $OUT_DIR/build_info.json"
