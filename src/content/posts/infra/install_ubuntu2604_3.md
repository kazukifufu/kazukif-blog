---
title: "Ubuntu 26.04 LTSの導入(その3) UEFIセキュアブートに関連する鍵の確認"
date: "2026-09-15"
category: "infra"
---

### UEFIセキュアブートの鍵の構成
上位の鍵ほど強い権限を持ち、下位の変数を書き換える際の「署名者」として使われる。

```
PK(Platform Key): KEK(Key Exchange Key)を更新する権限を持つ
  └─ KEK(Key Exchange Key): db / dbx を更新する権限を持つ
         └─ db(許可リスト):実際にブートローダー等の署名検証に使われる
         └─ dbx(禁止リスト):失効させたい署名・証明書・ハッシュのブラックリスト
```

---
### UEFIセキュアブートの鍵の確認
以下のコマンドで確認する(mokutil --list-enrolled が表示するMOKリストとは別物になります)。

```bash
mokutil --pk    # PK(Platform Key)
mokutil --kek   # KEK(Key Exchange Key)
mokutil --db    # db(Signature Database、許可リスト)
mokutil --dbx   # dbx(Forbidden Signature Database、禁止リスト)
```

#### 1. PK(Platform Key)
- **役割**：ファームウェア全体の最上位の信頼の起点。1つの鍵(証明書)のみが登録されます。
- **誰が持つか**：通常はPCメーカー(OEM)。`mokutil --pk` を実行した際に出力された `CN=ASRock Inc.` がまさにこれで、ASRockが自社のマザーボードのPKとして登録した証明書です。
- **できること**：KEKを更新・入れ替える権限を持ちます。逆に言うと、PKの秘密鍵を持っていない一般ユーザーは、正規の手順ではKEKを書き換えられません(UEFI Setup画面からのCustomモード操作は例外で、これはOSの外側から物理的にアクセスすることで許可される特別な経路です)。
- **PKを削除するとどうなるか**：PKが未設定の状態は「Setup Mode」と呼ばれ、Secure Bootの検証自体が事実上無効化されます(KeyToolなどで鍵を再構築する際にこの状態を使います)。

#### 2. KEK(Key Exchange Key)
- **役割**：db/dbxを更新するための鍵。複数登録可能です。
- **中身**：`mokutil --kek`の結果で、Microsoftの「KEK CA 2011」と「KEK 2K CA 2023」が両方登録されていました。これはMicrosoft自身がWindows UpdateなどでdbやKEKを更新できるように、Microsoftの鍵をKEKとして登録してある、という意味です。
- **できること**：db・dbxへの署名済み更新を検証し、正当な更新のみ適用させる役割です。PKと違い複数の主体(Microsoft、OEM各社など)が並存できます。

#### 3. db(Signature Database、許可リスト)
- **役割**：**実際にブート時のファイル署名検証に使われる**「信頼する証明書・ハッシュ」のリスト。
- **中身**：`mokutil --db` の結果で、
  - `Microsoft Corporation UEFI CA 2011`(shim/GRUB等サードパーティ用・旧)
  - `Microsoft Windows Production PCA 2011`(Windows Boot Manager用)
  - `Microsoft UEFI CA 2023`(同・新)
  - `Microsoft Option ROM UEFI CA 2023`
  のように、実際にブートローダーやオプションROMを検証するための証明書が並びます。
- **shimとの関係**：`sbverify --list shimx64.efi` の結果で確認できるissuer(例：`UEFI CA 2011`)が、このdbに登録されているかどうかで、ファームウェアがshimのロードを許可するか決まります。

#### 4. dbx(Forbidden Signature Database、禁止リスト)
- **役割**：dbとは逆に、**明示的にブロックしたい**証明書・バイナリのハッシュ・鍵のリストです。
- **使われ方**：脆弱性が見つかった古いGRUBやshimのバージョンなどが、Microsoftのセキュリティ更新を通じてdbxに追加され、たとえdbに信頼された証明書で署名されていても、そのバイナリ単体(またはそのハッシュ)はブロックされる、という仕組みです。BootHole脆弱性(CVE-2020-10713)対応などがこの典型例です。

---
### ブートローダー shim の署名を確認
ブートローダー shimがどの証明書で署名されているか確認する。sbsigntool パッケージの sbverify コマンドで、PE署名の発行者(issuer)を一覧表示できます。

```bash
sudo apt install sbsigntool
sbverify --list /usr/lib/shim/shimx64.efi.signed
```
または実際にESPに配置されているファイルを直接見る場合：

```bash
sbverify --list /boot/efi/EFI/ubuntu/shimx64.efi
```
- 確認結果

| 項目 | 内容 |
| --- | --- |
| 署名数 | 1つのみ |
| 署名の発行者(issuer) | Microsoft Corporation UEFI CA 2011 |
| 埋め込まれている証明書チェーン | Microsoft Windows UEFI Driver Publisher(issuer: UEFI CA 2011) |
| | Microsoft Corporation UEFI CA 2011(issuer: Microsoft Corporation Third Party Marketplace Root) |

---
### まとめ
下記の組み合わせとなり、shimの検証には引き続き2011年版CAが使われ、正常に起動します。

- shim → 2011年版のみで署名
- db → 2011年版と2023年版の両方が既に登録済み

証明書が不足している場合は起動しないため、次回の記事を参考に必要となる証明書の導入が必要となります。