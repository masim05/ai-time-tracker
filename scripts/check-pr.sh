#!/usr/bin/env bash
set -euo pipefail

required_paths=(
  ".gitlab/merge_request_templates/default.md"
  ".gitlab/issue_templates/feature.md"
  ".gitlab/issue_templates/change-request.md"
  ".gitlab/issue_templates/bug.md"
  ".gitlab/issue_templates/chore.md"
  ".gitlab/issue_templates/docs.md"
)

for path in "${required_paths[@]}"; do
  if [ ! -s "$path" ]; then
    echo "Missing or empty merge request/issue template: $path" >&2
    exit 1
  fi
done

echo "Merge request policy check passed."
