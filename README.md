ブログ記事の内容を試すための手順を記載します。実行するためには以下の準備が必要です。

* AWSの一時クレデンシャルを用いる場合、スイッチロールできる環境
* TypeScript で Lambda Function を構築するためのコマンドラインツール [tsas](https://www.npmjs.com/package/tsas)

# デプロイ

以下の手順は、すべてスイッチロール済み、環境変数にAWSアクセス情報が満たされている状態で実施します。

* `tsas param push -e stg`

`environments/stg/variables.json` の内容をパラメータストアへ送信します。パラメータストアの値は CloudFormation でデプロイする際に埋め込みます。

* `tsas deploy sls --e stg`

`stg` 環境として展開された先ほどのパラメータを使って Lambda Function をデプロイします。

* `tsas deploy cfn dynamodb --env stg`

SAM ではなく CloudFormation テンプレートとしてデプロイします。今回は DynamoDB テーブルをデプロイします。

# 実行

### CloudWatch Event の作成（日本時間9時 実行）

```
aws lambda invoke \
--function-name stg-cloud-watch-event-sample-create-cloud-watch-event --log-type Tail \
--payload '{"ruleName":"my-rule", "triggerHour":0, "triggerMinutes":0}' \
outputfile.txt
```


### CloudWatch Event の削除

```
aws lambda invoke \
--function-name stg-cloud-watch-event-sample-remove-cloud-watch-event --log-type Tail \
--payload '{"ruleName":"my-rule"}' \
outputfile.txt
```

# Useful commands

Commands:

* `tsas init`     Create a new, empty Typed Lambda project from a template.
* `tsas param`    Manage application parameters, [push|list]
* `tsas deploy`   Deploy aws resources, [serverless|sls|cloudformation|cfn]
* `tsas display`  Display information [cfn-parameters]

Options:

* `--version `  Show version number                                      [boolean]
* `--region  `  Use the indicated AWS region to override default in config file. [string]
* `--env, -e `  Environment name; such as dev, stg, prod...               [string]
* `--verbose `  Set verbose mode.                       [boolean] [default: false]
* `-h, --help`  Show help                                                [boolean]
