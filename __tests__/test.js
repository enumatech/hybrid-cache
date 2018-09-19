const Hybrid = require('../index')
const Assert = require('assert')
const Redis = require('ioredis')

// Mocked Redis object with minimal pub-sub functionality
class MockPubSub extends Redis {
  constructor(callbacks) {
    super()
    this.callbacks = callbacks
  }
  on(topic, cb) {
    this.onMessage = cb
  }
  duplicate() {
    return new MockPubSub(this.callbacks)
  }
  subscribe(topic) {
    this.callbacks.push(this.onMessage)
  }
  publish(topic, key) {
    this.callbacks.forEach(cb => cb(topic, key))
  }
  disconnect() {
    const index = this.callbacks.findIndex(cb => cb === this.onMessage)
    this.callbacks[index] = () => {}
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
      backingStore = []
      cache = await Hybrid.Create(Topic, new MockPubSub(backingStore))
      Assert.ok(cache instanceof Hybrid.Cache, 'Construction with topic should succeed')
    })

    it('basic get/put', async () => {
      Assert.strictEqual(cache.get(Key), null)
      Assert.strictEqual(cache.put(Key, Value), Value)
      Assert.strictEqual(cache.get(Key), Value)
    })

    it('invalidate clears the key', async () => {
      Assert.strictEqual(cache.put(Key, Value), Value)
      await cache.invalidate(Key)
      Assert.strictEqual(cache.get(Key), null)
    })

    it('invalidate clears the key for every cache', async () => {
      Assert.strictEqual(cache.put(Key, Value), Value)
      let cache2 = await Hybrid.Create(Topic, new MockPubSub(backingStore))
      Assert.strictEqual(cache2.put(Key, Value), Value)
      await cache2.invalidate(Key)
      Assert.strictEqual(cache.get(Key), null)
      Assert.strictEqual(cache2.get(Key), null)
    })

    it('can unsubscribe', async () => {
      Assert.strictEqual(cache.put(Key, Value), Value)
      await cache.unsubscribe()
      await cache.invalidate(Key)
      Assert.strictEqual(cache.get(Key), Value)
    })
  })
})