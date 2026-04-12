default:
    @just --list

# dist/ を再生成 (pull rebase 後に実行)
build:
    #!/usr/bin/env bash
    source "$NVM_DIR/nvm.sh"
    nvm use 22
    cd workspace
    npx pnpm install
    npx pnpm run build
    npx pnpm dlx ts-node --project tsconfig.node.json utils/yamlMergeAndCompress.ts
