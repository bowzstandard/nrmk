import { createClient } from 'redis';
import { NrmkRedisClient } from '../src';
import { setTimeout } from 'timers/promises';

const redisClient = createClient();

type ExampleType = {
  name: string;
  age: number;
  from: string;
  active: boolean;
};

describe('NrmkRedisClient', () => {
  beforeEach(async () => {
    await redisClient.connect();
  });
  afterEach(async () => {
    await redisClient.flushAll();
    await redisClient.disconnect();
  });
  test('hSet value equal hGet value at keyType hash', async () => {
    const client = new NrmkRedisClient<ExampleType>({
      keyName: 'testKey',
      redisClient,
      keyType: 'hash',
    });
    await client.hSetTypedJson({
      name: 'henry',
    });
    const ref = {
      name: 'bob',
      age: 20,
    };
    await client.hGetAllTypedJson(ref);
    expect(ref).toEqual({ name: 'henry', age: 20 });
  });
  test('pub value equal sub value at keyType pubsub', async () => {
    const client = new NrmkRedisClient<ExampleType>({
      keyName: 'testKey2',
      redisClient,
      keyType: 'pubsub',
    });
    const ref = {
      name: 'bob',
      age: 20,
    };
    await client.subscribeTypedJson(ref);
    await client.publishTypedJson({
      name: 'henry',
    });
    // NOTE: publishされてからsubscribeするまでのラグを考慮してsleep入れている
    await setTimeout(1000);
    expect(ref).toEqual({ name: 'henry', age: 20 });
    await client.unsubscribe();
  });

  test('wrong keyType at hash throw error', async () => {
    const client = new NrmkRedisClient<ExampleType>({
      keyName: 'testKey3',
      redisClient,
      keyType: 'pubsub',
    });
    expect(() =>
      client.hSetTypedJson({
        name: 'bob',
      })
    ).rejects.toThrow('pubsub is wrong keyType for hSet');
    expect(() =>
      client.hGetAllTypedJson({
        name: 'bob',
      })
    ).rejects.toThrow('pubsub is wrong keyType for hGetAll');
  });
  test('wrong keyType at pubsub throw error', async () => {
    const client = new NrmkRedisClient<ExampleType>({
      keyName: 'testKey4',
      redisClient,
      keyType: 'hash',
    });
    expect(() =>
      client.publishTypedJson({
        name: 'bob',
      })
    ).rejects.toThrow('hash is wrong keyType for pub');
    expect(() =>
      client.subscribeTypedJson({
        name: 'bob',
      })
    ).rejects.toThrow('hash is wrong keyType for sub');
  });
});
