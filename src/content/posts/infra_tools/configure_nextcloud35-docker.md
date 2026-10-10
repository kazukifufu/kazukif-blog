--
title: "NextcloudをDocker上で動かす: 外部ストレージ上の写真をMemoriesとRecognize(AI)で管理"
date: "2026-10-10"
category: "infra_tools"
---

- 背景

  外部ストレージに格納した写真に対して、高速な「Memories」アプリ(タイムライン・マップ表示)と、AIによる画像検索・顔認識を実現するアプリを連動させ、手動コマンドでインデックスやAI解析を反映させる手順をまとめました。


- 外部ストレージのファイルをNextcloudに認識させる(ファイルスキャン)

  外部ストレージとしてマウントしたディレクトリ内の写真ファイルは、Nextcloudがまだデータベースとして認識していません。まずはファイルスキャンを実行し、データベースにファイル情報をインポートします。

  - **全ユーザー・全ストレージをスキャンする場合**:
    ```bash
    docker exec -it <nextcloudコンテナ名> php occ files:scan --all
    ```

  - **特定のユーザーのみを対象にする場合**:
    ```bash
    docker exec -it <nextcloudコンテナ名> php occ files:scan ユーザー名

    ```


- Memoriesのインデックス作成(Timeline表示)

  Nextcloudがファイルを認識しただけでは、Memoriesアプリの高速なタイムライン表示(EXIFベースの撮影日時ソート)は有効になりません。MemoriesにEXIF情報を読み込ませ、インデックスを構築させます。

  - **インデックス作成コマンド**:
    ```bash
    docker exec -it <nextcloudコンテナ名> php occ memories:index

    ```

      ※写真ファイル側に正しいEXIF(撮影日時)が含まれていることが前提となります。


- Mapメニューと位置情報のセットアップ

  写真のGPSデータをもとにMapメニューや地名(逆ジオコーディング)を表示させるには、データベースの対応と専用のセットアップが必要です。

  - **データベース要件**: 逆ジオコーディング機能は **MySQL / MariaDB / PostgreSQL** が必須となります(※SQLiteでは地名のプレース名解決機能が動作しないため注意が必要です)。
  - **地名データのセットアップコマンド**:
    ```bash
    docker exec -it <nextcloudコンテナ名> php occ memories:places-setup

    ```


- RecognizeアプリによるAI画像検索・顔認識の導入

  Memoriesで管理する写真に対して、GoogleフォトのようなAI画像検索や自動タグ付け(顔認識・物体検出)を行いたい場合は、Nextcloud公式のAI拡張アプリ **「Recognize」** を組み合わせます。

  - 導入と実行手順
    - Nextcloudの管理画面から **「Recognize」** アプリを検索して有効化する。
    - コンテナ内でAI解析(分類)コマンドを実行する：
        ```bash
        docker exec -it <nextcloudコンテナ名> php occ recognize:classify

        ```

        > **⚠️ 補足：コマンドが「すぐ終わってしまう」場合の原因と対応**
        > `php occ recognize:classify` を実行した際、ログ等も出ずに一瞬でコマンドが終了してしまう場合があります。これには以下のような理由が考えられます。
        > * **処理待ち(キュー)のタスクが存在しない**: ファイルスキャンは完了していても、AI解析用のキューにまだタスクが登録されていない状態です。
        > * **すでに処理済みである**: 過去にスキャンや実行を行っており、データベース上で「処理済み」とマークされているファイルはスキップされます。
        > 
        > 
        > **【対応策】**
        > もしAI解析が走っていないように感じる場合は、バックグラウンドジョブを強制実行してキューを消化・登録させてみてください。
        > ```bash
        > docker exec -it <nextcloudコンテナ名> php occ background:job
        > 
        > ```
        > 
        > 


- まとめ：外部ストレージ運用時の実行順序

  外部ストレージ上の写真をNextcloudでフル活用(タイムライン・マップ・AI検索)するために、以下の順番でコマンドを実行・反映させていくのがスムーズです。

  - **`php occ files:scan --all`** (Nextcloudへのファイル登録)
  - **`php occ memories:index`** (Memories用のEXIFインデックス作成)
  - **`php occ memories:places-setup`** (地図・ジオコーディングの準備)
  - **`php occ recognize:classify`** (AIによる顔・物体認識の解析)
