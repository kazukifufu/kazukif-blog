---
title: "Ubuntu 26.04 LTSへのCloudflare Tunnelの設定"
date: "2026-10-02"
category: "infra_tools"
---

- 全体像と仕組み
  - Cloudflareで取得したドメインとCloudflare Tunnel(Cloudflare Zero Trust)を組み合わせるアプローチ
  - Ubuntu側からCloudflareに向けて暗号化されたアウトバウンド接続(Tunnel)を常時確立、外部からのアクセスはすべてCloudflareのエッジを経由してこのトンネルを通る

    ```
    [ 外部のクライアント ]
        │
        ▼ (HTTPS / SSH)
    [ Cloudflare Network ] (DNS / Access認証 / SSL終端)
        │
        ▼ (Encrypted Tunnel)
    [ Ubuntu 26.04 (cloudflared) ]
        ├── Docker App (http://localhost:8080)
        └── SSH Server (localhost:22)

    ```


- Cloudflare側の設定
  - Tunnelの新設
    1. Cloudflareの左メニューから Zero Trust > Networks > Tunnels & Mesh を開きます
    2. 画面右上の +Create Tunnelボタン をクリック
    3. Cloudflaredを選択
    4. トンネル名を入力して、Save tunnelボタンをクリック
    5. Choose environment画面のコマンド内に ey... から始まる長い**トンネルトークン(TUNNEL_TOKEN)**が表示されるので、手元にコピーしておく

    
- Ubuntu26.04 LTS側の設定
  - cloudflared 用の docker-compose.ymlの作成

    ```bash
    mkdir -p ./Docker/cloudflared & cd ./Docker/cloudflared
    vi docker-compose.yml
    ```

    ```yaml
    services:
      cloudflared:
        image: cloudflare/cloudflared:latest
        container_name: cloudflared
        restart: unless-stopped
        command: tunnel --no-autoupdate run
        environment:
          - TUNNEL_TOKEN=取得したトンネルトークン文字列
        extra_hosts:
          - "host.docker.internal:host-gateway" # ホストOSのポートを参照可能にする設定
    ```
  - 保存後、起動する
    ```bash
    docker compose up -d
    ```
  - Tunnel確立の確認
    - Cloudflareダッシュボードで確認する
    1. Cloudflareの左メニューから Zero Trust > Networks > Tunnels & Mesh を開く
    2. 作成したトンネルのステータスを確認する
        - HEALTHY（緑色）: トンネルが正常に確立され、クラウドと通信できています
        - DOWN や INACTIVE（赤色/灰色）: コンテナが起動していないか、トークン等の設定エラーで接続できていません
    - Ubuntu サーバーの Docker ログで確認する
    ```bash
    docker logs -f cloudflared
    docker compose logs -f cloudflared  # docker composeの場合
    ```
      - 正常な場合のログ出力例
        - 以下のように Registered tunnel connection（トンネル接続が登録されました）というメッセージが連続して表示されていれば正常です
            ```text
            2026-10-01T11:15:00Z INF Registered tunnel connection connIndex=0 location=xxx
            2026-10-01T11:15:00Z INF Registered tunnel connection connIndex=1 location=xxx
            2026-10-01T11:15:01Z INF Registered tunnel connection connIndex=2 location=xxx
            2026-10-01T11:15:01Z INF Registered tunnel connection connIndex=3 location=xxx
            ```
            ※ 終了する場合は Ctrl + C を押します