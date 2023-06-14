import { createClient } from 'redis';
import { NrmkRedisClient } from '../src';
import { setTimeout } from 'timers/promises';

const redisClient = createClient();

describe('NrmkRedisClient', () => {
  beforeEach(async () => {
    await redisClient.connect();
  });
  afterEach(async () => {
    await redisClient.flushAll();
    await redisClient.disconnect();
  });
  test('hSet value equal hGet value at keyType hash', async () => {
    const client = new NrmkRedisClient<{ hoge: string }>({
      keyName: 'testKey',
      redisClient,
      keyType: 'hash',
    });
    await client.hSetTypedJson({
      hoge: '2',
    });
    const ref = {
      hoge: '',
    };
    await client.hGetAllTypedJson(ref);
    expect(ref).toEqual({ hoge: '2' });
  });
  test('pub value equal sub value at keyType pubsub', async () => {
    const client = new NrmkRedisClient<{ hoge: string }>({
      keyName: 'testKey2',
      redisClient,
      keyType: 'pubsub',
    });
    const ref = {
      hoge: '',
    };
    await client.subscribeTypedJson(ref);
    await client.publishTypedJson({
      hoge: '2',
    });
    // NOTE: publishされてからsubscribeするまでのラグを考慮してsleep入れている
    await setTimeout(1000);
    expect(ref).toEqual({ hoge: '2' });
    await client.unsubscribe();
  });

  test('wrong keyType at hash throw error', async () => {
    const client = new NrmkRedisClient<{ hoge: string }>({
      keyName: 'testKey3',
      redisClient,
      keyType: 'pubsub',
    });
    expect(() =>
      client.hSetTypedJson({
        hoge: '2',
      })
    ).rejects.toThrow('pubsub is wrong keyType for hSet');
    expect(() =>
      client.hGetAllTypedJson({
        hoge: '',
      })
    ).rejects.toThrow('pubsub is wrong keyType for hGetAll');
  });
  test('wrong keyType at pubsub throw error', async () => {
    const client = new NrmkRedisClient<{ hoge: string }>({
      keyName: 'testKey4',
      redisClient,
      keyType: 'hash',
    });
    expect(() =>
      client.publishTypedJson({
        hoge: '2',
      })
    ).rejects.toThrow('hash is wrong keyType for pub');
    expect(() =>
      client.subscribeTypedJson({
        hoge: '',
      })
    ).rejects.toThrow('hash is wrong keyType for sub');
  });
});
