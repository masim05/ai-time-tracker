#!/usr/bin/env bash
set -euo pipefail

if [ ! -d "docs/work-items" ]; then
  echo "Missing docs/work-items directory." >&2
  exit 1
fi

invalid=0
shopt -s nullglob
for dir in docs/work-items/*/; do
  base="$(basename "$dir")"
  if [ "$base" = "README.md" ]; then
    continue
  fi
  if [[ ! "$base" =~ ^[0-9]{3}-(feat|change-request|bug|chore|docs)-[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
    echo "Invalid work item directory name: docs/work-items/$base" >&2
    echo "Expected pattern: docs/work-items/NNN-<feat|change-request|bug|chore|docs>-<short-slug>/" >&2
    invalid=1
  fi
done

if [ "$invalid" -ne 0 ]; then
  exit 1
fi

echo "Work items policy check passed."
