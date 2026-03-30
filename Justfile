default:
    @just --list

# dist/bundle.js をビルド (pull rebase 後に実行)
build:
    cd workspace && npx pnpm install && npx pnpm run build
