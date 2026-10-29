---
title: "[Obsidian] Self-hosted LiveSync のトラブルシューティングと CouchDB 初期化"
date: "2026-10-20"
category: "infra_howto"
---

- 背景

  Obsidianのコミュニティプラグイン「Self-hosted LiveSync」を導入・運用する中で遭遇する画面表示の意味、設定診断、および接続エラー発生時の CouchDB 初期化手順についてのまとめになります。


- LiveSync ステータスバーと初期通知の表示解説
  - ステータスバーの数字とアイコンの意味

    同期実行中にステータスバーに表示される各種数値やアイコンの役割は以下の通りです。

    ```text
    ↑ 37275 (7228)  ↓ 0  Sync: ⚡
    ```
    - **`↑ 37275 (7228)`**: アップロード(送信)されたチャンクおよびメタデータの数。前者の数値が処理された全チャンク数、括弧内が対象ファイル数
    - **`↓ 0`**: ダウンロード(受信)されたチャンク数
    - **`Sync: ⚡`**: リアルタイム同期処理が進行中であることを示す
    - **`Sync: zᶻZ`**: 同期処理が完了し、新たな変更を監視する待機(アイドル)状態であることを示す
    - **`↓ 1`**: ロングポーリング(常時接続監視)のセッションが1本アクティブに維持されている状態。データ転送自体は完了

- セットアップ時の確認メッセージと設定プリセット
  - **All optional features are disabled**
    初期セットアップ直前に表示されます。初回同期の競合を防ぐため、設定同期(Customisation Sync)や隠しファイル同期(Hidden File Sync)を自動的にオフにする通知です。同期完了後に設定画面から必要に応じてオンに切り替えます
  - **同期プリセットの適用ボタンについて**
    プリセットを選択して「適用」を押した際、再度設定画面を開くと選択欄がブランクに戻りますが、これは仕様です。プリセット欄は現在の状態を保持する場所ではなく、「一括上書き実行ボタン」として動作します。適用結果は下部の「同期モード」などの各個別設定値に反映されます


- プラグイン設定診断とチャンクサイズの最適化

  プラグインのアップデート時などに「設定診断ツール」が起動することがあります。

  > 💡 **診断のポイント**
  > V3 Rabin-Karp チャンクスプリッターを使用している場合、`customChunkSize` の推奨値は **`60`**(約6MB相当の上限)です。`0` になっている場合は「修正する」を選択して理想値へ更新してください。

  - デバイス間設定ミスマッチの解消

    設定を変更した直後などに以下の通知が表示される場合があります。

    ```text
    Some mismatches have been detected in the configuration between devices.
    Running a manual replication will attempt to resolve this issue.
    ```

    コマンドパレットから手動同期(`LiveSync: 同期` や `Replicate now`)を実行することでリモート側の設定が更新され、ミスマッチが解消されます。

    ```text
    The configuration stored remotely has been updated.
    ```

- CouchDB 接続エラーと `_users` データベースの初期化

  `サーバーに接続できませんでした。` というエラーが発生し、CouchDB のログに以下のようなエラーが出力される場合があります。

  - ログエラー例

    ```erlang
    [error] 2026-10-18T10:18:05.561125Z nonode@nohost emulator -------- Error in process <0.371183.0> with exit value:
    {database_does_not_exist,[{mem3_shards,load_from_db,[<<"_users">>],...

    ```
    - local.iniの[couchdb]セクションにsingle_node = trueを指定している場合は、自動的に作成されるため、本エラーは発生しない
    - local.iniに[cluster]セクションを追加し、n = 1 を指定することで、下記のSingle-Node Setupも不要になる
    
    > ⚠️ **原因**
    > CouchDB の稼働に必要なシステムデータベース(`_users` や `_replicator`)が存在しないため、認証キャッシュ処理でエラーが発生しています。

  - 対処手順 (Fauxton Web UI からの初期化)
    - ブラウザで CouchDB 管理画面にアクセスします。
        ```text
        http://<CouchDB-IP>:5984/_utils/

        ```

    - 管理者アカウント(`couchdb_admin` 等)でログインします。
    - 左メニューの **Setup** タブ(レンチマーク)を開き、**Single-Node Setup** を選択します。
    - 設定項目を確認・入力して **`Configure Node`** を実行します。
        - **Admin credentials**: 管理者ユーザー名・パスワード
        - **Bind address**: `0.0.0.0`
        - **Port**: `5984`

        ```bash
        # curl コマンドで一括初期化する場合の代替コマンド
        curl -X POST http://admin:password@<CouchDB-IP>:5984/_cluster_setup \
        -H "Content-Type: application/json" \
        -d '{"action": "finish_cluster"}'

        ```

  - 正常稼働の確認方法
    - CouchDB Databases 一覧の確認

      初期化成功後、`Databases` タブ(円筒状アイコン)で以下の構成になっていれば正常です。

      - **`_users`**: システムユーザー管理データベース
      - **`_replicator`**: システムレプリケーションデータベース
      - **`obsidian-vault-kf`**: LiveSync 用 Vault データベース

- CouchDB アクセスログの正常例

  通信成功時には CouchDB ログに以下のような `200` や `204` の成功コードが出力されます。

  ```text
  [notice] ... GET /obsidian-vault-kf/_local/... 200 ok
  [notice] ... OPTIONS /obsidian-vault-kf/_local/... 204 ok
  [notice] ... GET /obsidian-vault-kf/_changes?feed=longpoll... 204 ok
  ```

  特に `feed=longpoll` に対するレスポンスが出力されていれば、リアルタイム監視接続が正常に確立されています。

- チェックリスト

    | 項目 | 確認ポイント | 正常時の状態 |
    | --- | --- | --- |
    | **ステータスバー** | アイコンと数値 | `Sync: zᶻZ` かつ `↓ 1`(ロングポーリング接続維持) |
    | **チャンクサイズ** | プラグイン設定値 | `customChunkSize: 60` |
    | **CouchDB DB** | システムデータベース | `_users`, `_replicator` が存在すること |
    | **CouchDB Log** | アクセスログのステータス | エラーログ(`[error]`)なし、`longpoll` 接続継続 |