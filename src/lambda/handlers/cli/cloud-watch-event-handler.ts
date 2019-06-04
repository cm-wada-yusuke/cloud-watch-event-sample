import * as AWS from 'aws-sdk';
import {
    DeleteRuleRequest,
    PutRuleRequest,
    PutRuleResponse,
    PutTargetsRequest,
    RemoveTargetsRequest
} from 'aws-sdk/clients/cloudwatchevents';
import { AddPermissionRequest, GetPolicyRequest, RemovePermissionRequest } from 'aws-sdk/clients/lambda';
import { IGreetingRequest } from '../greeting';

const Env = process.env.ENV!;
const Region = process.env.REGION!;
const GreetingLambdaArn = process.env.GREETING_LAMBDA_ARN!;
const CloudWatchEvent = new AWS.CloudWatchEvents({
    apiVersion: '2015-10-17',
    region: Region
});
const AWSLambda = new AWS.Lambda({
    apiVersion: '2015-03-31',
    region: Region
});


exports.createEvent = (event: ICreateEventRequest): Promise<ICreateRuleResult> => {
    return CloudWatchEventHandler.createStartRule(event);
};

exports.removeEvent = async (event: ICreateRuleResult): Promise<void> => {
    await CloudWatchEventHandler.removeRule(event);
};

interface ICreateEventRequest {
    ruleName: string;
    triggerHour: number;
    triggerMinutes: number;
}

interface ICreateRuleResult {
    ruleName: string;
}

class CloudWatchEventHandler {

    static async createStartRule(request: ICreateEventRequest): Promise<ICreateRuleResult> {

        // ① - スケジュールベースのルールを作成
        const scheduleExpression = `${request.triggerMinutes} ${request.triggerHour} * * ? *`;
        const ruleName = `${Env}-${request.ruleName}`;
        const createRuleParam: PutRuleRequest = {
            Name: ruleName,
            State: 'ENABLED',
            ScheduleExpression: `cron(${scheduleExpression})`
        };

        const putResult: PutRuleResponse = await CloudWatchEvent.putRule(createRuleParam).promise();


        // ② - イベントのターゲットを作成。ここでは Lambda Function を起動する。JSONペイロードを渡す
        const lambdaInputJson: IGreetingRequest = {
            greet: 'こんにちは！CloudWatch Event から Lambda Functionを起動しました。'
        };
        const putTargetParam: PutTargetsRequest = {
            Rule: ruleName,
            Targets: [
                {
                    Id: ruleName,
                    Arn: GreetingLambdaArn,
                    Input: JSON.stringify(lambdaInputJson)
                }
            ]
        };
        await CloudWatchEvent.putTargets(putTargetParam).promise();

        // ③ - Lambda Function が CloudWatch Eventからの起動を許可するよう、パーミッションを追加
        const addPermissionParams: AddPermissionRequest = {
            Action: 'lambda:InvokeFunction',
            FunctionName: GreetingLambdaArn,
            Principal: 'events.amazonaws.com',
            SourceArn: putResult.RuleArn,
            StatementId: createRuleParam.Name,
        };

        await AWSLambda.addPermission(addPermissionParams).promise();

        return {
            ruleName
        }

    }


    static async removeRule(result: ICreateRuleResult): Promise<void> {

        // ① - Lambda Function のパーミッションを削除
        const getStartPolicyParam: GetPolicyRequest = {
            FunctionName: GreetingLambdaArn
        };
        const policy = await AWSLambda.getPolicy(getStartPolicyParam).promise();

        if (policy.Policy) {
            const policyDocument: IPolicyDocument = JSON.parse(policy.Policy) as IPolicyDocument;

            // 削除しようとしている CloudWatch Event に相当するポリシードキュメントを探す
            const targetPolicy = policyDocument.Statement
                .find(statement => statement.Condition.ArnLike['AWS:SourceArn'].includes(result.ruleName));

            // ポリシーが見つかったらSidを指定して削除する
            if (targetPolicy) {
                console.log('policy found:', targetPolicy);
                const removePolicyParam: RemovePermissionRequest = {
                    FunctionName: GreetingLambdaArn,
                    StatementId: targetPolicy.Sid
                };

                await AWSLambda.removePermission(removePolicyParam).promise();
            }
        }

        // ② - CloudWatch Event のターゲットを削除する
        const removeTargetParam: RemoveTargetsRequest = {
            Ids: [result.ruleName],
            Rule: result.ruleName
        };

        try {
            await CloudWatchEvent.removeTargets(removeTargetParam).promise();
        } catch (e) {
            console.log(`failed to delete targets:`, e);
        }

        // ③ - CloudWatch Event のルールを削除する
        const deleteRuleParam: DeleteRuleRequest = {
            Name: result.ruleName,
            Force: true
        };
        await CloudWatchEvent.deleteRule(deleteRuleParam).promise();
    }


}

interface IPolicyDocument {
    Statement: Statement[];
}

interface Statement {
    Condition: Condition
    Sid: string;
}

interface Condition {
    ArnLike: ArnLike;
}

interface ArnLike {
    'AWS:SourceArn': string;
}

