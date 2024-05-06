const Redis = require("ioredis");

const baseRedisConfig = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDISPW,
    reconnectOnError: (err) => {
        return err.message.startsWith("read ECONNRESET");
    },
    autoResendUnfulfilledCommands: true,
    autoResubscribe: true,
    connectTimeout: 10000, // milliseconds
    enableOfflineQueue: true,
};

let redisClient = new Map();  // To manage different types of Redis clients

function getRedisClient(type = 'default') {
    const config = { ...baseRedisConfig };

    // Adjust configurations that are not allowed for bclient/subscriber
    if (type === 'bclient' || type === 'subscriber') {
        config.enableReadyCheck = false;  // Bull specific requirement
        config.maxRetriesPerRequest = null;  // Bull specific requirement
    } else {
        // Only add retryStrategy if it's not a bclient/subscriber
        config.retryStrategy = (times) => {
            return Math.min(times * 100, 3000);
        };
    }

    if (!redisClient.has(type)) {
        const client = new Redis(config);
        client.on("connect", () => {
            console.info("Connected to Redis successfully on " + type);
        });
        client.on("error", (err) => {
            console.error(`Redis connection error on ${type}: ${err}`);
        });
        redisClient.set(type, client);
    }

    return redisClient.get(type);
}

module.exports = getRedisClient;
