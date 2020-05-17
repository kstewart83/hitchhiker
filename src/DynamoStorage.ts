import { IReferenceStorage } from './Interfaces';
import BPlusTree from './BPlusTree';
import sp from 'synchronized-promise';
import AWS from 'aws-sdk';
import * as path from 'path';
import dotenv from 'dotenv';

export class DynamoStorage implements IReferenceStorage {
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
    this.getItem = sp(async (id: number) => {
      const results = await this.ddb
        .getItem({
          TableName: this.TableName,
          Key: {
            Index: { S: id.toString() },
          },
        })
        .promise();
      return results.Item?.Data.B;
    });

    this.putItem = sp(async (id: number, ref: Buffer) => {
      await this.ddb
        .putItem({
          TableName: this.TableName,
          Item: {
            Index: { S: id.toString() },
            Data: { B: ref },
          },
        })
        .promise();
    });

    this.deleteItem = sp(async (id: number) => {
      await this.ddb
        .deleteItem({
          TableName: this.TableName,
          Key: {
            Index: { S: id.toString() },
          },
        })
        .promise();
    });
  }

  maxNodeSize(): number {
    return this._maxNodeSize;
  }

  getMetadata(): Buffer | undefined {
    const result = this.getItem(this.DataMetadataId);
    if (result instanceof Buffer || result === undefined) {
      return result;
    } else {
      throw new Error('Unknown return type');
    }
  }

  putMetadata(meta: Buffer): void {
    this.putItem(this.DataMetadataId, meta);
  }

  get(id: number): Buffer | undefined {
    const result = this.getItem(id);
    if (result instanceof Buffer || result === undefined) {
      return result;
    } else {
      throw new Error('Unknown return type');
    }
  }

  put(id: number, ref: Buffer): void {
    this.putItem(id, ref);
  }

  free(id: number): Buffer | undefined {
    this.deleteItem(id);
    return undefined;
  }

  generator(count?: number | undefined): Generator<{ key: number; buffer: Buffer }, boolean, number> {
    throw new Error('Method not implemented.');
  }

  /*** PRIVATE ***/

  private readonly _maxNodeSize: number;
  private ddb: AWS.DynamoDB;
  private getItem: (id: number) => any;
  private deleteItem: (id: number) => any;
  private putItem: (id: number, ref: Buffer) => void;
}
