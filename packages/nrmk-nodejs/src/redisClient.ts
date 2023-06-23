import { createClient } from 'redis';

type NrmkRedisClientType = {
  keyName: string;
  keyType: 'hash' | 'pubsub';
  redisClient: ReturnType<typeof createClient>;
};

type NrmkRedisFieldType = { [key: string]: any };

// NOTE: 保証するのは1つのkeyに対するI/Oを通じた構造体の保証。そのため1インスタンス1keyにする。
// JSONのパース上の値の保証は**このインスタンス経由で入れている前提のため**外部で入れたフィールドの構成は保証しない。
export class NrmkRedisClient<U extends NrmkRedisFieldType> {
  private _keyName: string;
  private _redisClient: ReturnType<typeof createClient>;
  private _redisClientForSub?: ReturnType<typeof createClient>;
  private _keyType: 'hash' | 'pubsub';

  constructor(data: NrmkRedisClientType) {
    this._keyName = data.keyName;
    this._redisClient = data.redisClient;
    this._keyType = data.keyType;
  }

  validateStrictly(ref: U | Partial<U>, parsed: any): parsed is U {
    return Reflect.ownKeys(ref).every((item: string | symbol) =>
      Reflect.has(parsed, item)
    );
  }

  private _isValidOuterTypedCacheData(
    ref: Partial<U>,
    parsed: any
  ): parsed is Partial<U> {
    return Reflect.ownKeys(parsed).every((item: string | symbol) =>
      Reflect.has(ref, item)
    );
  }

  private _parseTypedJson(ref: Partial<U>, data: string): Partial<U> {
    const parsed = JSON.parse(data);
    if (this._isValidOuterTypedCacheData(ref, parsed)) {
      return parsed;
    }
    throw new Error(`parsed json is invalid type format: ${parsed}`);
  }

  async connect() {
    await this._redisClient.connect();
  }

  async disconnect() {
    await this._redisClient.disconnect();
  }

  async unsubscribe() {
    if (!this._redisClientForSub) {
      return;
    }
    await this._redisClientForSub.unsubscribe(this._keyName);
    await this._redisClientForSub.disconnect();
  }

  async hSetTypedJson(ref: Partial<U>) {
    if (this._keyType !== 'hash') {
      throw new Error(`${this._keyType} is wrong keyType for hSet`);
    }
    await this._redisClient.hSet(this._keyName, ref as NrmkRedisFieldType);
  }

  async hGetAllTypedJson(ref: Partial<U>): Promise<void> {
    if (this._keyType !== 'hash') {
      throw new Error(`${this._keyType} is wrong keyType for hGetAll`);
    }
    const result = await this._redisClient.hGetAll(this._keyName);

    if (!this._isValidOuterTypedCacheData(ref, result)) {
      throw new Error(
        `hGetAll json is invalid type format: ${JSON.stringify(result)}`
      );
    }
    ref = Object.assign(ref, result);
  }

  async publishTypedJson(ref: Partial<U>) {
    if (this._keyType !== 'pubsub') {
      throw new Error(`${this._keyType} is wrong keyType for pub`);
    }
    await this._redisClient.publish(this._keyName, JSON.stringify(ref));
  }

  async subscribeTypedJson(ref: Partial<U>) {
    if (this._keyType !== 'pubsub') {
      throw new Error(`${this._keyType} is wrong keyType for sub`);
    }
    this._redisClientForSub = await this._redisClient.duplicate();
    // NOTE: subscribeはクライアントに繋ぎっぱなしの状態を維持する必要があるので別のクライアントで対応。内部的に保持してunsubscribeで剥がせるようにする
    await this._redisClientForSub.connect();
    await this._redisClientForSub.subscribe(this._keyName, (message) => {
      const result = this._parseTypedJson(ref, message);
      ref = Object.assign(ref, result);
    });
  }
}
