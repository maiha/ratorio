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

# ローカル検証用の静的サーバをバックグラウンド起動 (http://127.0.0.1:18080/)
start:
    #!/usr/bin/env bash
    if pgrep -f "python3 -m http.server 18080" > /dev/null; then
        echo "already running: http://127.0.0.1:18080/"
        exit 0
    fi
    nohup python3 -m http.server 18080 --bind 127.0.0.1 > /tmp/ratorio-serve.log 2>&1 &
    disown
    echo "started: http://127.0.0.1:18080/ (log: /tmp/ratorio-serve.log)"

# 上の serve で起動した静的サーバを停止
stop:
    #!/usr/bin/env bash
    pkill -f "python3 -m http.server 18080" || true
    echo "stopped"
