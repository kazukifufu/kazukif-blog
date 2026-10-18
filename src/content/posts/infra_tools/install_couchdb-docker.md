---
title: "CouchDBをDockerで動かす"
date: "2026-10-19"
category: "infra_tools"
---

- 前提

  Obsidian公式の「Obsidian Sync」を代替するコミュニティプラグインの「Self-hosted LiveSync」を使った自前での同期環境を構築します。このプラグインはApache CouchDB というNoSQLデータベースを利用している。Docker上にApache CouchDBを構築


- docker-compose.yml の作成

  ```yaml
  services:
  couchdb:
    # バージョンを 3.5.2 に固定。
    # CouchDB はメジャーバージョンアップで設定スキーマ・API が変わる場合があるため
    # バージョンを固定して意図しない更新を防ぐ。
    # バージョンアップ時は Obsidian LiveSync プラグインとの互換性を確認すること。
    image: couchdb:3.5.2
    container_name: obsidian-couchdb
    restart: always
    # 【restart: always と unless-stopped の違い】
    # always         : Docker デーモン起動時・コンテナ停止時に常に再起動する
    #                  手動で docker stop しても再起動される
    # unless-stopped : 手動で停止した場合は再起動しない
    # Obsidian の同期サーバーは常時稼働が必要なため always を採用する。

    ports:
      # CouchDB のデフォルト HTTP ポート。
      # Obsidian LiveSync プラグインはこのポートに接続してノートを同期する。
      # 外部（インターネット）に公開する場合はリバースプロキシ経由で
      # HTTPS 化することを強く推奨する（平文 HTTP での公開はパスワードが
      # 平文で流れるリスクがある）。
      - "5984:5984"

    volumes:
      # CouchDB のデータベースファイルの永続化先。
      # コンテナを削除・再作成しても Obsidian のノートデータが保持される。
      # バックアップ対象に含めること。
      - ./data:/opt/couchdb/data

      # CouchDB のカスタム設定ファイル。
      # Obsidian LiveSync に必要な設定（主に CORS・認証）を記述する。
      # 最低限以下の設定が必要：
      #   [chttpd]
      #   bind_address = 0.0.0.0
      #
      #   [httpd]
      #   enable_cors = true
      #
      #   [cors]
      #   origins = app://obsidian.md, capacitor://localhost, http://localhost
      # コンテナ起動前に ./local.ini が存在することを確認すること。
      - ./local.ini:/opt/couchdb/etc/local.ini

    environment:
      # CouchDB の管理者ユーザー名。
      # Obsidian LiveSync の接続設定で使用する。
      - COUCHDB_USER=admin

      # パスワードを直接記述するのではなく .env ファイルで管理する
      #
      #   .env ファイル:
      #     COUCHDB_PASSWORD=強力なパスワード
      # .env は Git リポジトリに含めないこと（.gitignore に追加する）。
      - COUCHDB_PASSWORD=${COUCHDB_PASSWORD}

    labels:
      jp.hatenablog.owner.inventory.role:           "obsidian-sync-database"
      jp.hatenablog.owner.inventory.env:            "production"
      jp.hatenablog.owner.inventory.owner:          "kazukifu"
      jp.hatenablog.owner.inventory.port.host:      "5984"
      jp.hatenablog.owner.inventory.port.container: "5984"
      jp.hatenablog.owner.inventory.port.protocol:  "tcp"
      jp.hatenablog.owner.inventory.description: |
        Obsidian LiveSync 用 CouchDB 3.5.2。
        Obsidian のノートをデバイス間でリアルタイム同期するバックエンド。
        local.ini で CORS・認証設定を管理。
        データは ./data に永続化。
        外部公開する場合はリバースプロキシ経由で HTTPS 化すること。
  ```

- `.env`ファイルの作成

    ```text
    # ==========================================
    # CouchDB 環境変数設定ファイル
    # ==========================================

    # CouchDB(admin)用パスワード
    COUCHDB_PASSWORD="xxxx"
    ```

- CouchDB初期設定ファイル(`local.ini`)の作成

    ```
    [chttpd]
    port = 5984
    bind_address = 0.0.0.0
    # 大きな画像や添付ファイルを同期できるように最大受け入れサイズを拡張（約500MB）
    max_http_request_size = 524288000

    [chttpd_auth]
    # LiveSyncに必要なセッション認証を有効化
    require_valid_user = true
    # Recommended for 3.5.2 to ensure smooth token authentication
    authentication_redirect = /_utils/session.html

    [httpd]
    enable_cors = true

    [cors]
    origins = app://obsidian.md, capacitor://localhost, http://localhost
    credentials = true
    methods = GET, PUT, POST, HEAD, DELETE
    # Added essential CouchDB replication headers required by LiveSync
    headers = accept, authorization, content-type, origin, referer, x-csrf-token, X-Couch-Full-Commit, If-Match

    [couchdb]
    # Optional: Increases max document size to match your 500MB HTTP request limit
    max_document_size = 524288000
    ```

- CouchDBの起動

    ```
    docker compose up -d
    ```

- Obsidian用データベース作成
  - ブラウザを開き、 http://localhost:5984/_utils/ にアクセスします。ログイン画面が表示されるので、docker-compose.yml で設定した ユーザー名（COUCHDB_USER） と パスワード（COUCHDB_PASSWORD） を入力してログイン
  - 画面右上にある 「Create Database」 ボタンをクリック
  - データベース名（例: obsidian-vault-kf）を入力し、Non-partitioned を選択した状態で「Create」をクリック