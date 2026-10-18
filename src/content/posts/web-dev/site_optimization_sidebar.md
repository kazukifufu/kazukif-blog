---
title: "デザインの更新: サイドバーの初期表示(カテゴリのセクションを閉じた状態に)"
date: "2026-10-18"
category: "web-dev"
---

- 課題

  記事が増えてきたため、最初にサイトを開いた時にサイドバーの記事一覧のセクションを閉じた状態で表示する様に変更する

- 修正方針

  初期表示で全カテゴリーが閉じるように、`Sidebar-actual.vue`を修正します。`expandedCategories`の初期値を、全カテゴリーとも`true`（展開）から`false`（閉じる）に変更します。
  
    ```ts
    Object.fromEntries(Object.keys(menuData.value).map((cat) => [cat, false]))
    ```

  カテゴリー名をクリックすると、これまでどおり開閉できます。
  - **記事ページでの見え方**：全カテゴリーが閉じた状態で記事を開くと、いま表示している記事の緑のしおりも、閉じたカテゴリーの中に隠れます。

- 修正対象
  - `src/components/Sidebar.vue`
