---
title: "Ubuntu 26.04 LTSの導入(その11) 日本語入力の設定"
date: "2026-09-28"
category: "infra"
---

- 課題
  - Ubuntu 26.04では、デフォルトのディスプレイサーバーであるWaylandへの完全移行が進んだ影響もあり、従来のIBus環境ではGoogle ChromeやSnapアプリで「文字が二重に入力される」「そもそも日本語入力に切り替わらない」といったトラブルが起きやすくなっている。


- 解決策
  - 現時点で動作が安定している「Fcitx5 + Mozc」の組み合わせを用いた日本語入力環境の構築


- なぜ「Fcitx5 + Mozc」なのか
  - Ubuntu 24.04以降、そして今回の26.04においては、入力フレームワークの選定が重要になる。

    | フレームワーク | Wayland対応 | Snap/Flatpakアプリでの安定性 | 評価 |
    | --- | --- | --- | --- |
    | IBus(標準) | △ 一部で不具合あり | ⚠️ 二重入力などのトラブル多発 | あまり推奨しない |
    | Fcitx5 | ○ 良好 | ○ 環境変数の設定で安定動作 | 最もおすすめ |


- Fcitx5 + Mozcのインストールと初期設定
  - **パッケージのインストール:**

     必要なパッケージをまとめてインストールする。

     ```bash
     sudo apt update
     sudo apt install -y fcitx5 fcitx5-mozc fcitx5-config-qt language-selector-common
     ```

  - **入力メソッドの切り替え:**

     システムの標準入力フレームワークをIBusからFcitx5に変更する。

     ```bash
     im-config -n fcitx5
     ```

  - **環境変数の設定:**

     Waylandや各種アプリ(GTK/Qt/Snap)でFcitx5を完全に機能させるため、環境変数を`~/.profile`の末尾に追記する。

     ```bash
     cat >> ~/.profile << 'EOF'

     # Fcitx5 Settings
     export GTK_IM_MODULE=fcitx
     export QT_IM_MODULE=fcitx
     export XMODIFIERS=@im=fcitx
     export INPUT_METHOD=fcitx
     EOF
     ```

  - **GNOME独自の入力管理との競合回避:**

     Ubuntuのデスクトップ環境(GNOME)が持つ独自の入力制御と競合しないよう、設定を上書きする。

     ```bash
     gsettings set org.gnome.settings-daemon.plugins.xsettings overrides "{'Gtk/IMModule':<'fcitx'>}"
     ```

  - **Fcitx5の自動起動設定:**

     ログイン時に自動でFcitx5が立ち上がるよう、スタートアップに登録する。

     ```bash
     mkdir -p ~/.config/autostart
     cp /usr/share/applications/org.fcitx.Fcitx5.desktop ~/.config/autostart/
     ```

     > **重要:** ここまでの設定を確実に反映させるため、一度システムを再起動するか、ログアウトして再ログインを行う。


- 【重要】Fcitx設定画面での落とし穴と微調整

  再ログイン後、アプリケーション一覧から「Fcitx 5 設定」(Fcitx Configuration)を起動する。

  右側の「Available Input Method」から`mozc`を検索し、左側の「Current Input Method」に追加するのだが、ここで初期状態の並び順に落とし穴がある。

  一見すると、以下のように日本語配列、Mozc、そしてUS配列が並んでいれば網羅されていて良さそうに見える。

  > **Current Input Methodの初期状態(例)**
  > 1. `Keyboard - Japanese`
  > 2. `Mozc`
  > 3. `Keyboard - English (US)`

  しかし、お使いのパソコンのキーボードが通常の日本語配列(JIS配列、「半角/全角」キーがあるもの)の場合、この3番目の`Keyboard - English (US)`は不要である。これが残っていると、キー入力で切り替える際に「日本語配列 → Mozc → 英語配列」と3段階でトグルしてしまい、意図せず記号の配置(`@`や`_`など)がズレる原因になる。

  快適にするための修正手順は以下の通り。

  - **不要な配列を選択する:**
     左側のリストから`Keyboard - English (US)`を選択する。
  - **右側へ退避させる:**
     真ん中にある`>`(右向き矢印)ボタンをクリックして右側のリストに退避させる。
  - **リストを整理する:**
     左側を`Keyboard - Japanese`と`Mozc`だけのスッキリした状態にする。
  - **設定を保存する:**
     右下の「Apply」(適用)または「OK」をクリックして保存する。

  これで「半角/全角」キーや「Ctrl + Space」を押した際、日本語(JIS配列の英数)とMozc(日本語入力)の間だけでスムーズに切り替わるようになる。