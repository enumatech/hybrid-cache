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

  this.redisSub.on('message', (channel, msg) => {
    if (msg.action === 'invalidate') {
      return this.cache.del(msg.key)
    }
    else if (msg.action === 'invalidateAndUpdate') {
      // no need to del. just replace the object
      return this.cache.put(msg.key, msg.value, msg.timeout)
    }
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
 * @param {string} key The key to get
 * @returns {Promise.<*?>} Evaluates to the value or `null`
 */
Cache.prototype.getRedis = function (key) {
  const value = this.cache.get(key)
  if (value === null) {
    return this._redis().get(key)
      .then(value => JSON.parse(value))
  } else {
    return value
  }
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
 * @param {string} key The key to put
 * @param {*?} value The value to store
 * @param {number} [timeout] The timeout value (in ms.)
 * @returns {Promise.<*?>} Evaluates to the value being stored
 */
Cache.prototype.putRedis = function (key, value, timeout) {
  const extra = timeout ? ['PX', timeout] : []
  this._redis().set(key, JSON.stringify(value), ...extra)
    .catch(err => {
      /* istanbul ignore next */
      console.error(err.stack)
    })
  return this.cache.put(key, value, timeout)
}

/**
 * @param {string} key The key to invalidate
 * @returns {Promise}
 */
Cache.prototype.invalidate = function (key) {
  return this._redis().publish(this.topic, { action: 'invalidate', key: key })
}


/**
 * @param {string} key The key to invalidate
 * @param {*?} value The value to store
 * @param {number?} [timeout] The timeout value (in ms.)
 * @returns {Promise}
 */
Cache.prototype.invalidateAndUpdate = function (key, value, timeout) {
  return this._redis().publish(
    this.topic,
    { action: 'invalidateAndUpdate',
      key: key,
      value: value,
      timeout: timeout })
}

/**
 * @private
 * @returns {Redis.Redis}
 */
Cache.prototype._redis = function () {
  /* istanbul ignore next */
  if (this.redisPub == null) {
    this.redisPub = new Redis(this.redisOptions)
  }
  return this.redisPub
}
/**
 * @param  {string} key The key to check if exist
 * @return {Boolean} true if key is found
 */
Cache.prototype.has = function (key) {
  return this.cache.get(key) != null
}