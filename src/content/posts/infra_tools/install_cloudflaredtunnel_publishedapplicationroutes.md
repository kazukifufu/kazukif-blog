---
title: "Cloudflare TunnelへのPublished application routesの追加"
date: "2026-10-03"
category: "infra_tools"
---

- Tunnelへの公開するURLの登録
  - Webアプリケーション(例 Nextcloud)へのアクセス
    1. Cloudflareの左メニューから Zero Trust > Networks > Tunnels & Mesh を開く
    2. URLを登録するTunnel nameをクリックする
    3. 上部の Published application routesボタンをクリックする
    4. 右上の+Add a published application routeボタンをクリックする
    5. Hostnameセクションでは、Subdomein(例 nextcloud)を入力、Domainをプルダウンから選択、Pathはブランクを指定する
    6. Serviceセクションでは、Typeをプルダウンから HTTP を選択、URLにIPアドレス・ポート番号を指定する(例 NextcloudはUbuntu(IPアドレス: 192.168.1.1)上で11000ポートのhttpサービスとして稼働している場合, 196.168.1.1:11000)
    7. 右下のSaveボタンをクリックして保存する    

  - sshでアクセス
    1.〜4.は上記と同じ
    5. Hostnameセクションでは、Subdomein(例 ssh)を入力、Domainをプルダウンから選択、Pathはブランクを指定する
    6. Serviceセクションでは、Typeをプルダウンから SSH を選択、URLにIPアドレス・ポート番号を指定する(例 Ubuntu(IPアドレス: 192.168.1.1)上で22ポートのsshサービスとして稼働している場合, 196.168.1.1:22)
    7. 右下のSaveボタンをクリックして保存する

  - sshでアクセス時のブラウザターミナル機能と認証保護を設定
    1. Cloudflareの左メニューからZero Trust > Access controls > Applicationsを開く
    2. 右上の+Create new applicationボタンをクリックする
    3. Self-hosted and private選択し、ボタンのタイトルがContinue with Self-hosted and privateであることを確認の上クリックする
    4. Destinationsセクションでは、Subdomainにsshを入力、Domainをプルダウンから選択、athはブランクを指定する
    5. Allow access through browser-based RDP, SSH, or VNC sessionsを有効にする
    6. Access policiesでは、Create new policyボタンをクリックする
      1. Includeでは、Emailsを選択し、e-mailアドレスを入力する
      2. Policy detailsでは、Policy Name(例 Allow-Owner)、ActionにAllow、Policy session durationはSame as application session durationを選択し、右下のSave policyボタンをクリックする
      3. 作成しているApplication details画面で作成したAccess policiesが紐ついていることを確認する
    7. Preview/Detailsセクションの内容を確認し、右下のSaveボタンをクリックする

- ブラウザからの接続テスト
  - 普段お使いのPCのブラウザから [https://nextcloud.yourdomain.com](https://nextcloud.yourdomain.com)、[https://ssh.yourdomain.com](https://ssh.yourdomain.com) にアクセスします。
  - sshでアクセスの場合、Cloudflare Access の認証画面（IdPログイン + MFA入力）が表示されます。sshログインで使用するユーザーIDとパスワードを入力してください(この認証画面が表示される前にGooglを使用したMFA実施されます)。認証が完了すると、ブラウザ上に黒いターミナル画面が表示されます
