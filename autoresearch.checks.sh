#!/bin/bash
set -euo pipefail

# Run clarity-js tests
yarn workspace clarity-js test 2>&1 | tail -5

# Run clarity-decode tests (verifies encoding format compatibility)
yarn workspace clarity-decode test 2>&1 | tail -5
