---
title: "Ubuntu 26.04 LTS Tips aptコマンドとapt-get/apt-cacheコマンドの使い分け"
date: "2026-09-30"
category: "infra"
---

- 課題
  - Linux(Debian/Ubuntu系)でパッケージをインストールする際、`apt install`と`apt-get install`のどちらを使うべきかに関し明確に基準を把握できていなかった


- `apt`コマンドの特徴
  - `apt`(Advanced Package Tool)は、`apt-get`や`apt-cache`といった複数のツールに分散していた機能を、より使いやすく統合するために設計された
    -  **使いやすさの向上(ユーザーフレンドリー):**
        - プログレスバー：インストール中に画面下部で進捗状況(%)が確認できる
        - サマリー表示：インストールされるパッケージの数や、削除されるパッケージのリストが整理されて表示される
    - **コマンドの簡略化:**
      - これまで複数のコマンドを使い分けていた操作が、`apt`ひとつで完結する
        - `apt-get install` → `apt install`
        - `apt-get update` → `apt update`
        - `apt-cache search` → `apt search`(`apt-cache`を使わなくて良い)


- `apt-get`コマンドの特徴
  - `apt-get`は歴史が長く、「後方互換性」が非常に高いためである
    - **スクリプトの安定性**
      - `apt`はユーザーに見やすいよう出力(表示)が将来的に変わる可能性があるが、`apt-get`は出力形式が固定されているため、シェルスクリプトなどで自動処理させる際にエラーが起きにくい
    - **高度なオプション**
      - `apt-get`にしかない非常に細かい設定(フラグ)が必要な特殊なケースでは、今でも`apt-get`が使われる


- 使い分けの基準
  - Ubuntu 26.04 LTSのターミナルから`man apt`で表示されるマニュアルの SCRIPT Usage AND DIFFERENCES FROM OTHER APT TOOLS のセクションにも言及がある通り、以下の使い分けとなる
    - ターミナルで自分でタイピングしてインストールする場合 → `apt install`
    - シェルスクリプト(.sh)を書いたり、サーバーの自動設定を行う場合 → `apt-get install`

  - **Ubuntu公式ドキュメント:** の[Ubuntu Server documentation - Package management](https://documentation.ubuntu.com/server/how-to/software/package-management/)にも下記の記載がある
    - 該当する記述(抜粋)
      ```
      > While apt is a command-line tool, it is intended to be used interactively, and not to be called from non-interactive scripts. The apt-get command should be used in scripts (perhaps with the --quiet flag).
      >
      > (`apt`はコマンドラインツールだが、対話的に使用されることを意図しており、非対話的なスクリプトから呼び出すべきではない。スクリプトは`apt-get`コマンドを使用すべきである。)
      ```