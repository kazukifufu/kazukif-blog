---
title: "Ubuntu 26.04 LTSの導入(その7) ファイアウォール(UFW)の有効化"
date: "2026-09-23"
category: "infra"
---

### ファイアウォール(UFW)の有効化

- インストール直後、Ubuntuに標準搭載されているファイアウォールは、`状態: 非アクティブ`(英語表示の場合は `Status: inactive`)で、**無効化(OFF)されている状態**を意味します。ネットワークからの不要なアクセスをブロックするため、Webサーバーなどを公開・運用する場合は有効化することが推奨されます。

  ```
  $ sudo ufw status
  状態: 非アクティブ
  $
  ```

- UFWを有効化する
  以下のコマンドを実行してファイアウォールを起動します。
  
    ```bash
    sudo ufw enable
    ```

  実行すると `Firewall is active and enabled on system startup`(ファイアウォールはアクティブで、システム起動時に有効になります)と表示されます。


- 状態と設定ルールを確認する
  再度ステータスを確認し、状態が「アクティブ」になっているかテストします。
  
    ```bash
    sudo ufw status
    ```

  出力の1行目が `状態: アクティブ`(または `Status: active`)に変わっていれば、設定は成功です。


- SSH接続中の場合の注意
  SSH経由でリモート操作(別 PC やサーバーへ接続)している場合、事前に SSH の通信ポート(デフォルト: 22/tcp)を許可せずに sudo ufw enable を実行すると、現在の接続が切断されて再接続できなくなる危険があります。リモート操作中の場合は、Firewallを有効化する前に許可ルールを追加 `sudo ufw allow ssh` してください。


- よく使うUFW操作コマンド
  | 操作 | コマンド |
  | --- | --- |
  | **特定のポートを許可**(例: HTTP 80番) | `sudo ufw allow 80/tcp` |
  | **特定のポートを拒否** | `sudo ufw deny 80/tcp` |
  | **ルール番号付きで状態表示** | `sudo ufw status numbered` |
  | **設定したルールを削除** | `sudo ufw delete <ルール番号>` |
  | **一時的に無効化(OFF)に戻す** | `sudo ufw disable` |