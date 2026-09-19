---
title: "Git/Githubに関するチップス"
date: "2026-09-19"
category: "tech"
---

### コミット履歴が分岐(Diverge)している状態への対応

ローカルとリモートの履歴が分岐(Diverge)している状態を確認するには、最新のリモート情報を取得(fetch)したうえで、ログやステータスを確認します

1. 事前に git fetch を実行してリモートの最新状態を取得する

    ```bash
    git fetch origin
    ```

2. ステータスで確認する
  - ステータスで確認する(最も手軽)
    ```bash
    git status
    ```
  - 出力例
    ```plaintext 
    On branch main
    Your branch and 'origin/main' have diverged,
    and have 1 and 2 different commits each, respectively.
    ```
    ローカルに独自コミットが1つ、リモート(origin/main)に独自コミットが2つ存在して分岐していることが直感的に分かります。

  - グラフ表示で履歴の流れを確認する(分岐のイメージを視覚的に把握したい場合に最適)
    ```bash
    git log --graph --oneline --all -n 10
    ```
  - 出力例
    ```plaintext
    * 9c9f151 (HEAD -> main) add operation_log_20260919.md
    | * 96f0017 (origin/main) Merge pull request #12 from dependabot/...
    | * 4a5b6c7 Bump package versions
    |/  
    * 9a88205 Previous common commit
    ```
    共通の親コミット(9a88205)から、ローカル(HEAD -> main)とリモート(origin/main)が枝分かれ(|/)していることが一目で確認できます。

3. リモートの変更を取り込み、履歴を一本化して綺麗に保つ

    ```bash
    git pull origin main --rebase
    ```
    - 枝分かれ（|/）が消えて一本化される
    - ローカルの変更が origin/main（96f0017）の先頭に移動するため、履歴が綺麗に一列に繋がります。
    - ローカルコミットのハッシュIDが変わる
    - ローカルにあった 9c9f151 は、親コミットが 9a88205 から 96f0017 へ再構築されるため、新しいコミットハッシュ（例: a1b2c3d）に生まれ変わります。
    - この状態で git push origin main を実行すると、origin/main の先頭にあなたのコミットが1つだけ追加された状態になり、綺麗にPushが完了します。

  - 出力例
    ```
    * a1b2c3d (HEAD -> main) add operation_log_20260919.md
    * 96f0017 (origin/main, origin/HEAD) Merge pull request #1 from kazukifufu/dependabot/npm_and_yarn/devalue-5.9.4
    |\  
    | * 4a5b6c7 Bump package versions
    |/  
    * 9a88205 Previous common commit
    ```

4. リモートへPushする

    ```bash
    git push origin main
    ```