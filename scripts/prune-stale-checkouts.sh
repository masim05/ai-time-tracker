#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
config_path="$repo_root/.ai-flow.yml"

cd "$repo_root"

if ! config_output="$(bash "$repo_root/scripts/check-ai-flow-config.sh" "$config_path" 2>&1)"; then
  printf '%s\n' "$config_output" >&2
  exit 1
fi

git_cli="${config_output##*Git CLI: }"
git_cli="${git_cli%%)*}"
git_cli="${git_cli%.}"

current_branch="$(git branch --show-current)"
default_branch=""
origin_head="$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null || true)"
if [[ -n "$origin_head" ]]; then
  default_branch="${origin_head#origin/}"
fi

worktree_lookup=""
worktree_path=""

while IFS= read -r line; do
  case "$line" in
    worktree\ *)
      worktree_path="${line#worktree }"
      ;;
    branch\ refs/heads/*)
      branch_name="${line#branch refs/heads/}"
      worktree_lookup+="$branch_name"$'\t'"$worktree_path"$'\n'
      ;;
  esac
done < <(git worktree list --porcelain)

worktree_for_branch() {
  lookup_branch="$1"
  while IFS=$'\t' read -r map_branch map_path; do
    if [[ "$map_branch" == "$lookup_branch" ]]; then
      printf '%s\n' "$map_path"
      return 0
    fi
  done <<<"$worktree_lookup"

  return 1
}

is_protected_branch() {
  case "$1" in
    "$current_branch"|main|master|"$default_branch")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

has_active_remote_mr() {
  branch_name="$1"

  case "$git_cli" in
    gh)
      [[ "$(gh pr list --state open --head "$branch_name" --json number --jq 'length > 0')" == "true" ]]
      ;;
    glab)
      glab_output="$(glab mr list --source-branch "$branch_name" -F json 2>/dev/null || true)"
      grep -Fq "\"source_branch\":\"$branch_name\"" <<<"$glab_output" || grep -Fq "\"sourceBranch\":\"$branch_name\"" <<<"$glab_output"
      ;;
    *)
      printf 'Unsupported git CLI: %s\n' "$git_cli" >&2
      exit 1
      ;;
  esac
}

while IFS= read -r branch_name; do
  [[ -n "$branch_name" ]] || continue

  if is_protected_branch "$branch_name"; then
    continue
  fi

  if has_active_remote_mr "$branch_name"; then
    continue
  fi

  worktree_path="$(worktree_for_branch "$branch_name" || true)"
  if [[ -n "$worktree_path" && "$worktree_path" != "$repo_root" ]]; then
    printf 'Removing worktree: %s (%s)\n' "$worktree_path" "$branch_name"
    git worktree remove "$worktree_path"
  fi

  if [[ "$branch_name" == "$current_branch" ]]; then
    printf 'Skipping current branch: %s\n' "$branch_name"
    continue
  fi

  printf 'Deleting branch: %s\n' "$branch_name"
  git branch -D "$branch_name"
done < <(git for-each-ref refs/heads --format='%(refname:short)')