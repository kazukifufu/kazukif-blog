---
title: "運用記録: Astroの推移的依存undiciに起因するDoS脆弱性(GHSA-3wwx-pv8p-q78v)への対応"
date: "2026-10-01"
category: "web-dev"
---

### 事象

GitHubのDependabotアラートに以下の通知が追加されていることを確認した。

```
undici vulnerable to Denial of Service via unhandled error in WebSocket permessage-deflate decompression #8
On undici (npm) package-lock.json
```

アラート画面下部には以下の表示があった。

```
Transitive dependency undici 8.10.0 is introduced via
astro 7.3.2 › ... › undici 8.10.0
```

`svgo`・`devalue`と同様、`astro`本体経由の推移的依存であることを確認した。

### 脆弱性の確認

| 項目 | 内容 |
| --- | --- |
| 脆弱性ID | GHSA-3wwx-pv8p-q78v(CVE-2026-85024) |
| 重大度 | Medium(CVSS 5.9) |
| 対象パッケージ | `undici`(Node.js標準の高性能HTTP/WebSocketクライアントライブラリ) |
| 影響を受けるバージョン | `8.1.0`以上`8.10.2`未満 |
| 修正バージョン | `8.10.2`以降 |
| 混入経路 | `astro 7.3.2` → (中間の依存を経由) → `undici 8.10.0` |

`undici`のWebSocketクライアント実装(`lib/web/websocket/permessage-deflate.js`)の不具合。`permessage-deflate`という圧縮拡張を使ったWebSocket通信で、展開後のデータサイズが上限(128MiB)を超えた際の後処理が、内部のzlib展開ストリームから**エラーリスナーごと**`removeAllListeners()`で削除してしまうが、ストリーム自体は動作し続ける。その状態で不正な形式のDEFLATEデータを受け取ると、リスナーのないエラー(`Z_DATA_ERROR`)が発生し、Node.jsがこれを未処理の致命的エラーとみなしてプロセス全体を強制終了させる。悪意のあるWebSocketサーバーに接続した場合、約130KB程度のデータでこのクラッシュを引き起こせるとされている。

### 自サイトでのリスク評価

この脆弱性は、`undici`の**WebSocketクライアント**(＝自分から他のサーバーへWebSocket接続をしにいく側)の不具合である。他プロジェクトの修正報告にも、影響を受けるのは`undici`のWebSocketクライアント(`new WebSocket(...)`)を使い、攻撃者が制御する、または侵害されたWebSocketエンドポイントへ接続させられうるアプリケーションである、と明記されていた。

自サイトの実装を確認すると、

- `output: 'static'`の完全な静的サイトであり、ビルド後に動作するサーバーサイドのランタイムが存在しない
- サイトのコード内で`new WebSocket(...)`のような、外部のWebSocketサーバーへ自ら接続する処理を一切実装していない
- `undici`は`astro`のビルドツール内部(fetch処理など)で使われているだけで、任意の外部WebSocketサーバーに接続する用途では使われていない

という状態だった。つまり、このサイトが「悪意のあるWebSocketサーバーへ接続する」という攻撃の前提条件を満たす経路がそもそも存在しないため、実害のリスクは低いと判断した。ただし、推移的依存であっても放置する理由にはならないため、通常のメンテナンス作業として更新することにした。

### 対応方法の選択

`undici`も`svgo`・`devalue`と同じく`package.json`に直接書かれていない推移的依存のため、`npm install undici@latest`ではなく`npm update`で対応した。

```
npm update undici
```

### 更新後の確認

#### 依存パッケージとの整合性確認

```
npm ls undici
```

`invalid`や`UNMET PEER DEPENDENCY`のような警告が出ないことを確認した。

#### ビルドの確認

```
npm run build
```

問題なく通ることを確認した。

### 今後の運用方針

Astro本体(直接依存)に続き、SVGO・devalue・undiciと、これで推移的依存の脆弱性対応が3件連続となった。`astro`のビルドツールチェーンには多数の依存パッケージが連なっており、今後も同様の通知が定期的に発生するものと想定される。引き続き、リスク評価(自サイトがその攻撃経路を持っているか)→直接依存は`install`・推移的依存は`update`→`npm ls`/`npm run build`での確認、という運用を継続する。