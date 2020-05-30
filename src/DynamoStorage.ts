import { IStorage, IStorageOptions } from './Interfaces';
import AWS from 'aws-sdk';
import * as path from 'path';
import dotenv from 'dotenv';
import { PromiseResult } from 'aws-sdk/lib/request';

export class DynamoStorage implements IStorage {
  /*** PUBLIC ***/

  public readonly DataMetadataId = 0;
  public readonly TableName: string;

  public constructor(tableName: string, maxNodeSize: number = 512) {
    this._maxNodeSize = maxNodeSize;
    this.TableName = tableName;
    AWS.config.update({ region: 'us-east-1' });
    if (process.env.DYNAMODB_PROFILE === undefined) {
      dotenv.config({ path: path.resolve(__dirname, '../.env') });
    }

    if (process.env.DYNAMODB_PROFILE === undefined) {
      throw new Error('Must defined the DYNAMODB_PROFILE environment variable');
    }

    AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: process.env.DYNAMODB_PROFILE });

    // Create the DynamoDB service object
    this.ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });
  }

  options(): IStorageOptions {
    return {
      supportsInternalDelete: false,
      maxNodeSize: this._maxNodeSize,
    };
  }

  async get(id: number): Promise<Buffer | undefined> {
    const result = (
      await this.ddb
        .getItem({
          TableName: this.TableName,
          Key: {
            Index: { S: id.toString() },
          },
        })
        .promise()
    ).Item?.Data.B;
    if (result instanceof Buffer || result === undefined) {
      return result;
    } else {
      throw new Error('Unknown return type');
    }
  }

  async put(id: number, ref: Buffer): Promise<void> {
    await this.ddb
      .putItem({
        TableName: this.TableName,
        Item: {
          Index: { S: id.toString() },
          Data: { B: ref },
        },
      })
      .promise();
  }

  async *generator(count?: number | undefined): AsyncGenerator<{ key: number; buffer: Buffer }, boolean, number> {
    let result: PromiseResult<AWS.DynamoDB.ScanOutput, AWS.AWSError>;
    do {
      result = await this.ddb
        .scan({
          TableName: this.TableName,
        })
        .promise();

      if (result.Items === undefined) {
        throw new Error('DynamoDB did not return any results');
      }

      for (const item of result.Items) {
        const keyAsString = item.Index.S;
        const buffer = item.Data.B as Buffer;
        if (keyAsString === undefined || buffer === undefined) {
          throw new Error('DynamoDB returned an undefined key or buffer');
        }
        const key = parseInt(keyAsString, 10);
        yield {
          key,
          buffer,
        };
      }
    } while (result.LastEvaluatedKey !== undefined);

    return true;
  }

  /*** PRIVATE ***/

  private readonly _maxNodeSize: number;
  private ddb: AWS.DynamoDB;
}
