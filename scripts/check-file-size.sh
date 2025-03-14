#!/bin/bash

set -e

# Parameters
PACKAGE_NAME=$1
PREVIOUS_VERSION=$2
FILE_PATH=$3
THRESHOLD_PCT=$4

# Validate parameters
if [ -z "$PACKAGE_NAME" ] || [ -z "$PREVIOUS_VERSION" ] || [ -z "$FILE_PATH" ] || [ -z "$THRESHOLD_PCT" ]; then
    echo "Usage: $0 <package-name> [current-version] <file-path> <threshold-percentage>"
    echo "Example: $0 clarity-js 0.8.0 build/clarity.min.js 5"
    exit 1
fi

echo "Checking size for $FILE_PATH in $PACKAGE_NAME"
echo "Threshold: $THRESHOLD_PCT%"

# Check if the current file exists
if [ ! -f "$FILE_PATH" ]; then
    echo "Error: Current file $FILE_PATH does not exist"
    exit 1
fi

# Get current file size
CURRENT_SIZE=$(stat -c%s "$FILE_PATH" 2>/dev/null || stat -f%z "$FILE_PATH" 2>/dev/null)
echo "Current $FILE_PATH size: $CURRENT_SIZE bytes"

# Create a temporary directory for the previous package
TEMP_DIR=$(mktemp -d)
pushd $TEMP_DIR > /dev/null

# Download previous version from npm
echo "Downloading previous version $PREV_VERSION..."
npm pack $PACKAGE_NAME@$PREV_VERSION > /dev/null 2>&1

PREV_PACKAGE=$(find . -name "*.tgz" | head -1)

# Extract the package
echo "Extracting package..."
tar -xzf $PREV_PACKAGE

# Adjust path to account for the "package" directory that npm pack creates
PREV_FILE_PATH="package/$FILE_PATH"

PREV_SIZE=$(stat -c%s "$PREV_FILE_PATH" 2>/dev/null || stat -f%z "$PREV_FILE_PATH" 2>/dev/null)
echo "Previous $FILE_PATH size: $PREV_SIZE bytes"

# Return to original directory and clean up
popd > /dev/null
rm -rf $TEMP_DIR

# Calculate size difference
if [ "$PREV_SIZE" -eq 0 ]; then
    echo "Previous file size is 0 bytes. Cannot calculate percentage change."
    SIZE_DIFF=999
else
    SIZE_DIFF=$(( 100 * (CURRENT_SIZE - PREV_SIZE) / PREV_SIZE ))
fi

echo "Size difference: $SIZE_DIFF%"

# Check if the size difference exceeds the threshold
if [ $SIZE_DIFF -ge $THRESHOLD_PCT ]; then
    echo "::warning::File size increased by $SIZE_DIFF% (from $PREV_SIZE bytes to $CURRENT_SIZE bytes)"
    exit 1
else
    echo "Size check passed. File size change: $SIZE_DIFF%"
    exit 0
fi