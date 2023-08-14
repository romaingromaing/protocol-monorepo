.PHONY: smart-reset smart-pull smart-format smart-remove-merged-branches

smart-reset:
	@git reset --hard HEAD && git clean -d -f -x -e config -e .idea -e node_modules/.cache/turbo/

smart-pull:
	@git stash push && git pull --rebase && git stash pop

smart-format:
	@if [ -f "$$(git rev-parse --show-toplevel)/yarn.lock" ]; then \
      cmd="yarn"; \
    else \
      cmd="npx"; \
    fi; \
    git diff --diff-filter=AM --name-only | xargs -I{} $$cmd prettier --no-error-on-unmatched-pattern --ignore-unknown -w {}

smart-remove-merged-branches:
	@git branch | cut -c 3- | xargs -I {} gh pr view {} --json state,headRefName 2>/dev/null | jq -r 'select(.state == "MERGED") | .headRefName' | xargs -I :: git branch -d ::