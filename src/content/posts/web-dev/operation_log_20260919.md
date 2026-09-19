---
title: "運用記録: Astroの推移的依存devalueに起因するDoS脆弱性(GHSA-9rgm-9g3h-6x36)への対応"
date: "2026-09-18"
category: "web-dev"
---

### 事象

2026-09-18に、GitHubのDependabotアラートに以下の通知が追加されていることを確認した。

```
Svelte devalue: DoS via malformed input #7
On devalue (npm) package-lock.json
```

`package.json`に`devalue`という依存を直接書いた記憶はなかったが、アラート画面の下部に以下の表示があった。

```
Transitive dependency devalue 5.9.0 is introduced via
astro 7.3.2 › devalue 5.9.0
```

`astro`本体経由の推移的依存であることを確認した。


### 脆弱性の確認

| 項目 | 内容 |
| --- | --- |
| 脆弱性ID | GHSA-9rgm-9g3h-6x36（CVE-2026-81176） |
| 重大度 | Medium（CVSS 5.3） |
| 対象パッケージ | `devalue`（JavaScriptの値を文字列にシリアライズ/デシリアライズするライブラリ） |
| 影響を受けるバージョン | `5.9.2`未満 |
| 修正バージョン | `5.9.2`以降 |
| 混入経路 | `astro 7.3.2` → `devalue 5.9.0` |

`devalue.parse`が、範囲外の配列インデックスを含む不正なデータを適切に拒否できていないという不具合。悪意を持って作られたペイロードによって配列の内部表現を意図的に切り替えさせられ、その結果、処理量がペイロードサイズに対して**二次関数的（quadratic）**に増大する。`devalue.parse`に信頼できないデータを渡すアプリケーションでは、サービス拒否（DoS）攻撃が成立する可能性がある。


### 自サイトでのリスク評価

`devalue`という名前には見覚えがあった。プロフィール画面のサイドバー実装で、AstroからVueアイランド（`Sidebar.vue`）へpropsを渡す際に`Date`型をJSONシリアライズできないため`.toISOString()`で文字列に変換する、という対応を行ったことがあったが、Astroが内部的にアイランドへpropsを橋渡しする際のシリアライズ処理に使っているのが、まさにこの`devalue`だった。

今回の脆弱性の説明文には、以下の一文があった。

> Applications are potentially affected if they call devalue.parse with untrusted data.
> （`devalue.parse`に信頼できないデータを渡すアプリケーションが影響を受ける可能性がある）

自サイトの実装を確認すると、

- `output: 'static'`で運用しており、リクエストごとに任意のデータを受け取って処理するサーバーサイド処理（APIルートなど）が存在しない
- `Sidebar.vue`へ渡すpropsは、ビルド時に`getCollection('posts')`で取得した自サイトのContent Collectionsのデータであり、外部から送信された任意の入力ではない

という状態だった。つまり、**攻撃者が任意の不正なペイロードを`devalue.parse`に渡す経路そのものが存在しない**ため、実害のリスクは低いと判断した。ただし、推移的依存であっても放置する理由にはならないため、通常のメンテナンス作業として更新することにした。


### 対応方法の選択

`devalue`は`package.json`に直接書かれていない推移的依存のため、`npm install devalue@latest`ではなく`npm update`で対応した。

```
npm update devalue
```

`svgo`のときと同様、`devalue`のバージョンは最終的に`astro`が許容する範囲内でしか意味を持たないため、依存元の制約を踏まえて更新してくれる`npm update`を選んでいる。


### 更新後の確認

#### 依存パッケージとの整合性確認

```
npm ls devalue
```

`invalid`や`UNMET PEER DEPENDENCY`のような警告が出ないことを確認した。

#### ビルドの確認

```
npm run build
```

Vueアイランド（`Sidebar.vue`）へのprops受け渡しを含むビルドパイプライン全体が問題なく通ることを確認した。


### 運用方針

Astro本体（直接依存）・SVGO・devalue（いずれも推移的依存）と、これで3件連続してAstro経由の依存関係にアラートが出たことになる。`astro`自体のアップデート頻度が高いフレームワークである以上、今後もこの種の通知は定期的に発生するものと想定し、これまでと同じ運用（リスク評価→直接依存は`install`・推移的依存は`update`→`npm ls`/`npm run build`での確認）を継続する。