import { db } from "../databases/databases";
import { Feature, HashedUserID } from "../types/user.model";
import { QueryCacher } from "./queryCacher";
import { userFeatureKey } from "../service/redis/redisKeys";

export async function hasFeature(userID: HashedUserID, feature: Feature): Promise<boolean> {
    return await QueryCacher.get(async () => {
        const result = await db.prepare("get", 'SELECT "feature" from "userFeatures" WHERE "userID" = ? AND "feature" = ?', [userID, feature], { useReplica: true });
        return !!result;
    }, userFeatureKey(userID, feature));
}