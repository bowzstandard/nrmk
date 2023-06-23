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
      originalRef: {
        name: 'bob',
        age: 20,
        active: false,
        from: '',
      },
    });
    await client.hSetTypedJson({
      name: 'henry',
    });
    const result = await client.hGetAllTypedJson();
    expect(result).toEqual({ name: 'henry' });
  });
  test('pub value equal sub value at keyType pubsub', async () => {
    const client = new NrmkRedisClient<ExampleType>({
      keyName: 'testKey2',
      redisClient,
      keyType: 'pubsub',
      originalRef: {
        name: 'bob',
        age: 20,
        active: false,
        from: '',
      },
    });
    await client.subscribeTypedJson(async (data) => {
      // NOTE: publishされてからsubscribeするまでのラグを考慮してsleep入れている
      await setTimeout(1000);
      expect(data).toEqual({ name: 'henry' });
      await client.unsubscribe();
    });
    await client.publishTypedJson({
      name: 'henry',
    });
  });

  test('wrong keyType at hash throw error', async () => {
    const client = new NrmkRedisClient<ExampleType>({
      keyName: 'testKey3',
      redisClient,
      keyType: 'pubsub',
      originalRef: {
        name: 'bob',
        age: 20,
        active: false,
        from: '',
      },
    });
    expect(() =>
      client.hSetTypedJson({
        name: 'bob',
      })
    ).rejects.toThrow('pubsub is wrong keyType for hSet');
    expect(() => client.hGetAllTypedJson()).rejects.toThrow(
      'pubsub is wrong keyType for hGetAll'
    );
  });
  test('wrong keyType at pubsub throw error', async () => {
    const client = new NrmkRedisClient<ExampleType>({
      keyName: 'testKey4',
      redisClient,
      keyType: 'hash',
      originalRef: {
        name: 'bob',
        age: 20,
        active: false,
        from: '',
      },
    });
    expect(() =>
      client.publishTypedJson({
        name: 'bob',
      })
    ).rejects.toThrow('hash is wrong keyType for pub');
    expect(() => client.subscribeTypedJson(() => {})).rejects.toThrow(
      'hash is wrong keyType for sub'
    );
  });
});
