#!/usr/bin/env bash
set -euo pipefail

required_paths=(
  "docs/engineering/definition-of-done/README.md"
  "docs/engineering/definition-of-done/feature.md"
  "docs/engineering/definition-of-done/change-request.md"
  "docs/engineering/definition-of-done/bugfix.md"
  "docs/engineering/definition-of-done/chore.md"
  "docs/engineering/definition-of-done/docs.md"
)

for path in "${required_paths[@]}"; do
  if [ ! -s "$path" ]; then
    echo "Missing or empty Definition of Done file: $path" >&2
    exit 1
  fi
done

echo "Definition of Done policy check passed."
