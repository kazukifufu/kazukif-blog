---
title: "Ubuntu 26.04 LTSの導入(その9) 固定IPアドレスの設定"
date: "2026-09-25"
category: "infra"
---

- 固定IPアドレス化の必要性
  [Ubuntu 26.04 LTSの導入(その8) SSHサーバーの導入と設定](https://kazukif-blog.pages.dev/posts/infra/install_ubuntu2604-8/)でSSHサーバーを導入しましたが、DHCPのままではIPアドレスが変わってしまい、毎回接続先を確認し直す必要があります。自宅サーバーとして安定運用するため、標準のネットワーク管理ツールである**Netplan**を使用してIPv4の固定IPアドレスを設定します。

- 現在のネットワーク情報の確認
  固定IPアドレスを割り当てる前に、現在割り当てられているインターフェース名・デフォルトゲートウェイ・DNSサーバーの情報を確認します。

  1. **インターフェース名とIPアドレスの確認:**

     ```bash
     ip -br addr
     ```

     出力例：

     ```text
     lo               UNKNOWN        127.0.0.1/8 ::1/128
     ens18            UP             192.168.11.38/24 ...
     ```

     この場合、設定対象のインターフェース名は`ens18`になります(環境によって`ens160`や`enp0s3`のように異なります)。

  2. **デフォルトゲートウェイの確認:**

     ```bash
     ip route
     ```

     出力例：

     ```text
     default via 192.168.11.1 dev ens18 proto dhcp src 192.168.11.38 metric 100
     ...
     ```

     この例では、デフォルトゲートウェイは`192.168.11.1`です。

  3. **DNSサーバーの確認:**

     ```bash
     resolvectl status
     ```

     出力結果の`Current DNS Server:`の項目に表示されているDNSサーバーのIPアドレス(例: `192.168.11.1`)を確認します。

- 設定ファイルのバックアップ
  Netplanの設定ファイルは`/etc/netplan/`ディレクトリにあります。まずファイル名を確認し、編集前のバックアップをコピーします。

  ```bash
  ls -l /etc/netplan/
  ```

  ※環境により`00-installer-config.yaml`や`50-cloud-init.yaml`などファイル名が異なります。ここでは`00-installer-config.yaml`を例とします。

  ```bash
  sudo cp /etc/netplan/00-installer-config.yaml /etc/netplan/00-installer-config.yaml.bak
  ```

  設定を間違えるとリモートから接続できなくなる可能性があるため、バックアップは必ず取得しておきます。

- Netplan設定ファイルの編集
  設定ファイルをテキストエディタで開き、固定IPアドレスの定義を書き込みます。

  ```bash
  sudo vi /etc/netplan/00-installer-config.yaml
  ```

  既存のDHCP設定(`dhcp4: true`)を無効化し、以下のように必要な情報を記述します。

  ```yaml
  network:
    version: 2
    renderer: networkd
    ethernets:
      ens18:
        dhcp4: false
        addresses:
          - 192.168.11.38/24
        routes:
          - to: default
            via: 192.168.11.1
        nameservers:
          addresses:
            - 192.168.11.1
  ```

  * 主な設定項目の意味

    + **dhcp4**
      `false`に指定し、IPv4の自動取得を無効化します。
    + **addresses**
      固定するIPアドレスとサブネットマスク(`/24`など)を指定します。
    + **routes(`to: default via: ...`)**
      Ubuntu 26.04では古い形式の`gateway4`ではなく、ルーティングテーブル形式でデフォルトゲートウェイを指定するのが推奨されます。
    + **nameservers(`addresses`)**
      参照するDNSサーバーをリスト形式で記述します。

- 権限の修正と設定の反映
  YAMLファイルはアクセス権限が緩いと警告が出るため、権限を絞った上でテスト・適用を行います。

  1. **パーミッションの変更:**

     ```bash
     sudo chmod 600 /etc/netplan/00-installer-config.yaml
     ```

  2. **構文チェックとテスト適用:**

     SSHが切断されて戻れなくなるリスクがあるため、まず`netplan generate`と`netplan try`を使用します。

     ```bash
     # 構文チェック
     sudo netplan generate

     # 一時適用(設定ミスで接続が切れた場合、自動でロールバックされます)
     sudo netplan try
     ```

     `netplan try`を実行し、問題がなければそのままEnterを押して確定させます。

  3. **設定の正式反映(任意):**

     ```bash
     sudo netplan apply
     ```

     > `netplan try`の確認プロンプトでEnterキーを押して確定した場合、設定はその時点で既に恒久化されています。上記の`netplan apply`は、`netplan try`を使わずに直接反映したい場合のみ実行してください。

- 設定後の動作確認
  設定が正しく反映されたか、以下のコマンドで確認します。

  ```bash
  # IPアドレスの確認
  ip -br addr show ens18

  # ゲートウェイの確認
  ip route

  # DNSの確認
  resolvectl status
  ```

  最後に外部ネットワークへの疎通と、名前解決ができるかを確認します。

  ```bash
  # IPアドレスへの疎通確認
  ping -c 4 8.8.8.8

  # ドメイン(名前解決)の疎通確認
  ping -c 4 google.com
  ```

  どちらも正常に応答があれば、固定IPアドレス化の作業は完了です。

- 注意点

  * **YAMLのインデントエラー**
    Netplanの設定はYAML形式です。タブ文字は使わず、半角スペースのインデントを正確に揃えてください。ズレていると`netplan generate`でエラーになります。
  * **インターフェース名の間違い**
    ネット上の古い記事にある`eth0`をそのままコピーせず、必ず手順1で調べた自身の環境のインターフェース名(`ens18`など)に書き換えてください。
  
  ネットワークアドレスを固定することで、[その8](https://kazukif-blog.pages.dev/posts/infra/install_ubuntu2604-8/)で導入したSSHサーバーへも常に同じアドレスで接続できるようになます。