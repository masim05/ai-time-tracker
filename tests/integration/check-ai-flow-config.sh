#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
checker="$repo_root/scripts/check-ai-flow-config.sh"
fixture_root="$(mktemp -d)"
failures=0

trap 'rm -rf "$fixture_root"' EXIT

expect_success() {
  local name="$1"
  local expected_language="$2"
  local content="${3-}"
  local fixture="$fixture_root/$name"
  local output
  local exit_code

  mkdir -p "$fixture"
  if [[ -n "$content" ]]; then
    printf '%s' "$content" > "$fixture/.ai-flow.yml"
  fi

  set +e
  output="$(cd "$fixture" && bash "$checker" 2>&1)"
  exit_code=$?
  set -e

  if [[ $exit_code -ne 0 ]] || ! grep -Fq "GitLab language: $expected_language" <<< "$output"; then
    printf 'FAIL: %s\n%s\n' "$name" "$output" >&2
    failures=$((failures + 1))
  fi
}

expect_failure() {
  local name="$1"
  local expected_message="$2"
  local content="$3"
  local fixture="$fixture_root/$name"
  local output
  local exit_code

  mkdir -p "$fixture"
  printf '%s' "$content" > "$fixture/.ai-flow.yml"

  set +e
  output="$(cd "$fixture" && bash "$checker" 2>&1)"
  exit_code=$?
  set -e

  if [[ $exit_code -eq 0 ]] || ! grep -Fq "$expected_message" <<< "$output"; then
    printf 'FAIL: %s\n%s\n' "$name" "$output" >&2
    failures=$((failures + 1))
  fi
}

expect_success "missing-config" "en"
expect_success "missing-language" "en" $'version: 1\n'
expect_success "english" "en" $'version: 1\n\ngitlab:\n  language: en\n'
expect_success "russian" "ru" $'version: 1\n\ngitlab:\n  language: ru\n'
expect_success "regional-tag" "pt-BR" $'version: 1\n\ngitlab:\n  language: pt-BR\n'

expect_failure "unsupported-version" "Unsupported .ai-flow.yml version: 2" $'version: 2\n'
expect_failure "malformed-nesting" "Malformed .ai-flow.yml at line 2" $'version: 1\nlanguage: en\n'
expect_failure "unknown-key" "Unsupported .ai-flow.yml key at line 2: output" $'version: 1\noutput: en\n'
expect_failure "duplicate-version" "Duplicate .ai-flow.yml key: version" $'version: 1\nversion: 1\n'
expect_failure "duplicate-language" "Duplicate .ai-flow.yml key: gitlab.language" $'version: 1\ngitlab:\n  language: en\n  language: ru\n'

for invalid_language in english en_US en-; do
  expect_failure \
    "invalid-${invalid_language//[^a-zA-Z0-9]/-}" \
    "Invalid gitlab.language: $invalid_language" \
    $'version: 1\ngitlab:\n  language: '"$invalid_language"$'\n'
done

if [[ $failures -ne 0 ]]; then
  printf '%d AI flow config integration test(s) failed.\n' "$failures" >&2
  exit 1
fi

echo "AI flow config integration tests passed."