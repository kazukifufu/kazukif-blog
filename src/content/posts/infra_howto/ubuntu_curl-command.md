---
title: "curlコマンドの主要オプション(Ubuntu 26.04 LTS)"
date: "2026-10-31"
category: "infra_howto"
---

- 背景

  `curl`コマンドは、さまざまなプロトコルでデータを送受信するための必須ツールである。APIのテストやWebのデバッグで、特に役立つオプションをまとめる。サーバー内で開いているポートの確認方法は、[Ubuntu 26.04 LTSで開いているポートを確認する方法](https://kazukif-blog.pages.dev/posts/infra/ubuntu2604-open-ports/)で扱っている。

  Ubuntu 26.04 LTSでは、`sudo`がRust製の`sudo-rs`に、`coreutils`もRust製のものに置き換わっているが、`curl`は置き換えの対象とは別のパッケージであり、基本的な使い方は24.04と同じである。`curl`が入っていない環境では、`sudo apt install curl`でインストールする。

- curlの主要オプション

  - **デバッグと出力系:**

     | オプション | 機能 | 例 |
     | --- | --- | --- |
     | `-i` | レスポンスの**ヘッダーとボディの両方**を表示する | `curl -i https://example.com` |
     | `-I` | レスポンスの**ヘッダーのみ**を取得する（HEADリクエスト） | `curl -I https://example.com` |
     | `-v` | リクエスト・レスポンスの**詳細ログ（冗長出力）**を表示する。デバッグに必須 | `curl -v https://api.example.com` |
     | `-s` | 進行状況メーターなど、余計な出力を非表示にする。エラーメッセージも隠れるため、`-sS`でエラーだけを表示する書き方が便利 | `curl -sS https://example.com` |
     | `-L` | サーバーからのリダイレクトを**自動で追跡**する | `curl -L http://shorturl.com` |

  - **リクエストのカスタマイズ系:**

     | オプション | 機能 | 例 |
     | --- | --- | --- |
     | `-X` | 使用する**HTTPメソッド**を指定する（POST, PUT, DELETEなど） | `curl -X DELETE https://api.com/data/1` |
     | `-H` | **HTTPヘッダー**を追加・変更する。API認証で多用する | `curl -H "Authorization: Bearer <TOKEN>" URL` |
     | `-d` | POSTなどで**データを送信**する。フォームデータ向け。`-d`を使うと、`-X POST`を付けなくてもPOSTになる | `curl -d "user=test&pass=123" URL` |

  - **ファイル操作系:**

     | オプション | 機能 | 例 |
     | --- | --- | --- |
     | `-o` | 取得したデータを**指定したファイル名で保存**する | `curl -o image.jpg https://example.com/img.jpg` |
     | `-O` | 取得したデータを**URLのファイル名でそのまま保存**する | `curl -O https://example.com/data.zip` |


- POSTリクエスト（JSON送信）の実例

  APIにJSONデータを送信する際の、最も一般的な使い方である。

  ```bash
  curl -H "Content-Type: application/json" \
       -d '{"id": 101, "name": "Taro"}' \
       https://api.example.com/users
  ```

  - **`-H "Content-Type: application/json"`**：送信するデータの形式をJSONと宣言する
  - **`-d '...'`**：送信するJSONデータを指定する。`-d`を使うためPOSTになり、`-X POST`は省略できる

  curl 7.82.0以降では、`--json`を使うと、より短く書ける。`curl --version`で、使っているバージョンを確認できる。

  ```bash
  curl --json '{"id": 101, "name": "Taro"}' https://api.example.com/users
  ```

  `--json`は、`Content-Type: application/json`と`Accept: application/json`のヘッダーの付与と、POSTでの送信を、1つのオプションにまとめたものである。

- パスワードやトークンをコマンドに直接書かない

  `-d "user=test&pass=123"`のように、パスワードをコマンドラインに直接書くと、シェルの履歴（`~/.bash_history`）や、`ps`コマンドの出力に残ってしまう。機密性のある値は、ファイルや標準入力から読み込む。

  ```bash
  # ファイルから読み込む
  curl -d @data.json https://api.example.com/users

  # 標準入力から読み込む
  cat data.json | curl -d @- https://api.example.com/users
  ```