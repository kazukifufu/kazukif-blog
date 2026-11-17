---
title: "[Trilium] 退避したWALから、未反映の変更を復元する(Docker版Trilium Notes)"
date: "2026-11-17"
category: "infra_howto"
---

[前回の記事](https://kazukif-blog.pages.dev/posts/infra/trilium-docker-setup-screen-recovery/)では、Docker版のTriliumが強制再起動後に言語設定画面になった問題を、WAL・SHMファイルの退避で復旧した。ただし、WAL（`document.db-wal`）には、「コミット済みだが、まだ本体に反映されていない変更」が残っていた可能性がある。退避したWALを`.bak`として残している場合に、そこから変更を取り戻す方法をまとめる。

> ⚠️ この記事の手順は、SQLiteの公式ドキュメントの説明に基づいている。元のファイルには触らず、必ずコピーしたファイルで作業すること。

- 前提：対になるファイルが必要

  WALは、「その時点の本体のファイル」に対する差分である。SQLiteの公式ドキュメント（How To Corrupt An SQLite Database File）では、次のように説明されている。

  - クラッシュ後に、WALなどのジャーナルファイルを移動・削除・改名すると、自動回復が働かず、データベースが壊れるおそれがある
  - 本体とWALは、対にして扱う必要がある。本体だけをコピーする、別の本体にWALを組み合わせる、といった操作は、破損の原因になる

  起動後にTriliumが本体を書き換えていれば、古いWALとは組み合わなくなる。そのまま適用すると、古い内容でページが上書きされ、破損の原因になる。そのため、手元にあるファイルによって、この方法が使えるかどうかが決まる。

  | 手元にあるもの | 使えるか |
  | --- | --- |
  | 退避前に、停止した状態でコピーした`document.db`・`document.db-wal`の一式 | ◎ 対になっているので使える |
  | 稼働中にコピーした`document.db.bak`と、`document.db-wal.bak` | △ 対になっている可能性はあるが、保証はない。コピー上で試して、結果を検証する |
  | 現在稼働中の`document.db`と、`document.db-wal.bak` | × 使わない。起動後に本体が変わっている可能性が高く、組み合わせが合わない |

- 復元の手順

  すべて、コピーしたファイルを使って、別のディレクトリで行う。

  1. **作業用のディレクトリに、対になるファイルをコピーする:**

     ```bash
     mkdir ~/trilium-recover && cd ~/trilium-recover
     cp -a /path/to/backup/document.db .
     cp -a /path/to/trilium-data/document.db-wal.bak ./document.db-wal
     ```

     WALのファイル名は、本体の名前に`-wal`を付けた`document.db-wal`でなければ、SQLiteに認識されない。`.bak`を外して、コピーする。`-shm`は、起動時に作り直されるので、コピーしなくてよい。

  2. **WALに中身があるか確認する:**

     ```bash
     ls -l document.db-wal
     ```

     サイズが0（またはヘッダーだけの32バイト）なら、取り戻せる変更はほぼない。ここで中止して、`backup/`の自動バックアップからの復元を検討する。

  3. **WALの内容を本体に取り込み、整合性を確認する:** Checkpoint

     ```bash
     sqlite3 document.db "PRAGMA wal_checkpoint(TRUNCATE);"
     sqlite3 document.db "PRAGMA integrity_check;"
     ```

     1行目で、WALの内容が`document.db`に書き込まれる。2行目が`ok`なら、整合性は取れている。`ok`以外の場合は、この組み合わせは使えない。`sqlite3`が入っていない場合は、`sudo apt install sqlite3`でインストールする。

  4. **取り戻したい変更が入っているか確認する:**

     ```bash
     sqlite3 document.db "SELECT noteId, title, utcDateModified FROM notes ORDER BY utcDateModified DESC LIMIT 10;"
     ```

     直前に編集したノートが出てくれば、回復できている。カラム名は、Triliumのバージョンで変わる可能性がある。エラーが出た場合は、`sqlite3 document.db ".schema notes"`で確認する。

  5. **取り戻した変更を、稼働中のデータに戻す:**

     状況によって、方法が変わる。

     | 状況 | 方法 |
     | --- | --- |
     | 復旧後に、新しい編集をしていない | 下の手順で、`document.db`を入れ替える |
     | 復旧後に、新しい編集をしてしまった | 上書きすると、新しい編集が消える。次の「編集済みの場合」の方法を使う |

     復旧後に新しい編集をしていない場合は、コンテナを停止し、稼働中のファイルを別名で退避してから、手順3の`document.db`をコピーする。

     ```bash
     cd /path/to/trilium-data      # docker-compose.ymlのあるディレクトリ
     docker compose stop
     mkdir before-restore
     mv document.db before-restore/
     mv document.db-wal before-restore/    # 存在する場合
     mv document.db-shm before-restore/    # 存在する場合
     cp ~/trilium-recover/document.db .
     docker compose up -d
     ```

     コピーした`document.db`は、`before-restore/document.db`と同じ所有者・権限にして、コンテナから書き込めるようにする。所有者は`ls -l before-restore/document.db`で確認できる。

- 編集済みの場合：一時的なTriliumで書き出す

  復旧後にすでに新しい編集をしている場合は、本体を入れ替えられない。この場合は、手順3の`document.db`を入れた**一時的なTrilium**を別のポートで起動し、必要なノートだけを書き出して、稼働中のTriliumに取り込む。

  1. **一時的なデータディレクトリを作る:**

     手順3の`document.db`と、`config.ini`のコピーを、新しいディレクトリに入れる。

  2. **一時的なTriliumを起動する:**

     `docker-compose.yml`を別名でコピーし、**ポート番号**、**データのパス**、`container_name`を指定している場合は**その名前**を書き換える。名前が重なると、稼働中のコンテナと衝突する。

     ```bash
     docker compose -f docker-compose-recover.yml up -d
     ```

  3. **必要なノートを書き出す:**

     一時的なTriliumに、書き換えたポートでアクセスし、取り戻したいノートを見つけて、エクスポート機能で書き出す。

  4. **稼働中のTriliumに取り込む:**

     稼働中のTriliumで、インポート機能を使って、書き出したノートを取り込む。

  5. **一時的なTriliumを停止する:**

     ```bash
     docker compose -f docker-compose-recover.yml down
     ```

  > ⚠️ データベースをSQLで直接マージすることは、勧めない。ノート、ブランチ、同期用の変更履歴が互いに結びついているため、一部だけを移すと、整合性が崩れるおそれがある。また、同じデータディレクトリを、2つのTriliumから同時に使ってはならない。

- うまくいかない場合

  手順3の整合性確認が`ok`にならない場合や、WALが空だった場合は、深追いしない。次のどちらかを検討する。

  - Triliumの自動バックアップ（`backup/`）から復元する。手順は、[前回の記事](https://kazukif-blog.pages.dev/posts/infra/trilium-docker-setup-screen-recovery/)の「バックアップから復元する場合」にまとめている
  - 復元できなかった場合でも、`.bak`のファイルは、すべてそのまま残しておく。あとから別の方法を試せる

- まとめ

  退避したWALから変更を取り戻せるかどうかは、**WALと対になる本体のファイルが手元にあるか**で決まる。

  - 生きているファイルには触らず、コピーした一式で、別のディレクトリで作業する
  - `PRAGMA wal_checkpoint(TRUNCATE);`でWALを本体に取り込み、`PRAGMA integrity_check;`で確認する
  - 復旧後に新しい編集をしていなければ、本体を入れ替える。編集済みなら、一時的なTriliumを経由して、ノート単位で書き出して取り込む

  そもそも、WALを退避する前に、停止した状態で`document.db*`の一式をバックアップしておけば、この手順を使える。