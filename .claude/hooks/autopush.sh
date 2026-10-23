#!/usr/bin/env bash
# Stop hook: when Claude finishes a turn, commit any work in progress and push
# the current branch to GitHub. Never commits or pushes main/master or a
# detached HEAD. A push to the beta branch also redeploys the beta site.
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
case "$branch" in HEAD | main | master) exit 0 ;; esac

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -q -m "WIP: auto-save progress" \
    -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JK9kaqojzJ7rgntAS2Bn9e" || exit 0
fi

# Push when the branch has no upstream yet or has commits the remote lacks.
if git rev-parse --verify -q '@{u}' >/dev/null && [ -z "$(git log '@{u}..' --oneline)" ]; then
  exit 0
fi
for wait in 2 4 8 16; do
  if git push -q -u origin "$branch" 2>/dev/null; then
    echo "{\"systemMessage\": \"Auto-pushed $branch to GitHub\"}"
    exit 0
  fi
  sleep "$wait"
done
echo "{\"systemMessage\": \"Auto-push of $branch failed; it will retry at the end of the next turn\"}"
exit 0
