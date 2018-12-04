const Hybrid = require('../index')
const Assert = require('assert')
const Redis = require('ioredis')

// Mocked Redis object with minimal pub-sub functionality
class MockPubSub extends Redis {
  constructor(store) {
    Assert.ok(Array.isArray(store.callbacks))
    super()
    this.store = store
  }
  on(topic, cb) {
    this.onMessage = cb
  }
  get(key) {
    return Promise.resolve(this.store[key] || null)
  }
  set(key, v, px, timeout) {
    this.store[key] = v
    if (timeout) setTimeout(() => delete this.store[key], timeout)
    return Promise.resolve("OK")
  }
  duplicate() {
    return new MockPubSub(this.store)
  }
  subscribe(topic) {
    this.store.callbacks.push(this.onMessage)
  }
  publish(topic, key) {
    this.store.callbacks.forEach(cb => cb(topic, key))
  }
  disconnect() {
    const index = this.store.callbacks.findIndex(cb => cb === this.onMessage)
    this.store.callbacks[index] = () => {}
  }
}

describe('Hybrid-Cache', () => {
  it('ctor checks args', () => {
    Assert.throws(() => new Hybrid.Cache(), /Expected 1st argument "topic" of type string/, 'Construction without topic should fail')
  })

  describe('with mock redis', () => {
    const Key = 'key'
    const Value = {
      rich: 'object'
    }
    const Topic = 'topic'
    let cache, backingStore

    beforeEach(async () => {
      backingStore = {callbacks:[]}
      cache = await Hybrid.Create(Topic, new MockPubSub(backingStore))
      Assert.ok(cache instanceof Hybrid.Cache, 'Construction with topic should succeed')
    })

    it('on checks arg', () => {
      Assert.throws(() => cache.on('test', () => {}), /Event name must be "invalidate"/, 'first argument not equal to "invalidate" should fail')
    })

    it('basic get/put', () => {
      Assert.strictEqual(cache.get(Key), null)
      Assert.deepStrictEqual(cache.put(Key, Value), Value)
      Assert.deepStrictEqual(cache.get(Key), Value)
    })

    it('invalidate clears the key', async () => {
      Assert.deepStrictEqual(cache.put(Key, Value), Value)
      await cache.invalidate(Key)
      Assert.strictEqual(cache.get(Key), null)
    })

    it('invalidate clears the key for every cache', async () => {
      Assert.deepStrictEqual(cache.put(Key, Value), Value)
      let cache2 = await Hybrid.Create(Topic, new MockPubSub(backingStore))
      Assert.deepStrictEqual(cache2.put(Key, Value), Value)
      await cache2.invalidate(Key)
      Assert.strictEqual(cache.get(Key), null)
      Assert.strictEqual(cache2.get(Key), null)
    })

    it('invalidate and update for every cache', async () => {
      Assert.deepStrictEqual(cache.put(Key, Value), Value)
      let cache2 = await Hybrid.Create(Topic, new MockPubSub(backingStore))
      Assert.deepStrictEqual(cache2.put(Key, Value), Value)
      const promise = new Promise( (resolve) => {
        cache2.on('invalidate', (channel, key) => {
          Assert.strictEqual(key, Key)
          Assert.strictEqual(channel, Topic)
          Assert.strictEqual(cache2.get(Key), Value)
          resolve()
        })
      })
      await cache.invalidate(Key)
      await promise
      Assert.deepStrictEqual(cache.get(Key), null)
    })

    it('can unsubscribe', async () => {
      Assert.deepStrictEqual(cache.put(Key, Value), Value)
      await cache.unsubscribe()
      await cache.invalidate(Key)
      Assert.deepStrictEqual(cache.get(Key), Value)
    })

    it('can put with timeout', async () => {
      Assert.deepStrictEqual(cache.put(Key, Value, 50), Value)
      Assert.deepStrictEqual(await cache.getRedis(Key), Value)
      await new Promise(resolve => setTimeout(resolve, 100))
      Assert.strictEqual(cache.get(Key), null)
    })

    it('asynchronous get/put', async () => {
      Assert.deepStrictEqual(await cache.putRedis(Key, Value), Value)
      Assert.deepStrictEqual(await cache.getRedis(Key), Value)
    })

    it('asynchronous get/put', async () => {
      Assert.deepStrictEqual(await cache.putRedis(Key, Value), Value)
      let cache2 = await Hybrid.Create(Topic, new MockPubSub(backingStore))
      Assert.deepStrictEqual(await cache2.getRedis(Key), Value)
    })

    it('asynchronous get/put with timeout', async () => {
      Assert.deepStrictEqual(await cache.putRedis(Key, Value, 50), Value)
      let cache2 = await Hybrid.Create(Topic, new MockPubSub(backingStore))
      Assert.deepStrictEqual(await cache2.getRedis(Key), Value)
      await new Promise(resolve => setTimeout(resolve, 100))
      Assert.strictEqual(await cache2.getRedis(Key), null)
    })
  })
})