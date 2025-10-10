# 変更をGitHubに反映する手順

このリポジトリで行った修正をGitHubに反映するまでの流れを、ローカル環境と本環境それぞれでまとめました。

## 1. 変更内容を確認する

```bash
git status
```

## 2. 変更ファイルをステージする

```bash
git add <ファイル名>
# すべて追加する場合
# git add -A
```

## 3. コミットを作成する

```bash
git commit -m "わかりやすいコミットメッセージ"
```

## 4. GitHubへプッシュする

ローカルで作業している場合は、あらかじめGitHubに作成したリポジトリを`origin`として登録しておきます。

```bash
# 初回のみ（未設定の場合）
git remote add origin https://github.com/<ユーザー名>/<リポジトリ名>.git

# 変更をプッシュ
git push origin <ブランチ名>
```

## 5. Pull Requestを作成する（必要に応じて）

GitHub上で対象ブランチから`main`等の公開ブランチに向けたPull Requestを作成し、内容を確認してマージします。

---

### この環境（ChatGPT Code Interpreter）からGitHubに反映したい場合

1. 上記の手順でコミットまで作成します。
2. 出力された差分をダウンロードするか、`git format-patch`などでパッチを作成します。
3. ローカル環境に適用し、GitHubにプッシュしてください。

ローカル環境をお持ちでない場合は、GitHubのWebエディタを利用して同様の変更を手動で反映することもできます。
