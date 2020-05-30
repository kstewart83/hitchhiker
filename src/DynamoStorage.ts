import { IStorageDriver } from './Interfaces';
import AWS from 'aws-sdk';
import * as path from 'path';
import dotenv from 'dotenv';

export class DynamoStorage implements IStorageDriver {
  /*** PUBLIC ***/

  public readonly DataMetadataId = 0;
  public readonly TableName: string;

  public constructor(tableName: string) {
    this._maxNodeSize = 1024;
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

  maxPageSize(): number {
    return this._maxNodeSize;
  }

  async getMetadata(): Promise<Buffer | undefined> {
    const result = (
      await this.ddb
        .getItem({
          TableName: this.TableName,
          Key: {
            Index: { S: this.DataMetadataId.toString() },
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

  async putMetadata(meta: Buffer): Promise<void> {
    await this.ddb
      .putItem({
        TableName: this.TableName,
        Item: {
          Index: { S: this.DataMetadataId.toString() },
          Data: { B: meta },
        },
      })
      .promise();
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

  async free(id: number): Promise<void> {
    await this.ddb
      .deleteItem({
        TableName: this.TableName,
        Key: {
          Index: { S: id.toString() },
        },
      })
      .promise();
  }

  generator(count?: number | undefined): Generator<{ key: number; buffer: Buffer }, boolean, number> {
    throw new Error('Method not implemented.');
  }

  /*** PRIVATE ***/

  private readonly _maxNodeSize: number;
  private ddb: AWS.DynamoDB;
}
