# ぼくだけのてつどううんてんシミュレーター

子ども向けの鉄道運転ゲームです。画面の文字はひらがな・カタカナだけです。

## APK の入れかた

1. [release/bokudake-tetsudou-debug.apk](release/bokudake-tetsudou-debug.apk) をスマートフォンに保存する
2. Android の設定で「提供元不明のアプリ」を許可する
3. 保存した APK を開いてインストールする

デバッグ署名の APK です。Google Play には出せません。自分の端末に入れるためのものです。

## 自分で APK を作る

必要なもの:

- Node.js 22
- JDK 21
- Android SDK（`ANDROID_HOME`）

```bash
npm ci
bash scripts/build-apk.sh
```

できたファイルは `release/bokudake-tetsudou-debug.apk` です。

Web だけで動かす場合:

```bash
npm ci
npm run dev
```
