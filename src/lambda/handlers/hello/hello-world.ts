import 'source-map-support/register';
import * as AWS from 'aws-sdk';
import { UpdateItemInput } from 'aws-sdk/clients/dynamodb';
import * as uuid from 'uuid';
import { IGreetingRequest } from '../greeting';

const EnvironmentVariableSample = process.env.GREETING_TABLE_NAME!;
const Region = process.env.REGION!;

const DYNAMO = new AWS.DynamoDB(
    {
        apiVersion: '2012-08-10',
        region: Region
    }
);

exports.handler = async (event: IGreetingRequest) => {
    return HelloWorldController.hello(event);
};

export class HelloWorldController {

    public static hello(payload: IGreetingRequest): Promise<IGreeting> {
        console.log(payload);
        return GreetingDynamodbTable.greetingStore(this.createMessage(payload));
    }

    private static createMessage(payload: IGreetingRequest): IGreeting {
        return {
            title: 'hello, lambda!',
            description: payload.greet,
        }
    }
}

class GreetingDynamodbTable {

    public static async greetingStore(greeting:IGreeting): Promise<any> {

        const params: UpdateItemInput = {
            TableName: EnvironmentVariableSample,
            Key: {greetingId: {S: uuid.v4()}},
            UpdateExpression: [
                'set title = :title',
                'description = :description'
            ].join(', '),
            ExpressionAttributeValues: {
                ':title': {S: greeting.title},
                ':description': {S: greeting.description}
            }
        };

        return DYNAMO.updateItem(params).promise()
    }

}

export interface IGreeting {
    title: string;
    description: string;
}
