const MemoryCache = require('memory-cache')
const Redis = require('ioredis')

/** Factory method
 * @param {String} topic Unique identifier for this cache
 * @param {Redis.RedisOptions|Redis.Redis} [redisOrOptions] Redis client instance or options
 * @returns {Promise.<Cache>}
 */
exports.Create = async function factory(topic, redisOrOptions) {
  const cache = new Cache(topic, redisOrOptions)
  await cache.subscribe()
  return cache
}

exports.Cache = Cache

/** Constructor
 * @param {String} topic Unique identifier for this cache
 * @param {Redis.RedisOptions|Redis.Redis} [redisOrOptions] Redis client instance or options
 */
function Cache(topic, redisOrOptions) {
  if (typeof topic !== 'string') {
    throw Error('Expected 1st argument "topic" of type string')
  }
  this.topic = topic
  this.cache = new MemoryCache.Cache()
  this.redisOptions = redisOrOptions instanceof Redis ? null : redisOrOptions
  this.redisPub = redisOrOptions instanceof Redis ? redisOrOptions : null
  this.redisSub = redisOrOptions instanceof Redis ? redisOrOptions.duplicate() : new Redis(redisOrOptions)

  this.redisSub.on('message', (channel, key) => {
    return this.cache.del(key)
  })
}

/**
 * @returns {Promise}
 */
Cache.prototype.subscribe = function () {
  return this.redisSub.subscribe(this.topic)
}

/**
 * @returns {Promise}
 */
Cache.prototype.unsubscribe = function () {
  return this.redisSub.disconnect()
}

/**
 * @param {string} key The key to get
 * @returns {*?} the value or `null`
 */
Cache.prototype.get = function (key) {
  return this.cache.get(key)
}

/**
 * @param {string} key The key to put
 * @param {*?} value The value to store
 * @param {number} [timeout] The timeout value (in ms.)
 * @returns {*?} the value being stored
 */
Cache.prototype.put = function (key, value, timeout) {
  return this.cache.put(key, value, timeout)
}

/**
 * @param {string} key The key to invalidate
 * @returns {Promise}
 */
Cache.prototype.invalidate = function (key) {
  if (this.redisPub == null) {
    this.redisPub = new Redis(this.redisOptions)
  }

  return this.redisPub.publish(this.topic, key)
}