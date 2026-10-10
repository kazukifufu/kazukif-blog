---
title: "デザインの更新: コンテンツ表示領域を「リングノート風」デザインに変更"
date: "2026-10-07"
category: "web-dev"
---

- 背景

  このブログは「図書館」をテーマにしたデザイン(ウォールナット材のヘッダー・サイドバー、真鍮色のアクセント、紙色のコンテンツ領域)で運用しているが、コンテンツの表示領域を手書き感・ノート感を出したいと思い、**リングノート風**のデザインに更新しました。画像素材は使わず、CSSの疑似要素とグラデーションで表現しています。

- デザインの構成要素

  リングノートらしさを出すために、以下の3要素を組み合わせた。
  | 要素 | 役割 |
  | --- | --- |
  | 横罫線 | ノート用紙らしい、一定間隔の薄い線 |
  | 左の赤い余白線 | ノート特有の、本文エリアを区切る縦線 |
  | スパイラル製本の穴(リング) | 左端に並ぶ、パンチ穴のような円 |

- 実装：CSSのみで罫線・余白線・リング穴を描く
  - **横罫線：`repeating-linear-gradient`で縞模様を作る:**

     ```css
     .markdown-body {
       background-image: repeating-linear-gradient(
         to bottom,
         transparent 0,
         transparent 31px,
         rgba(107, 143, 165, 0.22) 32px
       );
       background-size: 100% 32px;
       background-position: 0 90px; /* タイトル行の下から罫線を開始 */
       background-repeat: repeat-y;
       line-height: 32px; /* 本文の行間を罫線の間隔に揃える */
     }
     ```

     罫線の間隔(32px)と本文の`line-height`を揃えることにより、テキストが罫線の上に乗って見える

  - **赤い余白線：`::after`疑似要素で1本引く:**

     ```css
     .markdown-body::after {
       content: '';
       position: absolute;
       top: 0;
       bottom: 0;
       left: 76px;
       width: 2px;
       background-color: rgba(196, 90, 90, 0.5);
     }
     ```

  - **リングの穴：`::before`疑似要素＋`radial-gradient`:**

     ```css
     .markdown-body::before {
       content: '';
       position: absolute;
       top: 28px;
       bottom: 28px;
       left: 30px;
       width: 18px;
       background-image: radial-gradient(
         circle,
         rgba(42, 33, 24, 0.28) 0 6px,
         transparent 7px
       );
       background-repeat: repeat-y;
       background-size: 18px 34px;
       background-position: center top;
     }
     ```

     `radial-gradient`で円を1つ定義し、`background-repeat: repeat-y`で縦方向に繰り返すことで、パンチ穴が連続しているように見せている

  - **全体の余白と浮き上がり感:**

     本文全体は、左側にリング＋赤線のぶんの余白を確保しつつ、周囲の紙色の背景から少し浮いて見えるよう`box-shadow`を付けている。

     ```css
     .markdown-body {
       position: relative;
       padding: 36px 40px 48px 104px;
       background-color: #faf7ee;
       border-radius: 4px;
       box-shadow: 0 8px 24px rgba(42, 33, 24, 0.18);
     }
     ```


- 左右の余白をなくす調整

  最初の実装では`.markdown-body`に`max-width: 760px; margin: 0 auto;`を指定し、記事を中央寄せの固定幅にしていた。しかし実際の画面で確認すると、サイドバーの濃い木目の背景と比べてリングノートのカードが小さく浮いて見えたため、左右の余白をなくす調整を行った。

  ```diff
   .markdown-body {
     position: relative;
  -  max-width: 760px;
  -  margin: 0 auto;
     padding: 36px 40px 48px 104px;
  ```

  `max-width`と`margin: 0 auto`を削除し、親要素(`content-area`)の幅いっぱいに広げることで、ページ全体に対してノートがもっと大きく、存在感のある見た目になった。
