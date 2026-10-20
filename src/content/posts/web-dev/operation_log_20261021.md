---
title: "運用記録: Astroの依存http-cache-semanticsに起因する脆弱性(GHSA-ch52-4w7c-c8xp)と、修正版がない場合の対応"
date: "2026-10-21"
category: "web-dev"
---

- 事象

  GitHubのDependabotアラートに、以下の通知が追加されていることを確認した。

  ```
  http-cache-semantics max-stale handling can disclose cross-user cached responses #9
  On http-cache-semantics (npm) package-lock.json
  ```

  また、アラート画面には以下の表示があった。

  ```
  Transitive dependency http-cache-semantics 4.2.0 is introduced via
  astro 7.3.2 › http-cache-semantics 4.2.0
  ```

  `astro`本体経由の推移的依存であることは、これまでの`svgo`・`devalue`・`undici`と同じである。一方、今回はこれまでと異なる点が1つあった。`Patched version`(修正バージョン)が`None`と表示されており、更新先を示す「Upgrade ... to version ...」の案内も表示されていなかった。

-  脆弱性の確認

    | 項目 | 内容 |
    | --- | --- |
    | 脆弱性ID | CVE-2026-93748(GHSA-ch52-4w7c-c8xp) |
    | 重大度 | High(CVSS v4で8.7、v3.1で7.5) |
    | 弱点の分類 | CWE-524(機密情報を含むキャッシュの使用) |
    | 対象パッケージ | `http-cache-semantics`(HTTPレスポンスのキャッシュ可否や有効期限を判定するライブラリ) |
    | 影響を受けるバージョン | `4.2.0`以下 |
    | 修正バージョン | なし(調べた時点では、修正版の公開を確認できなかった) |
    | 混入経路 | `astro 7.3.2` → `http-cache-semantics 4.2.0` |
    | 公開日 | 2026-09-18 |

    - クライアントが`max-stale`というディレクティブを付けてリクエストしたとき、セキュリティ上の理由で中身を消去(ゼロ化)したキャッシュエントリの検証が不十分になっている。そのため、同じURLを大きな`max-stale`値で要求すると、他のユーザーの`Set-Cookie`(セッション情報)を、共有キャッシュから取得できてしまう。認証なしで悪用できるとされている。

    - 補足として、同じ`http-cache-semantics`の`4.2.0`以下を対象にした別のアドバイザリ(`Vary`ヘッダーのワイルドカードの扱いに関するもの。CWE-436、CVSS v4で8.2)も公開されている。今後、同じパッケージで別のアラートが追加される可能性がある。

    - 参照した情報は以下の通り。
      - [VulnCheck Advisory](https://www.vulncheck.com/advisories/http-cache-semantics-through-4.2.0-cross-user-cache-disclosure-via-max-stale)
      - [GitLab Advisory Database](https://advisories.gitlab.com/npm/http-cache-semantics/CVE-2026-93748/)


- 自サイトでのリスク評価

  この脆弱性が成り立つ前提は、説明文にある「shared-cache entries(共有キャッシュのエントリ)」、つまり**複数のユーザーのリクエストをさばく共有キャッシュ**として`http-cache-semantics`が使われている場合である。

  Astroのリポジトリのコードを確認したところ、Astroは`http-cache-semantics`を`astro:assets`のリモート画像のキャッシュ処理(`import CachePolicy from 'http-cache-semantics'`)で使っていた。これはビルド時にリモート画像を取得し、その有効期限などを、ビルドを実行するマシンのディスク(`node_modules/.astro`配下)に保存するための用途であり、複数の閲覧者のリクエストをさばく共有キャッシュではない。

  自サイトの実装を確認すると、
    - 画像はすべて`src/assets/`から`import`したローカル画像で、リモート画像は扱っていない
    - `astro.config.mjs`に、リモート画像を許可する設定(`image.domains` / `image.remotePatterns`)を書いていない
    - `output: 'static'`の静的サイトであり、公開後に動作するサーバー側の処理が存在しない

  という状態だった。つまり、攻撃者が他のユーザーのキャッシュを取り出すための経路がそもそも存在せず、ビルド時のリモート画像キャッシュの処理自体も使っていないため、実害のリスクは極めて低いと判断した。

-  対応方法の選択

    これまでの`svgo`・`devalue`・`undici`は、修正版が存在したので`npm update <パッケージ名>`で対応できた。今回は更新先の修正版がないため、コマンドによる更新では対応できない。また、npmの`overrides`で特定のバージョンに固定する方法も、固定先の修正版がないため選べない。

    残る選択肢は、アラートの扱いである。

      | 選択肢 | 内容 |
      | --- | --- |
      | A. アラートを開いたままにする | 修正版が公開されたら、Dependabotが更新用の案内を表示する状態に変わる。見張りを自動化できる |
      | B. アラートを却下(Dismiss)する | 理由に「Vulnerable code is not actually used」(脆弱なコードは実際には使われていない)を選べる。一覧はすっきりするが、修正版が出ても通知されなくなる |

    どちらを選んでもリスクの大きさは変わらない。今回は、修正版の公開を自動で知る手段を残せるため、**Aを採る方針とした**。

- 現状の確認

  修正版がないため、更新後の確認ではなく、現状を把握するための確認コマンドを整理しておく。

  - 現在のバージョンと混入経路の確認

  ```
  npm ls http-cache-semantics
  ```

  -  修正版が出たかどうかの確認

    ```
    npm audit
    ```

    `npm audit`は、GitHubのDependabotとは別に、npm側のアドバイザリ情報をもとに脆弱性を報告する。アラートを却下した場合でも修正版の公開を確認できるため、却下する場合の代替手段にもなる。

  - 今後の運用方針

    これまでの対応を、修正版の有無で整理すると以下のようになる。

      | | 修正版あり | 修正版なし |
      | --- | --- | --- |
      | 直接依存 | `npm install <パッケージ>@latest` | リスク評価の上、見張りを残す |
      | 推移的依存 | `npm update <パッケージ>` | リスク評価の上、見張りを残す(今回) |

    どちらの場合も、最初に行うのは「自サイトがその攻撃経路を実際に持っているか」の確認である。修正版がない場合は、更新ではなくこの評価が唯一の判断材料になる。

    今回のアラートは開いたままにし、`astro`を更新するタイミングや、定期的な`npm audit`の実行で、修正版が公開されたかを確認する。修正版が公開された時点で、`npm update http-cache-semantics`で更新する。また、前述の`Vary`ヘッダーに関する別アラートが追加された場合も、同じ考え方で扱う。