#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script="$repo_root/scripts/prune-stale-checkouts.sh"
fixture_root="$(mktemp -d)"
bin_dir="$fixture_root/bin"

trap 'rm -rf "$fixture_root"' EXIT

mkdir -p "$bin_dir"

cat > "$bin_dir/git" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

fixture_root="${FIXTURE_ROOT:?}"
repo_root="${REPO_ROOT:?}"

case "$1 $2 ${3-}" in
  'rev-parse --show-toplevel ')
    printf '%s\n' "$repo_root"
    ;;
  'branch --show-current ')
    printf '%s\n' 'main'
    ;;
  'symbolic-ref -q --short')
    printf '%s\n' 'origin/main'
    ;;
  'worktree list --porcelain')
    cat "$fixture_root/worktree-list"
    ;;
  'for-each-ref refs/heads --format=%(refname:short)')
    cat "$fixture_root/branches"
    ;;
  'worktree remove ')
    printf 'worktree remove %s\n' "$3" >> "$fixture_root/actions.log"
    ;;
  'branch -D ')
    printf 'branch -D %s\n' "$3" >> "$fixture_root/actions.log"
    ;;
  *)
    printf 'unexpected git invocation: %q\n' "$*" >&2
    exit 1
    ;;
esac
EOF
chmod +x "$bin_dir/git"

make_cli() {
  local name="$1"

  cat > "$bin_dir/$name" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

fixture_root="${FIXTURE_ROOT:?}"
active_branches="${ACTIVE_BRANCHES:?}"
branch=""
cli_name="$(basename "$0")"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --head|--source-branch)
      branch="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

printf '%s %s\n' "$cli_name" "$branch" >> "$fixture_root/${cli_name}.log"

case ",${active_branches}," in
  *",${branch},"*)
    case "$cli_name" in
      gh)
        printf 'true\n'
        ;;
      glab)
        printf '[{"source_branch":"%s"}]\n' "$branch"
        ;;
    esac
    ;;
  *)
    case "$cli_name" in
      gh)
        printf 'false\n'
        ;;
      glab)
        printf '[]\n'
        ;;
    esac
    ;;
esac
EOF
  chmod +x "$bin_dir/$name"
}

make_cli gh
make_cli glab

run_case() {
  local name="$1"
  local config_text="$2"
  local active_branches="$3"
  local expected_cli="$4"
  local repo_case_root="$fixture_root/$name/repo"
  local output

  mkdir -p "$repo_case_root/worktrees/feature-active" "$repo_case_root/worktrees/feature-stale"
  ln -s "$repo_root/scripts" "$repo_case_root/scripts"

  printf '%s\n' "$config_text" > "$repo_case_root/.ai-flow.yml"
  printf 'worktree %s\nHEAD abc\nbranch refs/heads/main\n\nworktree %s\nHEAD def\nbranch refs/heads/feature-active\n\nworktree %s\nHEAD ghi\nbranch refs/heads/feature-stale\n' "$repo_case_root" "$repo_case_root/worktrees/feature-active" "$repo_case_root/worktrees/feature-stale" > "$fixture_root/worktree-list"
  printf 'main\nfeature-active\nfeature-stale\nlonely-stale\n' > "$fixture_root/branches"
  : > "$fixture_root/actions.log"
  : > "$fixture_root/gh.log"
  : > "$fixture_root/glab.log"

  output="$(env \
    FIXTURE_ROOT="$fixture_root" \
    REPO_ROOT="$repo_case_root" \
    ACTIVE_BRANCHES="$active_branches" \
    PATH="$bin_dir:$PATH" \
    bash "$script" 2>&1)"

  grep -Fq 'Removing worktree: ' <<< "$output"
  grep -Fq 'Deleting branch: feature-stale' <<< "$output"

  diff -u <(printf 'worktree remove %s\nbranch -D feature-stale\nbranch -D lonely-stale\n' "$repo_case_root/worktrees/feature-stale") "$fixture_root/actions.log"

  grep -Fq "$expected_cli feature-active" "$fixture_root/${expected_cli}.log"
  if [[ "$expected_cli" == 'gh' ]]; then
    [[ ! -s "$fixture_root/glab.log" ]]
  else
    [[ ! -s "$fixture_root/gh.log" ]]
  fi
}

run_case default-glab $'version: 1\n' feature-active glab
run_case explicit-gh $'version: 1\ngit:\n  cli: gh\n' feature-active gh