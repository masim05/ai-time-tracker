#!/usr/bin/env bash
set -euo pipefail

required_paths=(
  "AGENTS.md"
  "docs/architecture/project-structure.md"
  "docs/architecture/boundaries.md"
  "docs/engineering/testing-policy.md"
  "docs/engineering/definition-of-done/README.md"
  "docs/work-items/README.md"
)

for path in "${required_paths[@]}"; do
  if [ ! -e "$path" ]; then
    echo "Missing required path: $path" >&2
    exit 1
  fi
done

if [ -d "tests/unit" ]; then
  echo "Centralized tests/unit directory is not allowed. Unit tests must be colocated with code." >&2
  exit 1
fi

if [ -d "tests/component" ]; then
  echo "Centralized tests/component directory is not allowed. Component tests must be colocated with code." >&2
  exit 1
fi

echo "Architecture policy check passed."
