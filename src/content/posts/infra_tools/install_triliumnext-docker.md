---
title: "TriliumNextをDockerで動かす"
date: "2026-10-27"
dateRevised: "2026-10-29"
category: "infra_tools"
---

階層構造でノートを管理できるセルフホスト型ノートアプリ「TriliumNext」を、Raspberry Pi 4(4GB)上のDockerで動かす手順をまとめます。最終的に、LAN内のブラウザから `http://<ラズパイのIPアドレス>:12000` でノートを使える状態になります。

## 前提

- Raspberry Pi 4(4GB)で、OSは64bit版(Raspberry Pi OS 64bitなど)を使用します。arm64イメージを使うためです。`uname -m` で `aarch64` と表示されれば問題ありません。
- DockerとDocker Composeプラグインはインストール済みとします。
- この記事の構成は **LAN内での利用が前提**です。通信は暗号化されない HTTP で、同じLANの端末なら誰でもアクセスできます。

## データ用ディレクトリの作成

ノートのデータを保存するディレクトリを、先に作成して所有者を設定しておきます。

```bash
mkdir -p trilium-data
sudo chown 1000:1000 trilium-data
```

作成せずに `docker compose up -d` を実行すると、Dockerがroot所有でディレクトリを作成します。その結果、コンテナ内のユーザー(UID 1000)が書き込めずにエラーになることがあります。

## docker-compose.yml の作成

```yaml
services:
  trilium:
    image: triliumnext/trilium:v0.106.0
    container_name: trilium
    restart: unless-stopped
    ports:
      - "12000:8080"
    volumes:
      - ./trilium-data:/home/node/trilium-data
    environment:
      - TZ=Asia/Tokyo
    labels:
      com.example.inventory.role: "note-taking-server"
      com.example.inventory.env: "production"
      com.example.inventory.owner: "kazukif"
      com.example.inventory.port.host: "12000"
      com.example.inventory.port.container: "8080"
      com.example.inventory.port.protocol: "tcp"ß
      com.example.inventory.description: |
        TriliumNext v0.106.0。
        階層構造でノートを管理するセルフホスト型ノートアプリ。
        Raspberry Pi 4(4GB)上で稼働。
        データは ./trilium-data に永続化。
```

各設定の意味は次のとおりです。

- **image**:バージョンを `v0.106.0` に固定しています(2026年10月時点)。`latest` を使うと `docker compose pull` のたびに意図せずバージョンが上がり、データベースのスキーマ変更などで不具合が出る可能性があります。最新のバージョンは[公式のリリースページ](https://github.com/TriliumNext/Trilium/releases)で確認してください。
- **restart**:コンテナの再起動ポリシーです。
  - `always`:コンテナが停止したら常に再起動します。手動で `docker stop` した場合も、停止状態は維持されますが、Dockerデーモン(ホスト)の再起動時には起動します。
  - `unless-stopped`:手動で停止した場合は、デーモンが再起動しても起動しません。

  常時稼働させたいが、メンテナンスで手動停止したものは勝手に起動してほしくないので、`unless-stopped` を採用しています。
- **ports**:ホストの12000番ポートを、コンテナ内のTrilium(8080番)に転送します。このままだとLAN内の全端末からアクセスできます。
- **volumes**:Triliumのデータ(`document.db`、設定ファイルなど)の永続化先です。コンテナを削除・再作成してもノートが残ります。バックアップの対象にしてください。
- **environment**:タイムゾーンを日本時間にします。日時の表示やローカル時刻の扱いが日本時間になります。

## TriliumNextの起動

```bash
docker compose up -d
```

起動状態とログは次のコマンドで確認できます。

```bash
docker compose ps
docker compose logs -f trilium
```

`docker compose ps` の `STATUS` が `Up` になっていれば起動できています。ログにエラーが出続けている場合は、まず「データ用ディレクトリの作成」の権限設定を確認してください。

## 初期設定

- ブラウザで `http://<ラズパイのIPアドレス>:12000` にアクセスします。
- 初回アクセス時にセットアップ画面が表示されます。新しくノートを始める場合は、新規にTriliumのドキュメントを作成する側の選択肢を選びます(別のTriliumサーバーとの同期を設定する選択肢もありますが、ここでは使いません)。
- ログイン用のパスワードを設定します。
- 設定後、ログイン画面でパスワードを入力するとノート画面が開きます。

## バックアップ

ノートのデータは `./trilium-data` に保存されています。コンテナを停止してからディレクトリごとコピーするのが確実です。

```bash
docker compose stop
cp -a trilium-data trilium-data_backup_$(date +%Y%m%d)
docker compose start
```

Trilium自身も、データディレクトリ内の `backup` フォルダに定期的にバックアップを作成します。ただし、どちらも同じSDカード内にあるため、カードが故障すると一緒に失われます。**別のディスクやNASなど、別の場所にもコピーしてください。** 例として、別ホストへ `rsync` でコピーする場合は次のようになります。

```bash
rsync -a trilium-data_backup_YYYYMMDD/ <ユーザー名>@<バックアップ先>:<保存先ディレクトリ>/
```

あわせて、`docker-compose.yml` もバックアップ対象に含めてください。SDカードは書き込みに弱いため、可能であればSSDへの保存をおすすめします。

### 復元

バックアップから戻す場合は、コンテナを停止してデータを入れ替えます。

```bash
docker compose stop
mv trilium-data trilium-data_broken
cp -a trilium-data_backup_YYYYMMDD trilium-data
docker compose start
```

`cp -a` は所有者などの属性も保持するため、権限の設定をやり直す必要はありません。正常に戻ったことを確認してから、`trilium-data_broken` を削除してください。

## バージョンアップ

- 公式のリリースノートを確認します。
- 上記の手順でバックアップを取ります。
- `docker-compose.yml` の `image` のタグを書き換えます。
- 次のコマンドを実行します。

  ```bash
  docker compose pull
  docker compose up -d
  ```

古いイメージは、不要になったら `docker image prune` で削除できます。

データベースの更新(マイグレーション)は基本的に元に戻せません。不具合が出た場合は、旧バージョンのタグに戻したうえで、アップグレード前に取ったバックアップを復元してください。バックアップなしのバージョンアップは避けてください。

## Reference
- [Trilium User Guide](https://docs.triliumnotes.org/user-guide/)