---
title: "TriliumNextをDockerで動かす"
date: "2026-10-27"
category: "infra_tools"
---

- 前提
  
  階層構造でノートを管理できるセルフホスト型ノートアプリ「TriliumNext」を、Raspberry Pi 4(4GB)上のDockerで動かします。arm64イメージを使うため、OSは64bit版(Raspberry Pi OS 64bitなど)が必要です(`uname -m` で `aarch64` と表示されればOK)。DockerとDocker Composeプラグインはインストール済みとします。

- docker-compose.yml の作成
  
  ```yaml
  services:
    trilium:
      # バージョンを v0.106.0 に固定。
      # latest を使うと docker compose pull 時に意図せずバージョンが上がり、
      # データベースのスキーマ変更等で不具合が出る可能性があるため、タグを固定する。
      # バージョンアップ時はリリースノートを確認し、事前にバックアップを取ること。
      image: triliumnext/trilium:v0.106.0
      container_name: trilium
      restart: unless-stopped
      # 【restart: always と unless-stopped の違い】
      # always         : Docker デーモン起動時・コンテナ停止時に常に再起動する
      #                  手動で docker stop しても再起動される
      # unless-stopped : 手動で停止した場合は再起動しない
      # ノート用サーバーは常時稼働が必要なため always を採用する。
  
      ports:
        # ホストの 12000 番ポートを、コンテナ内の Trilium(8080番)に転送する。
        # このままだとLAN内の全端末からアクセスできる。
        # 外部(インターネット)に公開する場合はリバースプロキシ経由で
        # HTTPS 化することを強く推奨する。
        - "12000:8080"
  
      volumes:
        # Trilium のデータ(document.db、設定ファイル等)の永続化先。
        # コンテナを削除・再作成してもノートデータが保持される。
        # バックアップ対象に含めること。
        # 権限エラーが出る場合は事前に mkdir して chown 1000:1000 しておく。
        - ./trilium-data:/home/node/trilium-data
  
      environment:
        # タイムゾーンを日本時間に設定。
        # ノートの作成日時・更新日時が日本時間で記録される。
        - TZ=Asia/Tokyo
  
      labels:
        jp.hatenablog.owner.inventory.role:           "note-taking-server"
        jp.hatenablog.owner.inventory.env:            "production"
        jp.hatenablog.owner.inventory.owner:          "kazukifu"
        jp.hatenablog.owner.inventory.port.host:      "12000"
        jp.hatenablog.owner.inventory.port.container: "8080"
        jp.hatenablog.owner.inventory.port.protocol:  "tcp"
        jp.hatenablog.owner.inventory.description: |
          TriliumNext v0.106.0。
          階層構造でノートを管理するセルフホスト型ノートアプリ。
          Raspberry Pi 4(4GB)上で稼働。
          データは ./trilium-data に永続化。
          外部公開する場合はリバースプロキシ経由で HTTPS 化すること。
  ```

- TriliumNextの起動
  
  ```
  docker compose up -d
  ```
  
  起動状態とログは次のコマンドで確認できます。
  
  ```
  docker compose ps
  docker compose logs -f trilium
  ```

- 初期設定
  
  - ブラウザを開き、`http://<ラズパイのIPアドレス>:12000` にアクセスします。
  - 初回アクセス時にセットアップ画面が表示されるので、新規にドキュメントを作成し、ログイン用のパスワードを設定します。
  - 設定後、ログイン画面からパスワードを入力するとノート画面が開きます。

- バックアップ
  
  ノートのデータは `./trilium-data` に保存されています。コンテナを停止してからディレクトリごとコピーするのが確実です。
  
  ```
  docker compose stop
  cp -a trilium-data trilium-data_backup_$(date +%Y%m%d)
  docker compose start
  ```
  
  SDカードは書き込みに弱いため、可能であればSSDへの保存をおすすめします。

- バージョンアップ
  
  `docker-compose.yml` の `image` のタグを書き換え、バックアップを取ったうえで次のコマンドを実行します。
  
  ```
  docker compose pull
  docker compose up -d
  ```