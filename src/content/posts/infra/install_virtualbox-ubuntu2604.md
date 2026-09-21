---
title: "Ubuntu 26.04 LTSへのVirtualBox導入とUEFIセキュアブート対応"
date: "2026-09-20"
dateRevised: "2026-09-21"
category: "infra"
---

### 概要

Ubuntu 26.04 LTS に VirtualBox 7.2 を導入したところ、再起動後に apt のエラーが表示され、VirtualBox も起動しませんでした。原因は、UEFI セキュアブート環境で必要な MOK(Machine Owner Key)の登録が完了していなかったことでした。エラーの修復から MOK 登録、署名の確認までの流れをまとめます。


### 環境

| 項目 | 内容 |
| --- | --- |
| OS | Ubuntu 26.04 LTS |
| VirtualBox | 7.2 |
| インストール元 | https://download.virtualbox.org/virtualbox/7.2.18/virtualbox-7.2_7.2.18-175117~Ubuntu~resolute_amd64.deb |
| ファームウェア | UEFI(セキュアブート有効) |


### 発生事象
Ubuntu 26.04 LTSの環境にVirtualBox v7.2を導入し、再起動後以下のメッセージが表示され、VirtualBoxも起動しない状況となった。
```text
An error occurred, please run Package Manager from the right-click menu or apt-get in a terminal to see what is wrong.
The error message was: 'Error: BrokenCount > 0'. This usually means that your installed packages have unmet dependencies   
```
これは、Ubuntu(Linux)のパッケージ管理(apt)で依存関係のエラー(Broken packages)が発生していることを示しています。


### 導入時に実行したコマンド

```bash
sudo dpkg -i virtualbox-7.2_7.2.16-174877-Ubuntu-resolute_amd64.deb
```


### 原因の整理

VirtualBox のカーネルモジュール(`vboxdrv`)は、DKMS(Dynamic Kernel Module Support)によってホスト上でビルドされます。

- **DKMS**: Linux でカーネルモジュール(ドライバーなど)のビルドと組み込みを自動化するフレームワークです。

セキュアブートが有効な環境では、署名されていないモジュールはロードできません。そのため `virtualbox-dkms` のインストール中に、モジュール署名用の鍵を作成し、MOK に登録するための手順が始まります。

私の環境で起きたことは、次の流れだったと考えています(エラーメッセージと状況からの推定です)。

```text
VirtualBox のインストール
  └─ virtualbox-dkms の設定処理(postinst)
         └─ 「Configuring Secure Boot」画面でパスワード設定を求められる
                └─ 設定が完了しないまま処理が中断
                       └─ パッケージの設定が未完了となり BrokenCount > 0 が発生
```

つまり、apt のエラーは「パッケージの設定処理が完了していないこと」から生じています。MOK の承認そのものは、その後の再起動時に行う別の作業です。


### 対応手順

#### 1. パッケージ依存関係の修復とMOKパスワードの設定

端末(ターミナル)を開き、依存関係の修復コマンドを実行します。

```bash
sudo apt update
sudo apt --fix-broken install

```

実行途中に「Configuring Secure Boot」という青い画面が表示されます。

1. **`Enter` キー** を押して `<Ok>` を選択します。
2. 再起動時に使用する **一時パスワード(8文字以上)** を設定します。
3. 確認のため、同じパスワードを再入力します。

#### 2. システムの再起動

設定完了後、システムを再起動します。

```bash
sudo reboot

```

#### 3. MOK Manager(再起動時画面)での登録処理

再起動直後、青(またはグレー)の「Perform MOK management」画面が表示されます。

1. **Enroll MOK** を選択して `Enter`
2. **Continue** を選択して `Enter`
3. **Yes** を選択して `Enter`
4. 手順1で設定した **一時パスワード** を入力
5. **Reboot** を選択してシステムを通常起動させる


### 設定の検証・確認

システム起動後、モジュールおよび署名が正常に適用されているか確認します。

#### 1. カーネルモジュール(vboxdrv)の稼働確認

```bash
sudo systemctl status vboxdrv

```

* 確認結果

| 項目 | ステータス | 判定 |
| --- | --- | --- |
| **Active** | `active (exited)` | **正常**(ワンショットサービスのため) |
| **Log** | `vboxdrv.sh: Starting VirtualBox services.` | **正常** |

#### 2. MOK登録情報の確認

`mokutil` を使用して、ホスト固有の署名鍵がMOKリストに登録されているか確認します。

```bash
mokutil --list-enrolled

```

* 確認結果(抜粋)

```text
[key 4]
Owner: 605dab50-e046-4300-abb6-3dd810dd8b23
SHA1 Fingerprint: 4a:e1:f9:f5:df:36:38:e1:24:13:93:48:90:89:ed:2e:9d:c4:e6:14
Certificate:
    Data:
        Subject: CN=kazukif-dt5-g-b560 Secure Boot Module Signature key

```

#### 3. モジュール署名の検証

`vboxdrv` モジュールが上記で登録した鍵で署名されているか確認します。

```bash
modinfo vboxdrv | grep -i signer

```

* 確認結果

```text
signer:         kazukif-dt5-g-b560 Secure Boot Module Signature key

```


### まとめ

セキュアブート環境下では、VirtualBox等のサードパーティモジュール読み込みにMOK登録が必要となります。

今回の `BrokenCount > 0` は、`virtualbox-dkms` の設定処理が途中で止まったことが原因と考えられます。`apt --fix-broken install` で設定を完了させ、再起動後に MOK Manager で承認しました。

`modinfo` で `signer:` の項目に自身のホスト名が入った鍵が確認できれば、安全にVirtualBoxを利用可能な状態となります。