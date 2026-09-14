---
title: "Ubuntu 26.04 LTSの導入(その2) Windows11との同居とUEFIセキュアブートとは"
date: "2026-09-14"
category: "infra"
---

### Windows11との同居方法
Ubuntu 26.04 LTSの導入先であるmouse DT5-G-B560W11-EX5の512GBのSSDにWindows11が導入されています。既存のWindows11には手を加えることなく残し、Ubuntu 26.04 LTSとデュアルブートができる環境構築を前提としました。
- 既存のWindows11は、512GBのSSDに導入されているWindows Boot Managerから起動されているが、この設定は変更しない
- 既存のWindows11が導入されている512GBのSSDのパーティションサイズ等ディスク構成は変更しない
- Ubuntu 26.04 LTSは、GRUBとともに1TB SSDに導入する
- shim → GRUB → Ubuntu 26.04 LTS、shim → GRUB → Windows Boot Manager → Windows11 の起動パスとする
- UEFIセキュアブートを有効にする

---
### UEFIセキュアブートとは
従来のPC起動手順(レガシーBIOS)では、OSが立ち上がる前にハードディスクの先頭領域(MBR)へ割り込むマルウェア(ルートキットやブートキット)を防ぐ手段がありませんでした。一度OSより深い層に潜伏されると、アンチウイルスソフトからも検知できなくなります。UEFI Secure Boot(セキュアブート)は、PCの電源を入れてからOSが起動するまでの間に、未承認のソフトウェアや悪意のあるプログラム(マルウェア)が実行されるのを防ぐセキュリティ機能です。
Ubuntuにおける shim とは、UEFIセキュアブートが有効な環境でLinuxを起動させるための軽量ブートローダーです。

  - **Linuxカーネル起動時の検証**
    - UEFIファームウェアが shim を **Microsoftの鍵** で検証する(shim自体はMicrosoftの署名済みプログラム)
    - shim が GRUB を **Canonicalの鍵、または MOK** で検証する
    - GRUB が shim-lockモジュール経由で、shimが保持する鍵(Canonicalの鍵 or MOK)を使い Linux カーネル(vmlinuz)を検証する
  - **Windows起動時の検証**
    - UEFIファームウェアが shim を **Microsoftの鍵** で検証する(ここまでは共通)
    - GRUB が chainloader で Windows Boot Manager を呼び出すが、この際は GRUB 自身やCanonicalの鍵は関与せず、**UEFIファームウェア(またはshim)がMicrosoftの鍵で直接** Windows Boot Manager を検証する

途中で1つでも無署名、または改ざんされた(ブラックリストに該当する)プログラムが見つかると、UEFIは起動プロセスを中断しエラーを表示します。注意点として、独自ビルドしたLinuxカーネル、署名のないサードパーティ製ドライバー(NVIDIAのグラフィックドライバーやVirtualBoxのモジュールなど)が初期状態でブロックされることがあるため、MOK(Machine Owner Key)での手動追加やUEFI上のセキュリティ調整が必要になる場合があります。

---
### UEFIセキュアブートの有効・無効の確認
Windows11のPowerShellから以下のコマンドを使い確認できます。True/False が戻り値になります。なお、Confirm-SecureBootUEFI は管理者権限のPowerShellで実行する必要があり、レガシーBIOSモードでインストールされたWindowsでは使えないコマンドになります。

```PowerShell
Confirm-SecureBootUEFI
```
また、「Secure Boot Violation / Invalid signature detected」というエラーで起動しない場合は、BIOS設定画面から一旦UEFIセキュアブートを無効にし、Ubuntu 26.04 LTSを起動してください。次回以降のトピックで、UEFIセキュアブートで必要となる鍵の確認方法と解決方法(鍵の追加方法)を取り上げていきます。
