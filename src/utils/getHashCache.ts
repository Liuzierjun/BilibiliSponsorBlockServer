import redis from "../service/redis/redis";
import { shaHashKey } from "../service/redis/redisKeys";
import { HashedValue } from "../types/hash.model";
import { Logger } from "../utils/logger";
import { getHash } from "../utils/getHash";
import { config } from "../config";
import { HashedIP, IPAddress } from "../types/segments.model";

const defaultedHashTimes = 5000;
const cachedHashTimes = defaultedHashTimes - 1;

export async function getHashCache<T extends string>(value: T, times = defaultedHashTimes): Promise<T & HashedValue> {
    if (times === defaultedHashTimes) {
        const hashKey = getHash(value, 1);
        const result: HashedValue = await getFromRedis(hashKey);
        return result as T & HashedValue;
    }
    return getHash(value, times);
}

async function getFromRedis<T extends string>(key: HashedValue): Promise<T & HashedValue> {
    const redisKey = shaHashKey(key);

    if (!config.redis?.disableHashCache) {
        try {
            const reply = await redis.get(redisKey);

            if (reply) {
                Logger.debug(`Got data from redis: ${reply}`);
                return reply as T & HashedValue;
            }
        } catch (err) /* istanbul ignore next */ {
            Logger.error(err as string);
        }
    }

    // Otherwise, calculate it
    const data = getHash(key, cachedHashTimes);

    if (!config.redis?.disableHashCache) {
        redis.set(redisKey, data).catch(/* istanbul ignore next */ (err) => Logger.error(err));
    }

    return data as T & HashedValue;
}

export async function getHashedIP(ip: IPAddress): Promise<HashedIP> {
    return (await getHashCache(ip + config.globalSalt)) as HashedIP;
}
