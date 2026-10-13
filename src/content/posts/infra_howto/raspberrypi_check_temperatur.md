---
title: "[Raspberry Pi 4] CPU温度の確認方法とcronによる1分周期のログ保存"
date: "2026-10-13"
category: "infra_howto"
---

- 前提

  Raspberry Pi 4 を自宅サーバーやメディアサーバーとして運用していると、本体が高温になることが気になりました。**Raspberry Pi 4 のCPU温度の確認方法**と、**`cron`を使った1分ごとの温度ログ自動保存**についてまとめました。


- Raspberry Pi 4 の CPU 温度を確認する
  - sysfs から直接取得し、`awk` コマンドで整形

    ```bash
    awk '{printf "%.1f°C\n", $1/1000}' /sys/class/thermal/thermal_zone0/temp

    ```

    - **正常範囲の目安:** アイドル〜軽負荷時で 40〜50°C 前後。70°C を超えると性能制限(サーマルスロットリング)のリスクが高まります。


- cronを使って1分ごとに温度をログファイルへ記録する

  CPU 温度の推移を追うため、`cron` を使って 1分ごとに日時と温度をテキストファイルへ書き出します。

  - 設定手順
    - ターミナルで `crontab` 編集画面を開く
    ```bash
    crontab -e

    ```

  - 最下行に以下の設定を追加する
    ```text
    * * * * * echo "$(date '+\%Y-\%m-\%d \%H:\%M:\%S') $(awk '{printf "\%.1f°C", $1/1000}' /sys/class/thermal/thermal_zone0/temp)" >> /mnt/SSD2T/Logs/cpu_temp.log

    ```
    > **💡 ポイント(`cron` 内でのエスケープ処理)**
    > `cron` 内では `%` が「改行」として解釈される特殊文字です。`date` や `awk` の書式指定に含まれる半角 `%` の前には **必ず `\`(バックスラッシュ)を付けてエスケープ** してください(例: `\%Y-\%m-\%d`)。

  - 保存して閉じた後、ログを確認する
    ```bash
    tail -f /mnt/SSD2T/Logs/cpu_temp.log

    ```
    - **出力例:**
        ```text
        2026-10-12 10:28:00 49.2°C
        2026-10-12 10:29:00 49.5°C

        ```
