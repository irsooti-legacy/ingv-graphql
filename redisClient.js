const redis = require('redis');
const client = redis.createClient();

module.exports = {
  client,
  useRedis: (key, next) => {
    return new Promise((resolve, reject) => {
      client.get(key, function(err, reply) {
        if (!reply || err) {
          resolve(next());
        } else {
          resolve(JSON.parse(reply));
        }
      });
    });
  },
  redisSetKey: key => (promiseObj, expiration = 10) => {
    client.set(key, JSON.stringify(promiseObj), 'EX', expiration);
    return promiseObj;
  }
};
