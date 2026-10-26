---
title: "運用記録: sharp(librsvg依存)の脆弱性(GHSA-wq5f-xc86-pv6w)への対応"
date: "2026-10-26"
category: "web-dev"
---

- 事象

  GitHubのDependabotアラートに、以下の通知が追加されていることを確認した。

    ```
    sharp : Vulnerability in librsvg dependency CVE-2026-96889 #13
    On sharp (npm) package-lock.json
    ```

  アラート画面には、更新先を示す以下の案内と、「Create Dependabot security update」のボタンが表示されていた。

    ```
    Upgrade sharp to version 0.35.5 or later.
    ```

    `sharp`は、Astroの画像最適化機能(`astro:assets`)が内部で使っている画像処理ライブラリである。最初に対応した[AstroのAVIF画像最適化に起因するRCE脆弱性](https://kazukif-blog.pages.dev/posts/web-dev/operation_log_20260916/)も、この`sharp`が内部で使うライブラリ(`libheif`)の問題だった。今回は同じ`sharp`の、SVG画像を扱う`librsvg`の問題である。

- 脆弱性の確認

    | 項目 | 内容 |
    | --- | --- |
    | 脆弱性ID | CVE-2026-96889(GHSA-wq5f-xc86-pv6w) |
    | 重大度 | High(CVSS v4で8.9) |
    | 弱点の分類 | CWE-416(解放済みメモリの使用：use-after-free) |
    | 対象パッケージ | `sharp`(Node.jsの画像処理ライブラリ) |
    | 影響を受けるバージョン | `0.35.5`未満 |
    | 修正バージョン | `0.35.5`(同梱の`librsvg`が`2.63.2`に更新される) |
    | 混入経路 | `astro`の依存として導入されていると考えられる(`npm ls sharp`で確認する) |
    | 公開日 | 2026-10-06 |

    `sharp`が画像のデコードに使う`librsvg`(SVG画像を読み込むライブラリ)に、メモリ管理の不具合がある。細工されたSVG画像を`sharp`にデコードさせると、特定の実行環境の条件下で、任意のコードを実行されるおそれがある。対象は、glibcを使うLinux環境とされている。

    更新できない場合の回避策として、アドバイザリには、SVGのデコードを禁止する以下のコードも示されている。今回は修正版があるため、使わない。

    ```
    sharp.block({ operation: ["VipsForeignLoadSvg"] });
    ```

- 自サイトでのリスク評価

    攻撃が成立するには、**攻撃者が細工したSVG画像を、`sharp`にデコードさせる**必要がある。

    自サイトの実装を確認すると、

    - 画像はすべて自分で用意した、信頼できるファイル(`src/assets/`配下からの`import`)である
    - ユーザーによる画像のアップロードや、外部のURLの画像を処理する機能はない
    - 画像処理は、公開後のサーバーではなく、ビルド時にローカルの環境とCloudflare Pagesのビルド環境で行うだけである

    という状態だった。つまり、細工された画像を処理させる経路が存在しないため、実害のリスクは低いと判断した。ただし、重大度が高く、修正版も公開されているため、通常のメンテナンス作業として更新することにした。

- 対応方法の選択

    修正版が公開されているため、更新で対応する。方法は、これまでと同様に2つある。

    | 方法 | 内容 |
    | --- | --- |
    | A. Dependabotのボタンを使う | アラート画面の「Create Dependabot security update」から、更新用のプルリクエストを自動生成する |
    | B. 手元で更新する | `npm update sharp`を実行する |

    `sharp`は`package.json`に直接書いていないと考えられる依存のため、バージョンを直接指定する`npm install sharp@latest`ではなく、`npm update`を使う。`astro`が許容する範囲内で、最新版に引き上げてくれる。

    ```
    npm update sharp
    ```

- 更新後の確認

    - 依存パッケージとの整合性確認

    ```
    npm ls sharp
    ```

    `sharp`が`0.35.5`以上になっていること、`invalid`や`UNMET PEER DEPENDENCY`のような警告が出ていないことを確認する。

    -  ビルドの確認

    ```
    npm run build
    ```

    ビルドが通ることを確認する。`sharp`は画像を実際に処理するライブラリのため、あわせて`npm run preview`で、`UserProfile.astro`のアバター画像など、`astro:assets`を使っている画像の表示が崩れていないことも確認する。

- 今後の運用方針

    `astro`のビルドツールチェーンに関する脆弱性対応は、Astro本体に続いて、SVGO、devalue、undici、http-cache-semantics、そして今回のsharpと続いている。このうち、修正版がなかったのはhttp-cache-semanticsだけで、それ以外は更新で対応できた。

    画像処理ライブラリは、ネイティブのライブラリを同梱しているため、今後も同様の通知が出やすい領域だと考えられる。引き続き、リスク評価(自サイトがその攻撃経路を実際に持っているか)→更新(修正版がある場合)→`npm ls`/`npm run build`での確認、という運用を継続する。