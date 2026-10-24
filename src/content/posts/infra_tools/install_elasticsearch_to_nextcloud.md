---
title: "Nextcloudに全文検索(Elasticsearch)機能を追加する"
date: "2026-10-22"
dateRevised: "2026-10-23"
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

- Elasticsearchの稼働確認
  - コンテナのビルドと起動
    ```bash
    docker compose up -d --build
    ```

  - Elasticsearchコンテナ起動状況の確認

    Elasticsearchコンテナが正常に起動し、日本語プラグインなどが正しく読み込まれているかは、「コンテナのステータス確認」「内部ログの検証」「APIの応答テスト」の3つのステップで確実に確認

    - コンテナが生存しているか（ステータス確認）
      ```bash
      docker compose ps
      ```
       - 正常な場合の表示例:
         nextcloud-elasticsearch の STATUS が Up (健康状態) または Up [時間] になっていれば第一関門クリアです。もし Exited (1) などで終了している場合は、起動に失敗しています。

    - エラーが出ていないか（ログ確認）

      コンテナは動いていても、内部でエラーを吐き続けているケースがあります。ログを表示して、最後の数行に致命的なエラーがないか確認します。
      ```bash
      docker compose logs elasticsearch --tail=50
      ```
      - チェックポイント:
        ログの最後に [nextcloud-elasticsearch] o.e.n.Node started という一文があれば、クラッシュせず完全に起動が完了しています。Exception や Error、AccessDeniedException などの文字列が出ていなければ正常です。

    - APIが応答するか（疎通・プラグイン確認）

      これが最も確実な確認方法です。同じDockerネットワーク内にいる app（Nextcloud）コンテナの視点から、ElasticsearchのAPIを叩いて応答が返ってくるかをテストします。
      ```bash
      docker compose exec app curl -X GET "http://elasticsearch:9200/_cat/plugins?v"
      ```

      - 正常な場合の応答例:成功すると、以下のように導入されているプラグインの一覧（analysis-kuromoji）がテーブル形式で返ってきます。
      ```text
      component         version
      analysis-kuromoji 8.19.23
      ```

      ```bash
      docker compose exec app curl -X GET "http://elasticsearch:9200/_nodes/ingest?pretty"
      ```

      このコマンドを実行するとコンテナ情報が詳細に返ってきます。その中の processors のリスト内に "type": "attachment" が存在していれば、ingest-attachment プラグイン内部で無事に有効化されています。


- Nextcloud内でのアプリインストール
  - Nextcloudに管理者アカウントでログインし、「アプリ」 画面から以下の3つのアプリを検索してインストール（有効化）
    - Full text search
    - Full text search - Elasticsearch Platform
    - Full text search - Files

  - 管理画面での検索設定

    Nextcloudの 「管理設定」→「全文検索 (Full text search)」 を開き、以下のように設定
    - 検索プラットフォーム (Search platform): Elasticsearch
    - サーブレットのアドレス (Address of the servlet): http://elasticsearch:9200（※Compose内のサービス名がホスト名になります）
    - インデックス名 (Index): nextcloud（任意）
    - Analyzer / Tokenizer: kuromoji（※ここを必ず kuromoji に変更。これで日本語が正しく検索できるようになる）
    - Files - Sources - External Files: Index path and content
    - その他のオプション（PDFの抽出、Officeドキュメントの抽出など）にもチェック

- NextcloudとElasticsearchの接続確認

  ```bash
  docker compose exec --user www-data app php occ fulltextsearch:test
  ```
  モックデータを使ったインデックス作成・検索テストが実行され、すべての項目で ok が返れば成功

- 不要な拡張子（動画や音楽など）を除外する

  ```bash
  docker compose exec --user www-data app php occ fulltextsearch:configure '{"files_excluded_extensions":["mp4","mkv","avi","mov","mp3","wav","flac","zip","tar","gz","rar","iso","img","exe"]}'
  ```

- 初回インデックスの作成
  ```bash
  # Nextcloudのコンテナ名を確認して実行（例: appコンテナの場合）
  docker compose exec --user www-data nextcloud php occ fulltextsearch:index
  # メモリ制限を 1GB に引き上げてインデックスを再開・続行
  docker exec -it -u www-data nextcloud-app php -d memory_limit=1G occ fulltextsearch:index
  # メモリが足りなくなる場合は、-d memory_limit=-1（無制限）に設定して実行
  docker exec -it -u www-data nextcloud-app php -d memory_limit=-1 occ fulltextsearch:index
  ```

  - インデックスの状態をリセットする方法

    もし途中でインデックス処理が中途半端に壊れてしまった場合は、以下のコマンドで一度リセットしてから、.noindex などの除外設定を行った上でやり直すとスムーズです。
    ```bash
    # 検索インデックスの停止・リセット
    docker exec -it -u www-data nextcloud-app php occ fulltextsearch:stop
    docker exec -it -u www-data nextcloud-app php occ fulltextsearch:reset

    # メモリを拡張して再インデックス
    docker exec -it -u www-data nextcloud-app php -d memory_limit=1G occ fulltextsearch:index
    ```

  - Full text search（全文検索）におけるインデックスの状況や進捗の確認方法
    - OCCコマンドによる実行中の進捗確認

      インデックス処理コマンド（php occ fulltextsearch:index）を実行している最中は、画面上にリアルタイムのステータスが表示されます。
      確認できる内容:
      現在処理中のユーザーやファイルパス
      処理の進捗（例：Progress: 150000/341587 のような件数）
      使用メモリ量（例：Memory: 486 MB）
      発生したエラーの件数や詳細

    - OCCコマンドによる状態の確認

      ```bash
      docker exec -it -u www-data nextcloud-app php occ fulltextsearch:check
      ```

    - Elasticsearch（バックエンド）側でのデータ蓄積状況の確認

      Elasticsearchの中に実際にどれだけのインデックス（ドキュメント）が保存されているかは、Elasticsearchコンテナに対して直接問い合わせることで確認できる

      ```bash
      docker exec -it nextcloud-elasticsearch curl -X GET "http://localhost:9200/_cat/indices?v"
      ```

      確認ポイント:
      docs.count: インデックスされたファイルの総数
      store.size: Elasticsearchが消費しているストレージの容量
