# nrmk

typed I/O wrapper for redis

## install

```
yarn add @bowzstandard/nrmk-nodejs
```

## usage

### hash

```ts
import { NrmkRedisClient } from '@bowzstandard/nrmk-nodejs';
import { createClient } from 'redis';

type User = {
  name: string;
  age: number;
  isActive: boolean;
};

const hashClient = new NrmkRedisClient<User>({
  // specifies that this key has a hash field
  keyType: 'hash',
  // Target redis key
  keyName: 'userSettings',
  redisClient: createClient(),
  // originalRef is subject to generic type constraints
  // Use originalRef to perform type checking when fetching subsequent data
  originalRef: {
    name: 'Bob',
    age: 10,
    isActive: false,
  },
});

// connect to redis by redis client
await hashClient.connect();

// Returns the value returned by hGetAll with a type. The returned type is Partial<User>.
const data = await hashClient.hGetAllTypedJson();

// Checks the type of the value passed during hSet. The value that can be taken as an argument is Partial<User>.
await hashClient.hSetTypedJson({ age: 25 });

// flushAll
await hashClient.flushAll();

// disconnect to redis by redis client
await hashClient.disconnect();
```

### pubsub

```ts
import { NrmkRedisClient } from '@bowzstandard/nrmk-nodejs';
import { createClient } from 'redis';

type User = {
  name: string;
  age: number;
  isActive: boolean;
};

const hashClient = new NrmkRedisClient<User>({
  // Specifies that this key is for pubsub
  keyType: 'pubsub',
  // Target redis key
  keyName: 'userSettings',
  redisClient: createClient(),
  // originalRef is subject to generic type constraints
  // Use originalRef to perform type checking when fetching subsequent data
  originalRef: {
    name: 'Bob',
    age: 10,
    isActive: false,
  },
});

// connect to redis by redis client
await hashClient.connect();

await client.subscribeTypedJson(async (data) => {
  // Partial <User> is guaranteed for the data received at this time
  // receive will { name: 'henry' }
  console.log(data);

  // unsubscribe and disconnect
  await client.unsubscribe();
});

// Checks the type of the value passed during publish. The value that can be taken as an argument is Partial<User>.
await client.publishTypedJson({
  name: 'henry',
});
```
