import { RedisFlushModes, createClient } from 'redis';

type NrmkRedisClientType<U> = {
  keyName: string;
  keyType: 'hash' | 'pubsub';
  redisClient: ReturnType<typeof createClient>;
  originalRef: U;
};

type NrmkRedisFieldType = { [key: string]: any };

// NOTE: 保証するのは1つのkeyに対するI/Oを通じた構造体の保証。そのため1インスタンス1keyにする。
// JSONのパース上の値の保証は**このインスタンス経由で入れている前提のため**外部で入れたフィールドの構成は保証しない。
export class NrmkRedisClient<U extends NrmkRedisFieldType> {
  private _keyName: string;
  private _redisClient: ReturnType<typeof createClient>;
  private _redisClientForSub?: ReturnType<typeof createClient>;
  private _keyType: 'hash' | 'pubsub';
  private _originalRef: U;

  constructor({
    keyName,
    keyType,
    originalRef,
    redisClient,
  }: NrmkRedisClientType<U>) {
    this._keyName = keyName;
    this._redisClient = redisClient;
    this._keyType = keyType;
    this._originalRef = originalRef;
  }

  private _isValidTypedCacheData(parsed: any): parsed is Partial<U> {
    return Reflect.ownKeys(parsed).every((item: string | symbol) =>
      Reflect.has(this._originalRef, item)
    );
  }

  private _parseTypedJson(data: string): Partial<U> {
    const parsed = JSON.parse(data);
    if (this._isValidTypedCacheData(parsed)) {
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

  async hSetTypedJson(data: Partial<U>) {
    if (this._keyType !== 'hash') {
      throw new Error(`${this._keyType} is wrong keyType for hSet`);
    }
    await this._redisClient.hSet(this._keyName, data as NrmkRedisFieldType);
  }

  async hGetAllTypedJson(): Promise<Partial<U>> {
    if (this._keyType !== 'hash') {
      throw new Error(`${this._keyType} is wrong keyType for hGetAll`);
    }
    const result = await this._redisClient.hGetAll(this._keyName);

    if (!this._isValidTypedCacheData(result)) {
      throw new Error(
        `hGetAll json is invalid type format: ${JSON.stringify(result)}`
      );
    }
    return result;
  }

  async flushAll(mode?: RedisFlushModes): Promise<void> {
    await this._redisClient.flushAll(mode);
  }

  async publishTypedJson(data: Partial<U>) {
    if (this._keyType !== 'pubsub') {
      throw new Error(`${this._keyType} is wrong keyType for pub`);
    }
    await this._redisClient.publish(this._keyName, JSON.stringify(data));
  }

  async subscribeTypedJson(callback: (data: Partial<U>) => void) {
    if (this._keyType !== 'pubsub') {
      throw new Error(`${this._keyType} is wrong keyType for sub`);
    }
    this._redisClientForSub = await this._redisClient.duplicate();
    // NOTE: subscribeはクライアントに繋ぎっぱなしの状態を維持する必要があるので別のクライアントで対応。内部的に保持してunsubscribeで剥がせるようにする
    await this._redisClientForSub.connect();
    await this._redisClientForSub.subscribe(this._keyName, (message) => {
      const result = this._parseTypedJson(message);
      callback(result);
    });
  }
}
