---
title: "Ubuntu 26.04 LTSの導入(その8) SSHサーバーの導入と設定"
date: "2026-09-24"
category: "infra"
---

- 導入状況の確認
  [Ubuntu 26.04 LTSの導入(その5) 導入の流れ](https://kazukif-blog.pages.dev/posts/infra/install_ubuntu2604_5/)に従い導入した直後、SSHサーバーは下記の通り導入・起動されていません。

  ```bash
  $ sudo systemctl status ssh
  Unit ssh.service could not be found.
  
  $ ps -ef | grep ssh
  kazukif      2459    2190  0 16:16 ?        00:00:00 /usr/libexec/gcr-ssh-agent --base-dir /run/user/1000/gcr
  kazukif      2461    2190  0 16:16 ?        00:00:00 /usr/bin/ssh-agent -D
  ```
  
  ssh-agent や gcr-ssh-agent（鍵を一時保持するクライアント側のツール）のみが表示されており、SSH サーバーの本体である sshd（または sshd.service）が起動していません。

- SSHサーバー(OpenSSH Server)の導入
  Ubuntu（Linux）上でSSHサーバー（OpenSSH Server）を構築・設定する手順を解説します。安全にアクセスできるよう、「インストール → ファイアウォール許可 → サービス起動 → セキュリティ設定」の順番で進めます。

  1. **インストール:** Prerequisite

      パッケージリストを更新し、OpenSSH Serverをインストールします。

      ```bash
      sudo apt update
      sudo apt install -y openssh-server
      ```

  2. **ファイアウォール（UFW）の許可** Safety

      先ほど確認したUFWでSSH通信（ポート22）を許可してから、UFWを有効化します。

      ```bash
      # SSHポートを許可
      sudo ufw allow ssh
  
      # UFWが非アクティブの場合は有効化
      sudo ufw enable
      ```

  3. **サービス状態の確認** Verification

      SSHサービスが起動し、自動起動が有効になっているか確認します。`active (running)` と表示されていれば起動成功です。

      ```bash
      sudo systemctl status ssh
      ```  

  4. **セキュリティ設定の変更（推奨）**

      デフォルト設定のままでも接続できますが、セキュリティを高めるために設定ファイル（`/etc/ssh/sshd_config` または `/etc/ssh/sshd_config.d/` 配下のファイル）を編集することをお勧めします。

      設定を変更する場合は、設定ファイルを開きます。

      ```bash
      sudo vi /etc/ssh/sshd_config
      ```
      - 主な推奨設定項目
        - **パスワード認証の無効化（鍵認証移行後）**
        公開鍵認証でログインできることを確認したら、パスワードによるログインを禁止します。
          ```text
          PasswordAuthentication no
          ```
        - **root直接ログインの禁止**
        管理者（root）アカウントでの直接ログインを拒否します。
          ```text
          PermitRootLogin no
          ```
        - **ポート番号の変更（ボット対策）**
        デフォルトの `22` 番ポートから別の番号（例: `22222` など）に変更すると、自動攻撃を大幅に軽減できます。*(※ポートを変更した場合は、UFWでも `sudo ufw allow 22222/tcp` のように変更後のポートを許可してください)*
          ```text
          Port 22222
          ```      

      - **設定の反映**
        設定ファイルを保存・終了したら、設定をリロード（再起動）します。
          ```bash
          sudo systemctl restart ssh
          ```
      - **検証方法:**
        接続テストを行う際は、現在のSSHセッションは繋いだまま、**別ウィンドウ（ターミナル）を開いて新規接続**を試してください。設定ミスがあっても現在の接続が切れないため、安全に修復できます。

        - IPアドレスの確認（接続先情報）
          クライアント（PCや他端末）から接続する際に必要な、サーバーのIPアドレスを確認します。
          ```bash
          ip a
          ```
          出力結果の中にある `inet` の後に続く数値（例: `192.168.1.10` など）がIPアドレスです。

          クライアントからの接続コマンド例：

          ```bash
          ssh <ユーザー名>@<サーバーのIPアドレス>
          ssh -p 22222 <ユーザー名>@<サーバーのIPアドレス>  #ポート番号の変更している場合
          ```
        - 💡 補足：毎回 -p を入力するのが面倒な場合
          接続元のPC（手元の端末）の ~/.ssh/config ファイルに設定を書いておくと、次回からポート番号の入力を省略できます。
          ```text
          # 設定例 (~/.ssh/config)
          Host my-server
              HostName 192.168.1.1
              User userid
              Port 22222
          ```
          この設定を追加しておくと、次回からは以下の短いコマンドだけで変更後のポートへ接続できるようになります。
          ```bash
          ssh my-server
          ```