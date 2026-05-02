# Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev

.DEFAULT_GOAL := help

BACKEND_DIR := backend

.PHONY: help backend-install backend-start backend-dev backend-test backend-ci         backend-lint backend-lint-fix backend-fmt backend-fmt-check backend-clean serve

help: ## Print this help
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ── Backend ────────────────────────────────────────────────────────────────────

backend-install: ## Install backend dependencies
	cd $(BACKEND_DIR) && npm install

backend-start: ## Start the backend server (production)
	cd $(BACKEND_DIR) && npm start

backend-dev: ## Start the backend server with --watch (auto-reload)
	cd $(BACKEND_DIR) && npm run dev

backend-test: ## Run backend tests
	cd $(BACKEND_DIR) && npm test

backend-ci: ## Full quality gate: lint + fmt-check + tests
	cd $(BACKEND_DIR) && npm run ci

backend-lint: ## Lint backend source and tests
	cd $(BACKEND_DIR) && npm run lint

backend-lint-fix: ## Auto-fix lint issues
	cd $(BACKEND_DIR) && npm run lint:fix

backend-fmt: ## Format backend source and tests with Prettier
	cd $(BACKEND_DIR) && npm run fmt

backend-fmt-check: ## Check formatting without writing
	cd $(BACKEND_DIR) && npm run fmt:check

backend-clean: ## Remove node_modules and data from backend
	rm -rf $(BACKEND_DIR)/node_modules $(BACKEND_DIR)/data/*.json

# ── Frontend ──────────────────────────────────────────────────────────────────

serve: ## Serve the frontend with npx serve (requires Node)
	npx serve .
