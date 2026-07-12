#!/usr/bin/env bash
set -euo pipefail

config_path="${1:-.ai-flow.yml}"
language="en"
git_cli="glab"

if [[ ! -e "$config_path" ]]; then
  echo "AI flow config check passed (GitLab language: $language, Git CLI: $git_cli)."
  exit 0
fi

version=""
version_seen=0
git_seen=0
git_cli_seen=0
gitlab_seen=0
language_seen=0
context=""
line_number=0

fail() {
  echo "$1" >&2
  exit 1
}

while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
  line_number=$((line_number + 1))
  raw_line="${raw_line%$'\r'}"

  if [[ "$raw_line" == *$'\t'* ]]; then
    fail "Malformed .ai-flow.yml at line $line_number: tabs are not supported"
  fi

  line="${raw_line%%#*}"
  line="${line%"${line##*[![:space:]]}"}"

  if [[ -z "$line" ]]; then
    continue
  fi

  if [[ "$line" =~ ^version:[[:space:]]*(.+)$ ]]; then
    if [[ $version_seen -eq 1 ]]; then
      fail "Duplicate .ai-flow.yml key: version"
    fi
    version_seen=1
    version="${BASH_REMATCH[1]}"
    context=""
    continue
  fi

  if [[ "$line" =~ ^git:[[:space:]]*$ ]]; then
    if [[ $git_seen -eq 1 ]]; then
      fail "Duplicate .ai-flow.yml key: git"
    fi
    git_seen=1
    context="git"
    continue
  fi

  if [[ "$line" =~ ^gitlab:[[:space:]]*$ ]]; then
    if [[ $gitlab_seen -eq 1 ]]; then
      fail "Duplicate .ai-flow.yml key: gitlab"
    fi
    gitlab_seen=1
    context="gitlab"
    continue
  fi

  if [[ "$line" =~ ^[[:space:]][[:space:]]cli:[[:space:]]*(.+)$ ]]; then
    if [[ "$context" != "git" ]]; then
      fail "Malformed .ai-flow.yml at line $line_number"
    fi
    if [[ $git_cli_seen -eq 1 ]]; then
      fail "Duplicate .ai-flow.yml key: git.cli"
    fi
    git_cli_seen=1
    git_cli="${BASH_REMATCH[1]}"
    continue
  fi

  if [[ "$line" =~ ^[[:space:]][[:space:]]language:[[:space:]]*(.+)$ ]]; then
    if [[ "$context" != "gitlab" ]]; then
      fail "Malformed .ai-flow.yml at line $line_number"
    fi
    if [[ $language_seen -eq 1 ]]; then
      fail "Duplicate .ai-flow.yml key: gitlab.language"
    fi
    language_seen=1
    language="${BASH_REMATCH[1]}"
    continue
  fi

  if [[ "$line" =~ ^([a-zA-Z0-9_-]+): ]]; then
    key="${BASH_REMATCH[1]}"
    if [[ "$key" == "language" || "$key" == "cli" ]]; then
      fail "Malformed .ai-flow.yml at line $line_number"
    fi
    fail "Unsupported .ai-flow.yml key at line $line_number: $key"
  fi

  fail "Malformed .ai-flow.yml at line $line_number"
done < "$config_path"

if [[ $version_seen -eq 0 ]]; then
  fail "Missing .ai-flow.yml key: version"
fi

if [[ "$version" != "1" ]]; then
  fail "Unsupported .ai-flow.yml version: $version"
fi

if [[ ! "$language" =~ ^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$ ]]; then
  fail "Invalid gitlab.language: $language"
fi

if [[ "$git_cli" != "glab" && "$git_cli" != "gh" ]]; then
  fail "Invalid git.cli: $git_cli"
fi

echo "AI flow config check passed (GitLab language: $language, Git CLI: $git_cli)."