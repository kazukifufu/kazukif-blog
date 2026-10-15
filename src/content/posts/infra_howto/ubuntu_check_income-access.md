---
title: "[Ubuntu]想定外のアクセスや不正なリクエストがないか定期的に確認する"
date: "2026-10-15"
dateRevised: "2026-10-16"
category: "infra_howto"
---

- 前提

  Cloudflare Tunnelを使っているメリットとして、悪意あるアクセスを自サーバーに到達させる前にCloudflareが防いでくれる。

- tcpdumpで取得したログをWiresharkで確認する

  Photoprism（HTTPポート 12342）と SSH（ポート 22）をCloudflare Tunnel経由で公開している環境ですね。目的に合わせて、両方のポートのトラフィックを効率よくキャプチャし、Wiresharkで分析する具体的な手順を解説します

  - `tcpdump` によるキャプチャ実行
    - PhotoprismのHTTPトラフィックとSSHのトラフィックをインターフェース（`any`）上でキャプチャするには、以下のように `port` を複数指定したコマンドを実行します。

        ```bash
        sudo tcpdump -i any -nn -s 0 -w /tmp/tunnel_services_$(date +%Y%m%d_%H%M%S).pcap "port 12342 or port 22"
        sudo timeout 600 tcpdump -i any -nn -s 0 -w /tmp/tunnel_services_$(date +%Y%m%d_%H%M%S).pcap "port 12342 or port 22"   #例: 10分間だけキャプチャして自動終了させる場合
        sudo tcpdump -i any -nn -s 0 -c 10000 -w /tmp/tunnel_services_$(date +%Y%m%d_%H%M%S).pcap "port 12342 or port 22"   #例: パケット数を指定して終了させる場合（例: 10,000パケット

        ```
      - **`port 12342 or port 22`**: Photoprism（12342）と SSH（22）の両方の通信を同時にキャプチャ対象にします
      - 保存された `.pcap` ファイルを手元にダウンロードしてWiresharkで開きます。

  - Wiresharkでの分析ステップ（サービス別）

    Wiresharkでファイルを開いたら、サービスごとにフィルターをかけて「想定外のアクセス」がないかを点検します。
    - Photoprismの分析（ポート `12342`）

      PhotoprismはWebアプリケーション（HTTP/HTTPS）なので、Wiresharkでリクエストの内容やアクセス元を詳細に追うことができます。
      - **表示フィルターの適用:**
        ```text
        tcp.port == 12342 && http.request

        ```

      - **確認すべきポイント:**
        - **アクセス元IP (`CF-Connecting-IP`):** HTTPヘッダーの詳細ペインを展開し、実際の外部ユーザーのIPを確認します。
        - **不審なパス（URI）:** 写真管理アプリであるため、以下のような不正なスキャンがないかチェックします。
        - `/api/v1/...` 以外の予期せぬエンドポイントへの大量リクエスト
        - 脆弱性スキャナーなどが自動的に探る既知のパス（例: `/wp-login.php`, `/.env`, `/config` など）


      - **リクエストの頻度と容量:** 「Statistics」 > 「Conversations」で、特定のIPが異常に大量の画像をダウンロード（スクレイピングやDDoSの兆候）していないか確認します。

    - SSHの分析（ポート `22` と重要な注意点）

      SSHは通信自体が暗号化されているため、Wiresharkでコマンドやパスワードの中身を見ることはできません。パケットの「メタデータ（接続の頻度、切断の多さなど）」を中心に分析します。

      - **表示フィルターの適用:**
        ```text
        tcp.port == 22

        ```

      - **確認すべきポイント:**
        - **ブルートフォース攻撃の検知:** 短時間に同じ接続元から何度もTCPハンドシェイク（SYNパケット）やSSHの接続確立・切断が繰り返されていないか（総当たり攻撃の兆候）を確認します。

    > ⚠️ **【重要】Cloudflare Tunnel経由のSSHにおける注意点**
    > Cloudflare Tunnel（特にCloudflare Access経由）を利用してSSHを公開している場合、`cloudflared` がトンネルを終端してローカルの `sshd`（ポート 22）に転送するため、ローカルの `lo` インターフェースでキャプチャすると、**接続元IPがすべて `127.0.0.1`（`cloudflared` プロセス）に見えてしまう**現象が起きることがあります。
    > そのため、SSHに関しては **Wiresharkでのパケット分析よりも、以下のログを直接確認・監視する方が圧倒的に確実** です。
    > * Ubuntu側のSSHログ（`/var/log/auth.log` または `journalctl -u ssh`）

- SSH（ポート 22）のログ監視

  SSHはインターネット上から常に総当たり（ブルートフォース）攻撃に狙われやすいサービスです。Ubuntuサーバー側のログを監視し、自動でブロックする仕組みを構築します。

  - 最新のSSHログをリアルタイムで監視する
    ```bash
    sudo journalctl -u ssh -f
    ```
  - 最近のログイン失敗（不正アクセスの試行）を調べる
    ```bash
    sudo journalctl -u ssh --since "1 hour ago" | grep "Failed"
    ```

    ここに見たこともないIPからの Failed password for invalid user ... が大量に流れていれば、不正アクセスの試行を受けています。

- Photoprism（ポート 12342）のログ確認と監視

  Photoprismは写真管理アプリであり、ログイン画面やAPIエンドポイントへの不正なスキャン（脆弱性探索など）がないかを定期的に確認したいところです。
  - Photoprism自体のログを確認する

    Photoprismがどのように動作しているか（Dockerなのか、ネイティブなのか）によってログの確認先が異なります。
    - Dockerで動かしている場合
      ```bash
      sudo docker logs -n 100 photoprism  #コンテナ名が photoprism の場合
      ```

      - 確認すべきポイント
        - 存在しないパス（例: /wp-login.php, /.env, 拡張子の怪しいファイル等）へのアクセスが大量に記録されていないか。
        - ログイン失敗のエラーが特定のIPから異常な回数発生していないか。
