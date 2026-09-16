---
title: "運用記録: AstroのAVIF画像最適化に起因するRCE脆弱性（GHSA-26w7-cxv4-gfx2）への対応"
date: "2026-09-16"
category: "web-dev"
---

### 事象

2026-09-15に、"Ubuntu 26.04 LTSの導入(その3) UEFIセキュアブートに関連する鍵の確認"のコンテンツをGitにpushした際に、以下のメッセージが表示された

```
remote: GitHub found 6 vulnerabilities on kazukifufu/kazukif-blog's default branch (1 critical, 3 high, 2 moderate). To find out more, visit:
remote:      https://github.com/kazukifufu/kazukif-blog/security/dependabot
```


### 脆弱性の確認

| 項目 | 内容 |
|---|---|
| 脆弱性ID | GHSA-26w7-cxv4-gfx2 |
| 重大度 | CRITICAL |
| 影響を受けるバージョン | Astro 7.2.8未満 |
| 修正バージョン | Astro 7.2.8以降（`sharp` 0.35.4が必要） |
| 原因 | Astroのデフォルト画像サービス（Sharp）が内部で使用する`libheif`の脆弱性 |

**悪意のあるAVIF画像をAstroに最適化処理させることで、リモートコード実行（RCE）が可能になる**というものです。
`astro:assets`はビルド時に画像のリサイズ・フォーマット変換を自動で行いますが、その処理の中核を担っているのがSharpというライブラリであり、Sharpがさらに内部で使っている`libheif`(AVIF/HEIF形式の画像を扱うライブラリ)に今回の問題がありました。

### 自サイトでのリスク評価

CRITICALという評価だけを見ると身構えてしまいますが、実際のリスクは「**攻撃者が任意のAVIF画像を処理させられる経路があるかどうか**」で変わります。今回のブログの実装を振り返ると、

- プロフィールアバターや記事内画像は、すべて自分で用意した信頼できる画像ファイルのみを`src/assets/`配下から`import`して扱っている
- ユーザーからの画像アップロード機能や、外部URLの画像を動的に最適化するような機能は実装していない

という状態でした。つまり、**外部の第三者が任意のAVIF画像をこのサイトに処理させる経路が存在しない**ため、緊急停止のような対応が必要な状況ではありません。とはいえ、CRITICAL評価の脆弱性をバージョンとして抱え続ける理由にはならないため、通常のメンテナンス作業として速やかに更新することにしました。

このように、脆弱性情報を受け取った際は「深刻度のラベルだけで判断せず、自分のサイトの実装がその攻撃経路を実際に持っているかどうか」を一度立ち止まって確認する、ことが大切になります。

### 対応方法の選択

Dependabotのアラート画面には、「Create Dependabot security update」というボタンが用意されていました。これをクリックすると、`astro`を修正済みバージョンへ更新するプルリクエストが自動生成されます。

手元で直接更新したい場合は、以下のコマンドでも同じ結果が得られます。

```bash
npm install astro@latest
```

どちらの方法でも、最終的に`package.json`と`package-lock.json`が更新される点は同じです。今回は手元での更新を選びました。

### `package.json`はどう変わるか

`npm create astro@latest`で作成したプロジェクトの`package.json`は、通常`astro`のバージョンをキャレット（`^`）付きで指定しています。

```json
{
  "dependencies": {
    "astro": "^7.0.6"
  }
}
```

`^7.0.6`は「7.0.6以上、8.0.0未満（メジャーバージョンが変わらない範囲）で最新版を使ってよい」という意味です。今回の修正版（`7.2.8`以降）はこの範囲に収まるため、`npm install astro@latest`を実行すると、

```json
{
  "dependencies": {
    "astro": "^7.3.2"
  }
}
```

のように、実際にインストールされたバージョンへ`package.json`の表記自体が自動的に更新されました。手動で数字を書き換える作業は不要で、`npm install`コマンドが依存関係の記述とロックファイルの更新をまとめて面倒を見てくれます。

### 更新後の確認

#### 依存パッケージとの整合性確認

`astro`本体だけでなく、`@astrojs/vue`のような統合パッケージにも、`astro`本体との対応バージョン範囲（`peerDependencies`）が設定されています。更新後は念のため以下で確認しました。

```bash
npm ls astro
```

`invalid`や`UNMET PEER DEPENDENCY`のような警告が出ないことを確認できれば、依存関係は健全です。

#### 他に保留中の更新がないかの確認

```bash
npm outdated
```

`Current`（現在のバージョン）・`Wanted`（`package.json`の範囲内で入れられる最新版）・`Latest`（絶対的な最新版）を一覧できるため、今回の`astro`以外にも更新すべきパッケージがないかを合わせて確認しました。

#### ビルド・表示の確認

```bash
npm run build
npm run preview
```

`sharp`のバージョンも連動して上がっているため、`UserProfile.astro`のアバター画像など、`astro:assets`を使っている箇所の見た目に変化がないかを念のため確認しました。画像処理ライブラリのバージョンアップでは、まれに出力される画像のフォーマットや圧縮率が微妙に変わることがあるためです。

### 今後の運用方針

今回の一件を踏まえ、今後は以下の方針で運用することにしました。

- GitHubリポジトリのDependabotアラート機能は有効にしたままにしておく
- CRITICAL・HIGHクラスの通知が来た場合は、リスク評価（自サイトがその攻撃経路を持っているか）を行った上で、速やかに`npm install <パッケージ名>@latest`または「Create Dependabot security update」ボタンで対応する
- 更新後は`npm ls`・`npm outdated`・`npm run build`のセットを毎回のルーティンとして実行する
