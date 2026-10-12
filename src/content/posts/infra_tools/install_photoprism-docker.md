---
title: "PhotoPrismをDocker上で動かす "
date: "2026-10-11"
dateRevised: "2026-10-12"
category: "infra_tools"
---

- 前提

  自宅の膨大な写真や動画をセキュアかつスマートに管理したいと考えたとき、AIによる顔認識や自動分類機能を備えた「PhotoPrism」はセルフホスト型フォトギャラリーです。DockerとMariaDBを使ってPhotoPrismを構築する手順と、写真を取り込むためのインデックス作成方法を解説します。


- 構築環境とDocker構成
  - データベースには長期安定運用に優れる **MariaDB 11.4 LTS** を指定し、安全性を確保
  - ホスト側の写真保存フォルダをDockerボリュームとしてマウントし、既存の資産をそのまま活用


- 設定ファイルの準備 (`docker-compose.yml` & `.env`)
  - コンテナを管理するための設定ファイルを用意します。機密情報（パスワード）は `.env` ファイルに切り出して安全に管理します。

    **docker-compose.yml**

    ```yaml
    services:
    photoprism:
        image: photoprism/photoprism:latest
        restart: unless-stopped
        stop_grace_period: 10s
        depends_on:
        - mariadb
        security_opt:
        - seccomp:unconfined
        - apparmor:unconfined
        ports:
        - "12342:2342"
        environment:
        PHOTOPRISM_ADMIN_USER: "admin"
        PHOTOPRISM_ADMIN_PASSWORD: "${PHOTOPRISM_ADMIN_PASSWORD}"
        PHOTOPRISM_AUTH_MODE: "password"
        PHOTOPRISM_SITE_URL: "http://10.0.1.11:12342/"
        PHOTOPRISM_DATABASE_DRIVER: "mysql"
        PHOTOPRISM_DATABASE_SERVER: "mariadb:3306"
        PHOTOPRISM_DATABASE_NAME: "photoprism"
        PHOTOPRISM_DATABASE_USER: "photoprism"
        PHOTOPRISM_DATABASE_PASSWORD: "${MARIADB_PASSWORD}"
        PHOTOPRISM_SITE_CAPTION: "Photos（共有）"
        volumes:
        - "~/Pictures:/photoprism/originals"
        - "/mnt/WD-8TB/Pictures:/photoprism/originals/Pictures"   # 共有フォルダのマウント例[cite: 1, 2]
        - "./storage:/photoprism/storage"

    mariadb:
        image: mariadb:11.4
        restart: unless-stopped
        stop_grace_period: 15s
        security_opt:
        - seccomp:unconfined
        - apparmor:unconfined
        volumes:
        - "./database:/var/lib/mysql"
        environment:
        MARIADB_AUTO_UPGRADE: "1"
        MARIADB_DATABASE: "photoprism"
        MARIADB_USER: "photoprism"
        MARIADB_PASSWORD: "${MARIADB_PASSWORD}"
        MARIADB_ROOT_PASSWORD: "${MARIADB_ROOT_PASSWORD}"

    ```

    **.env**

    ```env
    PHOTOPRISM_ADMIN_PASSWORD="your_admin_password_here"
    MARIADB_PASSWORD="your_mariadb_password_here"
    MARIADB_ROOT_PASSWORD="your_root_password_here"

    ```


- PhotoPrismの起動

  ファイルが準備できたら、ターミナルからDocker Composeを実行してコンテナをバックグラウンドで起動します。

    ```bash
    docker compose up -d

    ```

  コンテナが立ち上がったら、ブラウザから `http://<サーバーIP>:12342`（今回の環境では `[http://10.0.1.11:12342/](http://10.0.1.11:12342/)`）にアクセスし、設定した `admin` ユーザーでログインします。


- インデックスの作成（写真の読み込み）

  写真データをPhotoPrismに認識させ、メタデータやAIタグを生成するためにはインデックス作成（スキャン）を行う必要があります。インデックスは、Web管理画面またはコマンドラインのどちらからでも実行できます。

  - 方法A: Web管理画面から実行する場合
    1. ブラウザからPhotoPrismにログインします。
    2. 左側メニューの **Library** を開き、上部タブの **INDEX** を選択します。
    3. 初回や全体を再スキャンしたい場合は **Complete Rescan** にチェックを入れます。
    4. 右側の **START** ボタンをクリックすると、全写真のスキャンとメタデータ・AIタグの生成が始まります。
    *(※作成にかかる時間は、写真の枚数やファイルサイズによって異なります)*

  - 方法B: ターミナル（コマンド）から実行する場合

    バックグラウンドで手軽にインデックスを走らせたい場合は、以下のコマンドを実行します。

    - 通常のスキャン（新しく追加された写真などを対象）:
        ```bash
        docker compose exec photoprism photoprism index

        ```

    - 完全再スキャン（Complete Rescanに相当）:
        ```bash
        docker compose exec photoprism photoprism index -f

        ```

- ユーザーの追加

  有料版（PhotoPrism Plus / Pro）を利用している場合、Web UI（ブラウザ画面）から直接ユーザーの追加や権限管理が行えますが、無料のコミュニティ版（CE）を利用している場合、この機能が使用できません。コマンドを使って対応する必要があります。

  - ターミナルから以下のコマンドを実行
    ```bash
    docker compose exec photoprism photoprism users add [ユーザー名]

    ```

    - 実行後、画面の指示に従って以下を設定します。ただし、Role（権限）：user や viewer はできません
      - メールアドレス
      - パスワード