---
title: "Ubuntu: ファイルシステム(ext4, XFS)のチェック"
date: "2026-10-08"
category: "infra_howto"
---

- 実行前の最重要ルール(データ破損防止)
  - コマンドを実行する前に、絶対に守るべきルールがあります。

  > ⚠️ **最重要：マウント中のドライブに対して修復コマンドを実行しないこと**
  > 稼働中(マウント中)のファイルシステムに対して修復処理を行うと、**データが破壊・消失する危険性**があります。必ずアンマウント(離脱)した状態で行ってください。

  - パーティション名とマウント状態の確認

    まずは対象のデバイス名(`/dev/sda1` や `/dev/nvme0n1p2` など)と、ファイルシステムの種類を確認します。

        ```bash
        lsblk -f
        ```

- エラーチェックを行う方法(確認のみ)

  修復(書き込み)を行わず、まずは「エラーがあるかどうか」を確認モードで実行するのが安全です。

  - ext4 / ext3 の場合

    `fsck` コマンドに **`-n`** オプション(全ての変更にNoと答える＝読み取り専用)を付けます。

    ```bash
    sudo fsck -n /dev/sdXn
    ```

  - XFS の場合

    XFS 形式の場合は `fsck` ではなく **`xfs_repair`** コマンドを使用し、**`-n`** オプションを付与します。

    ```bash
    sudo xfs_repair -n /dev/sdXn
    ```

    > 💡 **`xfs_repair` コマンドが見つからない／エラーになる場合**
    > `fsck -n` を実行して `fsck.xfs not found` と表示されたり、`xfs_repair: command not found` となる場合は、XFS用管理ツール群が未インストールです。以下のコマンドでインストールしてください。
    > ```bash
    > sudo apt update && sudo apt install xfsprogs
    > ```

  - 正常時のログ(XFSの例)

    エラーがない場合は、各フェーズ(Phase 1〜7)が順調に完了し、最終行に以下のように表示されて終了します。

    ```text
    No modify flag set, skipping filesystem flush and exiting.
    ```

- エラーが検出された場合の修復手順

  確認処理でエラーが見つかり、修復が必要な場合の手順です。

  - ext4 / ext3 の修復

    アンマウントした状態で `fsck` を実行します。

        ```bash
        # 自動で修復を適用する場合(-y)
        sudo fsck -y /dev/sdXn
        ```

  - OS起動ディスク(ルート領域 `/`)を修復したい場合

    OSが起動している `/` パーティションはアンマウントできません。その場合は**次回再起動時に自動チェック**を行わせるか、**Live USB** から起動して修復します。

        ```bash
        # 次回起動時にルート領域を強制チェックさせるフラグを作成
        sudo touch /forcefsck
        sudo reboot
        ```

  - XFS の修復

    XFS ファイルシステムの修復には `xfs_repair` を使用します。

    ```bash
    # アンマウントを確認してから実行
    sudo umount /dev/sdXn

    # 修復の実行
    sudo xfs_repair /dev/sdXn
    ```

  - ログ破損でマウントできない場合の強制修復 (`-L`)

    クラッシュ等によりXFSのジャーナルログが破損し、`xfs_repair` が進まない場合は **`-L`**(ログ消去)オプションを使用します。

        ```bash
        sudo xfs_repair -L /dev/sdXn

        ```

    > ⚠️ **注意**: `-L` オプションは未書き込みのログを破棄するため、最後の数秒間のデータ変更が失われる可能性があります。通常実行で修復できない場合の最終手段として利用してください。


- ファイルシステム別のコマンド比較まとめ

    | 項目 | ext4 (標準的なUbuntu形式) | XFS (大容量・高並列向け) |
    | --- | --- | --- |
    | **チェックのみ** | `sudo fsck -n /dev/sdXn` | `sudo xfs_repair -n /dev/sdXn` |
    | **修復コマンド** | `sudo fsck -y /dev/sdXn` | `sudo xfs_repair /dev/sdXn` |
    | **必要パッケージ** | 標準搭載 (`e2fsprogs`) | `xfsprogs` (`sudo apt install xfsprogs`) |
    | **事前条件** | アンマウント必須 | アンマウント必須 |
