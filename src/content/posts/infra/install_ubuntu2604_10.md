---
title: "Ubuntu 26.04 LTSの導入(その10) リモートデスクトップ共有の有効化"
date: "2026-09-26"
category: "infra"
---

- Ubuntu側でのリモートデスクトップ共有の有効化
  RDP接続の設定を進める前に、Ubuntu側でリモートデスクトップ共有が有効になっているか、ファイアウォールでポートが許可されているかを確認する。

  - **Remote Desktopを有効にする:**
     「設定 › システム › リモートデスクトップ」を開き、**Remote Desktop**をオンにする。この画面に表示される**専用のユーザー名・パスワード**（通常のログイン認証情報とは別物）を控えておく。

  - **ファイアウォールでポートを許可する:**
     [その8](https://kazukif-blog.pages.dev/posts/infra/install_ubuntu2604-8/)でSSH用にUFWを設定したが、RDP用のポート（デフォルト`3389`）は別途許可する必要がある。

     ```bash
     sudo ufw allow 3389/tcp
     ```

     > ⚠️ 「設定 › システム › リモートデスクトップ」には**Remote Login**と**Desktop Sharing**という2つの項目がある。デフォルトではどちらもポート3389を使用するが、両方を同時に有効にするとDesktop Sharing側は自動的にポート3390へ切り替わる。接続時に使うポート番号が変わるため注意する。


- 発生した問題  
  macOS上のWindows App（旧Microsoft Remote Desktop）からRDP接続を試みたところ、以下のエラーが発生しました。

  > **Your session was disconnected**
  > We couldn't connect to the remote PC. This might be due to an expired password. If this keeps happening, contact your network administrator for assistance.
  > **Error code: 0x207**

  - エラー0x207の根本原因
    macOSのWindows AppはデフォルトでNLA（ネットワークレベル認証）を使用します。NLA認証のハンドシェイク時に、クライアントは接続先ホスト名を使った再認証（リダイレクト）を試みます。

    gnome-remote-desktopとNLAの組み合わせにおいて、このリダイレクト処理が正しく行われないと、パスワードが正しいにもかかわらず認証失敗（**0x207**）が発生します。

- 対処方法
  Windows AppのPC設定画面（Configure PC）を確認したところ、General・Display・Devices & Audio・Foldersのタブが存在しますが、**「リダイレクト サーバー名を使用する」に相当する設定項目はGUIには存在しません**。そのため、`.rdp`ファイルを直接編集して対応します。

  - **既存の接続設定をエクスポートする:**
    - Windows Appのメイン画面で、接続済みのPCを**右クリック**
    - **「Export」**を選択
    - 任意の場所に`.rdp`ファイルを保存（例: `ubuntu.rdp`）

  - **.rdpファイルをテキストエディタで編集する:**
    保存した`ubuntu.rdp`をテキストエディタ（VS Code等）で開き、末尾に以下の1行を追記する。

    ```text
    use redirection server name:i:1
    ```

    追記後、ファイルを上書き保存する。

  - **.rdpファイルから接続する:** Connect
     編集した`ubuntu.rdp`ファイルを**ダブルクリック**するとWindows Appが起動し、接続できる。

     > **補足:** `use redirection server name:i:1`は、RDPクライアントに対して「接続先サーバーのホスト名をリダイレクト先にも使用する」よう指示する設定です。gnome-remote-desktopとNLAを組み合わせる際に必要になります。

- まとめ
  今回のエラーはUbuntu 26.04のWaylandへの完全移行にともなうものでした。従来のxrdpに慣れている方にとっては戸惑いやすいポイントですが、**gnome-remote-desktopはUbuntu 26.04に標準搭載されており、xrdpの代替として機能します**。接続クライアント側の設定を1箇所変更するだけで解決できるため、同様のエラーに遭遇した際はまず本記事の方法を試してみてください。[その9](https://kazukif-blog.pages.dev/posts/infra/install_ubuntu2604-9.md/)で固定化したIPアドレスと組み合わせれば、以降は同じ接続情報でいつでもリモートデスクトップ接続できるようになります。