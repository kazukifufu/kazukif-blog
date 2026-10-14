---
title: "[Ubuntu]rootアカウントの直接ログインが無効化されている理由と確認方法"
date: "2026-10-14"
category: "infra_howto"
---

- 前提

  Cloudflare Tunnelを利用してUbuntuサーバー上のサービスの外部公開を行うにあたり、rootログインの制限やその確認方法についてまとめました。

- Ubuntuでrootアカウントが制限されている理由

  Ubuntuでは、日常的な操作に `sudo` コマンドを使用することが推奨されており、初期状態ではrootアカウントに有効なパスワードが設定されていません（アカウントがロックされています）。また、リモートからの不正アクセスを防ぐため、SSH経由でのrootログインもデフォルトで制限されています。


- ローカルでのrootログイン制限の確認 (`/etc/shadow`)

  ローカル環境（コンソールやターミナル）において、rootアカウントのパスワードログインが有効か無効かは `/etc/shadow` ファイルを確認することで分かります。

  - 以下のコマンドを実行します。

    ```bash
    sudo grep '^root:' /etc/shadow

    ```

  - 【出力例（初期状態）】

        ```text
        root:!:19700::::::

        ```

    2番目のフィールドが `!` や `*` になっている場合、有効なパスワードが設定されていない（＝パスワード認証によるログインがロックされている）ことを示しています。


- SSH経由でのrootログイン制限の確認 (`sshd_config`)

  リモートからのSSH接続によるrootログイン制限は、SSHサーバーの設定ファイル (`/etc/ssh/sshd_config`) で管理されています。設定ファイルを開いてみると、以下のように多くの項目が `#` でコメントアウトされています。

  ```text
  #LoginGraceTime 2m
  #PermitRootLogin prohibit-password
  #StrictModes yes
  #MaxAuthTries 6
  #MaxSessions 10

  ```

  このように、設定がコメントアウトされている場合、「実際のシステムがどのようなデフォルト挙動になっているか」気になるところです。

- システム側のデフォルト挙動を確認する方法 (`sshd -T`)

  コメントアウトされている項目の実際の動作を確認するには、OpenSSHの構文チェック・設定確認コマンドである `sshd -T` を使用します。

    ```bash
    sudo sshd -T | grep permitrootlogin

    ```

    - 【実行結果】

        ```text
        permitrootlogin prohibit-password

        ```

  設定ファイル側がコメントアウトされていても、システム内部のデフォルト動作として `prohibit-password`（パスワードによる直接ログインは禁止、SSH公開鍵認証による接続のみ許可）が適用されていることが確認できます。
