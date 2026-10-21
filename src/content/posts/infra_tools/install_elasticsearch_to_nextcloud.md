---
title: "Nextcloudに全文検索(Elasticsearch)機能を追加する"
date: "2026-10-22"
category: "infra_tools"
---

- 前提

  Nextcloudで管理しているテキストファイルやPDFファイルに全文検索インデックスを作成するために、「Full text search」機能と「Elasticsearch」を組み合わせた環境を構築する。

- 構成
  
  Nextcloudサーバー内に以下のアプリを導入し、バックエンドに検索エンジンを用意する
    - Full text search（検索のコアフレームワーク）
    - Full text search - Elasticsearch Platform（Elasticsearchと連携するプラグイン）
    - Full text search - Files（ユーザーファイルをインデックス対象にするプラグイン）
    - Elasticsearch（Docker）（実際のインデックスを保持・検索するエンジン）
    - Kuromoji（日本語の形態素解析）
    - Ingest Attachment（添付ファイル抽出）


- Elasticsearch仕様にあたりホスト側で必要となる設定

  Elasticsearchコンテナは大量のメモリマップ領域を必要とするため、Linuxのデフォルト設定のままだと起動直後に強制終了（クラッシュ）します。ホストサーバー（Ubuntu等）のターミナルで、あらかじめ以下の設定を行ってください。
  - 一時的な反映（即座に有効化）
    ```bash
    sudo sysctl -w vm.max_map_count=262144
    ```
  - 永続的な反映（サーバー再起動後も維持）

    /etc/sysctl.conf ファイルの末尾に、設定値を追記します。
      ```bash
      echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
      ```

- 設定ファイル、データ領域の準備
  - Elasticsearchを組み込んだDockerfileの作成

    ```text
    FROM docker.elastic.co/elasticsearch/elasticsearch:8.19.23

    # フルパスを指定してプラグインを確実にインストール
    RUN /usr/share/elasticsearch/bin/elasticsearch-plugin install --batch analysis-kuromoji && \
        /usr/share/elasticsearch/bin/elasticsearch-plugin install --batch ingest-attachment
    ```

  - Elasticsearchデータ用ディレクトリの作成と権限設定

    Elasticsearchのコンテナはセキュリティ要件が厳しく、マウントするディレクトリの「所有権（パーミッション）」が正しく設定されていないと起動エラー（AccessDeniedExceptionなど）で即座に落ちます

    ```bash
    # 1. ディレクトリを作成（例として /mnt/WD-8TB/elasticsearch_data とします）
    sudo mkdir -p /mnt/WD-8TB/elasticsearch_data

    # 2. 所有者を Elasticsearch のコンテナ内ユーザー（UID: 1000, GID: 1000）に変更する（重要）
    sudo chown -R 1000:1000 /mnt/WD-8TB/elasticsearch_data
    ```

  - docker-compose.ymlの作成(既存ファイルの更新)

    ```yaml
    networks:
    nextcloud-network:
      driver: bridge

    services:
      # -----------------------------------------------------------------------
      # データベース（MariaDB 11.4）
      # -----------------------------------------------------------------------
      db:
        image: mariadb:11.4
        container_name: nextcloud-db
        restart: always
        command: --transaction-isolation=READ-COMMITTED --binlog-format=ROW --innodb-file-per-table=1 --character-set-server=utf8mb4 --collation-server=utf8mb4_general_ci
        volumes:
          - ./mariadb_data:/var/lib/mysql
        environment:
          - MYSQL_DATABASE=${MYSQL_DATABASE}
          - MYSQL_USER=${MYSQL_USER}
          - MYSQL_PASSWORD=${MYSQL_PASSWORD}
          - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
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
            Nextcloud用 Redis 8.4.0（alpine）。

      # -----------------------------------------------------------------------
      # Nextcloud 本体
      # -----------------------------------------------------------------------
      app:
        image: nextcloud:35
        container_name: nextcloud-app
        restart: always
        ports:
          # Cloudflare Tunnel（別コンテナ/別ホスト）等からのアクセス用に 11000 番ポートを開放
          - "8085:80"
        volumes:
          - ./nextcloud_data:/var/www/html
          # - /mnt/WD-8TB/info-shelf:/WD-8TB-info-shelf
          - /mnt/WD-8TB/info-shelf/Documents_forFess:/WD-8TB-info-shelf-Documents-forFess
        environment:
          - MYSQL_HOST=db
          - MYSQL_PASSWORD=${MYSQL_PASSWORD}
          - MYSQL_DATABASE=${MYSQL_DATABASE}
          - MYSQL_USER=${MYSQL_USER}
          - REDIS_HOST=redis
          # Cloudflare 側で HTTPS 終端されるため、Nextcloud 内で URL を https:// に固定
          # - OVERWRITEPROTOCOL=https
          # 別 Compose やホスト経由でプロキシされる場合の信頼IP範囲を設定（Dockerネットワーク帯域をカバー）
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

      # -----------------------------------------------------------------------
      # 全文検索エンジン（Elasticsearch 8.19.23）
      # -----------------------------------------------------------------------
      elasticsearch:
        build: .
        container_name: nextcloud-elasticsearch
        restart: always
        environment:
          - discovery.type=single-node
          - "ES_JAVA_OPTS=-Xms4g -Xmx4g"
          - xpack.security.enabled=false
        volumes:
          - /mnt/WD-8TB/elasticsearch_data:/usr/share/elasticsearch/data
        networks:
          - nextcloud-network
        labels:
          jp.hatenablog.owner.inventory.role: "search-index"
          jp.hatenablog.owner.inventory.env: "production"
          jp.hatenablog.owner.inventory.owner: "kazukifu"
          jp.hatenablog.owner.inventory.port.container: "9200"
          jp.hatenablog.owner.inventory.port.protocol: "tcp"
          jp.hatenablog.owner.inventory.description: |
            Nextcloud 全文検索(Full text search)用 Elasticsearch。
            Kuromoji（日本語解析）および Ingest-Attachment（ファイル抽出）導入済み。
      ```

  - .envファイルの作成
    ```text
    # Database Credentials
    MYSQL_DATABASE=nextcloud
    MYSQL_USER=nextcloud
    MYSQL_PASSWORD=xxxxx
    MYSQL_ROOT_PASSWORD=yyyyy
    ```
