#!/bin/bash
set -euo pipefail

# Build clarity-js (all variants) from repo root
yarn build:js 2>&1 | tail -5

# Measure the primary target: clarity.min.js (minified IIFE)
RAW_BYTES=$(stat -f%z packages/clarity-js/build/clarity.min.js 2>/dev/null || stat -c%s packages/clarity-js/build/clarity.min.js 2>/dev/null)
GZIP_BYTES=$(gzip -c packages/clarity-js/build/clarity.min.js | wc -c | tr -d ' ')

echo "METRIC gzip_bytes=${GZIP_BYTES}"
echo "METRIC raw_bytes=${RAW_BYTES}"
