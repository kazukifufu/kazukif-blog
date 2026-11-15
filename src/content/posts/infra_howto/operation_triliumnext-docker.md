---
title: "[Trilium] Docker版Trilium Notesが強制再起動後に言語設定画面になった場合の復旧手順(Ubuntu 26.04 LTS)"
date: "2026-11-16"
category: "infra_howto"
---

Ubuntu 26.04環境でDocker版のTrilium Notesを運用している最中にOSがハングし、強制的に再起動した。その後、Trilium(v0.107.0)にアクセスすると、既存のノートが読み込まれず、初回起動時のような「言語設定(初期セットアップ)画面」が表示された。復旧した時の流れを備忘録としてまとめる。

なお、この現象はUbuntu 26.04に固有のものではなく、DockerとSQLiteの組み合わせで起こりうるものである。

- 発生した現象

  Docker Composeで運用しているTriliumにアクセスすると、既存のノートデータが読み込まれず、初期セットアップの画面が表示された。ホスト側のデータディレクトリを確認すると、メインのデータベースファイルである`document.db`(数百MB)は存在していた。

  > ⚠️ 初期セットアップの画面では、操作を進めない。既存のデータに影響が出るおそれがあるため、先に原因を調べる。

- 原因(推定)

  OSの強制終了によって、SQLiteの**WAL(Write-Ahead Log)ファイル**(`document.db-wal`)や**共有メモリファイル**(`document.db-shm`)が不整合な状態で残り、Triliumがデータベースを正しく認識できなかったと推定している。

  それぞれのファイルの役割は次のとおり。

  | ファイル | 役割 |
  | --- | --- |
  | `document.db` | 本体のデータベース |
  | `document.db-wal` | **コミット済みだが、まだ本体に反映されていない変更**を記録するジャーナル |
  | `document.db-shm` | WALの索引として使う一時的なファイル。クラッシュ後に残す必要はなく、消しても問題ない |

  ただし、SQLiteは通常、クラッシュ後の次回オープン時に、WALから自動で回復する仕組みを持っている。今回は、WALとSHMを退避したところ復旧したが、直った理由を断定することはできない。原因を調べる手がかりとして、復旧の前に、次の2つを記録しておくとよい。

  - 最初に失敗した起動のログ
  - `ls -l document.db*`の出力(WAL・SHMのサイズ、所有者、更新日時)

- 復旧前に確認すること

  1. **データディレクトリのファイルを確認する:** Files

     ```bash
     cd /path/to/your/trilium-data
     ls -l document.db*
     ```

  2. **Triliumの自動バックアップがあるか確認する:** Backup

     Triliumは、日次・週次・月次、およびデータベースの移行前に、自動でバックアップを`backup/`ディレクトリに保存する。

     ```bash
     ls -l backup/
     ```

     `backup-daily.db`などがあれば、最悪の場合でも、その時点までは戻せる。

  3. **起動ログを保存する:** Log

     ```bash
     docker compose logs --tail=200 > ~/trilium-first-start.log
     ```

- 復旧手順

  1. **コンテナを停止する:** Stop

     データベースファイルへのアクセスを止めるため、最初にコンテナを停止する。

     ```bash
     docker compose stop
     ```

  2. **すべてのファイルをバックアップする:** Backup

     コンテナを停止した状態で、データベースと設定ファイルをコピーする。WALとSHMも一緒にコピーするため、`document.db*`と書く。

     ```bash
     cp -a document.db* config.ini /path/to/backup/
     ```

     > コンテナの稼働中にコピーすると、書き込み中の中途半端な状態で保存されるおそれがある。また、`document.db`だけをコピーしても、WALにある未反映の変更は含まれない。

  3. **データベースの整合性を確認する:** Verify

     WALを退避する前に、WALを生かしたまま、データベースの状態を確認する。

     ```bash
     sudo apt install sqlite3    # 入っていない場合
     sqlite3 document.db "PRAGMA integrity_check;"
     ```

     開く時点でWALの内容が本体に取り込まれ、`ok`と表示されれば、データベース自体は健全である。`sudo`を付けて実行した場合は、WAL・SHMの所有者がrootになることがあるため、実行後に`ls -l document.db*`で所有者を確認する。コンテナから書き込めなくなる場合がある。

  4. **WAL・SHMを退避する(起動しない場合のみ):** Move

     手順3のあとでも起動しない場合に、WALとSHMを別名にして退避する。削除はせず、`.bak`を付けて残す。

     ```bash
     mv document.db-wal document.db-wal.bak
     mv document.db-shm document.db-shm.bak
     ```

     > ⚠️ WALを退避すると、WALに残っていた「本体に未反映の最近の変更」を失う可能性がある。`.bak`は、復旧を確認できるまで残しておく。所有者がrootのファイルで権限エラーが出る場合は、`sudo`を付けて実行する。

     今回は、この手順4でWALとSHMを退避したところ、復旧した。

  5. **コンテナを起動する:** Start

     ```bash
     docker compose up -d
     ```

  6. **ログを確認する:** Logs

     ```bash
     docker compose logs --tail=100 -f
     ```

     以下のように、ノート数やテーブルカウントが正しく表示され、整合性チェックにエラーがなければ、起動は成功である。

     ```text
     trilium  | 💾 DB size:    753.9 MiB
     trilium  | Table counts: notes: 1820, revisions: 110, attachments: 7801, ...
     trilium  | All consistency checks passed with no errors detected
     ```

  7. **最近の編集が残っているか確認する:** Content

     ブラウザでTriliumを開き、**直前に編集したノートの内容**が残っているかを確認する。失われていた場合は、`.bak`にしたWALや、`backup/`の自動バックアップから回復できるか検討する。

- バックアップから復元する場合

  データベースが壊れていて起動しない場合は、自動バックアップから復元する。この手順では、`document.db`を別のファイルに**入れ替える**ため、`-wal`と`-shm`も取り除く必要がある。本体を置き換えずにWALだけを退避する、前述の手順4とは状況が異なる。

  ```bash
  docker compose stop
  mv document.db document.db.broken
  mv document.db-wal document.db-wal.broken   # 存在する場合
  mv document.db-shm document.db-shm.broken   # 存在する場合
  cp backup/backup-daily.db document.db
  docker compose up -d
  ```

  コピーした`document.db`は、元のファイルと同じ所有者・権限にして、コンテナから書き込めるようにする。

- 今後の対策

  1. **データディレクトリ全体を定期的にバックアップする:** Backup

     Triliumは、データディレクトリ(`document.db`、`config.ini`、`backup/`、`log/`)に必要なものがまとまっている。稼働中にコピーする場合は、コピーではなく、SQLiteの`.backup`コマンドを使うと、整合性のあるコピーを取れる。

     ```bash
     sqlite3 document.db ".backup '/path/to/backup/document-$(date +%F).db'"
     ```

  2. **ハングの原因を調べる:** Cause

     今回の問題の発端は、OSのハングである。ジャーナルが永続化されていれば、再起動後に、直前の起動のログを確認できる。

     ```bash
     journalctl -b -1
     ```

- まとめ

  OSの強制終了やハングアップの後は、SQLiteを使うアプリケーションで、WAL・SHMファイルが原因となる不具合が起こりうる。今回は、データディレクトリをホスト側にバインドマウントしていたため、WALとSHMを退避するだけで、元のデータを保持したまま復旧できた。

  同じ状況になった場合は、設定画面を進めず、まずコンテナを停止してすべてのファイルをバックアップし、WALを生かしたまま整合性を確認することを勧める。WALの退避は、その後の最終手段である。