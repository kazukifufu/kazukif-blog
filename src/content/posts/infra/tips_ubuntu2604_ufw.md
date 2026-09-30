---
title: "Ubuntu 26.04 LTS Tips ファイアウォール(UFW)のログ確認方法とポート開放・削除方法"
date: "2026-09-29"
category: "infra"
---

- UFWログの確認方法と保存場所
  UFWがパケットを許可（ALLOW）または拒否（BLOCK）した際の情報は、システムログとして記録される。

  - **ログファイルの場所を確認する:**

     | ログファイル | 説明 |
     | --- | --- |
     | `/var/log/ufw.log` | UFW専用のログファイル（※rsyslog設定による） |
     | `/var/log/syslog` | システム全体のログ。UFW関連のログもここに含まれることが多い |

  - **ログを確認するコマンド:**

     | コマンド | 用途 |
     | --- | --- |
     | `sudo less /var/log/ufw.log` | ファイル全体をページ送りしながら確認する |
     | `sudo tail -f /var/log/ufw.log` | 最新のログをリアルタイムで監視する |
     | `sudo grep -i ufw /var/log/syslog` | `/var/log/syslog`からUFW関連の行だけを抽出する |

     ログが記録されていない場合は、以下でロギング機能を有効にする。

     ```bash
     sudo ufw logging on
     ```

     現在のロギング状態は以下で確認できる。

     ```bash
     sudo ufw status verbose
     ```


- ログメッセージからポート番号を確認する
  UFWのログは、実際にはiptablesのカーネルログとして記録されるため詳細なパケット情報を含んでおり、ポート番号は`DPT`と`SPT`というフィールドで確認できる。

  | フィールド名 | 意味 |
  | --- | --- |
  | `DPT` | Destination Port（宛先ポート番号）。サーバー側のポート。どのサービス宛に通信が来たかを示す（例: 22, 80, 443） |
  | `SPT` | Source Port（送信元ポート番号）。クライアント側のポート |
  | `PROTO` | 使用されたプロトコル。`TCP`または`UDP`など |

  以下のログは、SSH（22番ポート）へのアクセスがブロックされたことを示している。

  ```text
  ... [UFW BLOCK] ... PROTO=TCP SPT=54321 DPT=22 ...
  ```

  - `[UFW BLOCK]`：UFWによって通信が拒否された
  - `DPT=22`：宛先ポートは22番（SSH）


- UFWのルール管理：ポートの開放と削除
  ポートを開放する手順と、設定を誤ったポートを削除する手順を解説する。

  - **ポート（8503番）を開放する:**
    プロトコル（TCPまたはUDP）を指定して`allow`ルールを追加する。

    | プロトコル | コマンド |
    | --- | --- |
    | TCPの場合 | `sudo ufw allow 8503/tcp` |
    | UDPの場合 | `sudo ufw allow 8503/udp` |

  - **ポート（8503番）を拒否する:**
    プロトコル（TCPまたはUDP）を指定して`deny`ルールを追加する。

    | プロトコル | コマンド |
    | --- | --- |
    | TCPの場合 | `sudo ufw deny 8503/tcp` |
    | UDPの場合 | `sudo ufw deny 8503/udp` |

  - **設定を誤ったポートを削除する（方法1）:**
    追加したルールと完全に一致する`delete`コマンドを実行する。

    ```bash
    # 例: 8503/tcp のルールを削除する場合
    sudo ufw delete allow 8503/tcp
    ```

  3. **設定を誤ったポートを削除する（方法2・推奨）:**
    番号を指定して削除する方法が最も確実で推奨される。

    まずルール一覧と番号を確認する。

    ```bash
    sudo ufw status numbered
    ```

    出力例：

    ```text
    Status: active

        To                         Action      From
        --                         ------      ----
    [ 1] 22/tcp                     ALLOW IN    Anywhere
    [ 2] 8503/tcp                   ALLOW IN    Anywhere
    ```

    削除したいルール番号（例: `[ 2]`の`8503/tcp`を削除する場合）を指定して`delete`コマンドを実行する。

    ```bash
    # 例: 2番のルールを削除
    sudo ufw delete 2
    ```

    実行後、確認メッセージが表示されるので「y」を入力して確定する。

  - **設定の確認:**
    開放・削除のいずれの操作を行った場合でも、必ず以下のコマンドで最終的な設定を確認する。

    ```bash
    sudo ufw status verbose
    ```

    `8503/tcp`がリストから消えていれば、削除は成功である。