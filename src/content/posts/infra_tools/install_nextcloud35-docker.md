---
title: "NextcloudをDocker上で動かす "
date: "2026-10-05"
category: "infra_tools"
---

- 前提
  - Cloudflare経由でhttpsでアクセス かつ ローカルではhttpでアクセス可能とする
  - Nextcloud、mariadb、redisのDockerイメージのバージョンは指定する

- docker-compose.ymlの作成

  ```bash
  networks:
    nextcloud-network:
      driver: bridge

  services:
    # -----------------------------------------------------------------------
    # データベース(MariaDB 11.4)
    # -----------------------------------------------------------------------
    db:
      image: mariadb:11.4
      container_name: nextcloud-db
      restart: always
      command: --transaction-isolation=READ-COMMITTED --binlog-format=ROW --innodb-file-per-table=1 --character-set-server=utf8mb4 --collation-server=utf8mb4_general_ci
      volumes:
        - ./mariadb_data:/var/lib/mysql
      environment:
        - MYSQL_ROOT_PASSWORD=xxxxx
        - MYSQL_PASSWORD=yyyyy
        - MYSQL_DATABASE=nextcloud
        - MYSQL_USER=nextcloud
      networks:
        - nextcloud-network
      labels:
        jp.hatenablog.owner.inventory.role: "database"
        jp.hatenablog.owner.inventory.env: "production"
        jp.hatenablog.owner.inventory.owner: "kazukifu"
        jp.hatenablog.owner.inventory.port.container: "3306"
        jp.hatenablog.owner.inventory.port.protocol: "tcp"
        jp.hatenablog.owner.inventory.description: |
          Nextcloud用 MariaDB 11.4。
          READ-COMMITTED + ROW binlog + utf8mb4 の Nextcloud 推奨構成。

    # -----------------------------------------------------------------------
    # Redis キャッシュ
    # -----------------------------------------------------------------------
    redis:
      image: redis:8.4.0-alpine
      container_name: nextcloud-redis
      restart: always
      networks:
        - nextcloud-network
      labels:
        jp.hatenablog.owner.inventory.role: "cache"
        jp.hatenablog.owner.inventory.env: "production"
        jp.hatenablog.owner.inventory.owner: "kazukifu"
        jp.hatenablog.owner.inventory.port.container: "6379"
        jp.hatenablog.owner.inventory.port.protocol: "tcp"
        jp.hatenablog.owner.inventory.description: |
          Nextcloud用 Redis 8.4.0(alpine)。

    # -----------------------------------------------------------------------
    # Nextcloud 本体
    # -----------------------------------------------------------------------
    app:
      image: nextcloud:35
      container_name: nextcloud-app
      restart: always
      ports:
        # Cloudflare Tunnel(別コンテナ/別ホスト)等からのアクセス用に 11000 番ポートを開放
        - "11000:80"
      volumes:
        - ./nextcloud_data:/var/www/html
        - /mnt/WD-8TB/info-shelf:/WD-8TB-info-shelf   # External Storageとしてマウント
      environment:
        - MYSQL_HOST=db
        - MYSQL_PASSWORD=yyyyy
        - MYSQL_DATABASE=nextcloud
        - MYSQL_USER=nextcloud
        - REDIS_HOST=redis
        # 別 Compose やホスト経由でプロキシされる場合の信頼IP範囲を設定(Dockerネットワーク帯域をカバー)
        - TRUSTED_PROXIES=172.16.0.0/12 192.168.0.0/16 10.0.0.0/8
      depends_on:
        - db
        - redis
      networks:
        - nextcloud-network
      labels:
        jp.hatenablog.owner.inventory.role: "nextcloud-app"
        jp.hatenablog.owner.inventory.env: "production"
        jp.hatenablog.owner.inventory.owner: "kazukifu"
        jp.hatenablog.owner.inventory.port.host: "11000"
        jp.hatenablog.owner.inventory.port.container: "80"
        jp.hatenablog.owner.inventory.port.protocol: "tcp"
  ```

- 起動と動作確認

  ```bash
  docker compose up -d
  ```

- ローカル直接アクセスとCloudflare経由アクセスの両立の仕組み
  - TRUSTED_PROXIES が正しく機能します。Cloudflare 経由でアクセスした場合 ([https://your-domain.com](https://your-domain.com))
    - Cloudflare Tunnel が Nextcloud へリクエストを転送する際、暗号化通信であることを示す X-Forwarded-Proto: https というヘッダーを付与します。
    - Nextcloud は TRUSTED_PROXIES(プライベートIP帯)からの通信を信頼するため、このヘッダーを見て自動的に HTTPS 通信として認識し、生成するリンクも https:// になります。
  - ローカル IP でアクセスした場合
    - リバースプロキシを通さない直接の HTTP アクセスとなるため、Nextcloud は普通に HTTP 通信として処理します。前回のような SSL エラー(リダイレクトループ)は発生しません。

- 両立させる際の実践チェックポイント
  - 両方のルートからアクセスする場合、Nextcloud の「信頼できるドメイン (trusted_domains)」に両方のホスト名を登録しておく必要があります。もし Cloudflare 経由でアクセスした際に 「信頼できないドメインからのアクセスです (Access through untrusted domain)」 という画面が出た場合は、以下のいずれかの方法でドメインを追加してください。
    - コンテナからコマンドで追加する

    ```bash
    docker exec -u www-data nextcloud-app php occ config:system:set trusted_domains 2 --value="nextcloud.yourdomain.com"
    ```

    - デフォルトのDocker環境であれば、UFWでポート許可(sudo ufw allow 11000)を行う必要はありません。
      - Dockerは起動時にLinuxのルーティング機能(iptables)を直接操作します。そのため、ports: - "11000:80" と指定してコンテナを起動すると、UFWの制限ルール(deny)を自動的にバイパスしてポートを開開放します。そのため、別ホストの Cloudflare Tunnel や宅内LANのPCからにアクセスする場合、UFWで特別に許可を追加しなくても通信が通ります。
