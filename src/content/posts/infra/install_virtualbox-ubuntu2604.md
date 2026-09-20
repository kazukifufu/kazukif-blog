---
title: "Ubuntu 26.04 LTSへのVirtualBox導入とUEFIセキュアブート対応"
date: "2026-09-20"
category: "infra"
---

### 発生事象
Ubuntu 26.04 LTSの環境にVirtualBox v7.2を導入し、再起動後以下のメッセージが表示され、VirtualBoxも起動しない状況となった。

```text
An error occurred, please run Package Manager from the right-click menu or apt-get in a terminal to see what is wrong.
The error message was: 'Error: BrokenCount > 0'. This usually means that your installed packages have unmet dependencies   
```
これは、Ubuntu(Linux)のパッケージ管理(apt)で依存関係のエラー(Broken packages)が発生していることを示しています。


### 背景
Ubuntu環境において、UEFIセキュアブートが有効な状態でVirtualBoxを導入する際、パッケージ依存関係のエラー(`BrokenCount > 0`)やカーネルモジュール(`vboxdrv`)のロード失敗が発生することがあります。

これはサードパーティ製モジュールをカーネルにロードするためのMOK(Machine-Owner Key)の署名・承認手順が完了していないために生じるものです。本記事では、VirtualBoxの導入からMOK登録、正常性の確認までの流れをまとめます。


### トラブルの仕組み(依存関係エラーとMOK)

セキュアブート環境下でのモジュールロード失敗および`apt`の依存関係エラーは、以下の流れで発生します。

```text
VirtualBoxのインストール / 更新
  └─ DKMSによる vboxdrv モジュールのビルド
         └─ セキュアブート環境のため未署名モジュールの読み込み拒否
                └─ MOKキー(一時パスワード)生成画面の保留
                       └─ aptパッケージ管理で処理未完了(BrokenCount > 0)が発生

```
  - DKMS(Dynamic Kernel Module Support)は、Linuxでカーネルモジュール(ドライバーなど)のビルドと組み込みを自動化するためのフレームワーク


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

* セキュアブート環境下では、VirtualBox等のサードパーティモジュール読み込みにMOK登録が必要となります。
* `apt --fix-broken install` と再起動時のMOK承認を行うことで、依存関係エラーの解消とモジュールの正常ロードが完了します。
* `modinfo` で `signer:` の項目に自身のホスト名が入った鍵が確認できれば、安全にVirtualBoxを利用可能な状態となります。