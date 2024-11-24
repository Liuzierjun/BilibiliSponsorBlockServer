import { Request, Response } from "express";
import { getHashCache } from "../utils/getHashCache";
import { db } from "../databases/databases";
import { ActionType, Category, Service, VideoID } from "../types/segments.model";
import { UserID } from "../types/user.model";
import { getService } from "../utils/getService";
import { config } from "../config";
import { Logger } from "../utils/logger";
import { isUserVIP } from "../service/VIPUserService";

interface DeleteLockCategoriesRequest extends Request {
    body: {
        categories: Category[];
        service: string;
        userID: UserID;
        videoID: VideoID;
        actionTypes: ActionType[];
    };
}

export async function deleteLockCategoriesEndpoint(req: DeleteLockCategoriesRequest, res: Response): Promise<Response> {
    // Collect user input data
    const {
        body: {
            videoID,
            userID,
            categories,
            service,
            actionTypes
        }
    } = req;

    // Check input data is valid
    if (!videoID
        || !userID
        || !categories
        || !Array.isArray(categories)
        || categories.length === 0
        || actionTypes && !Array.isArray(actionTypes)
        || actionTypes.length === 0
    ) {
        return res.status(400).json({
            message: "Bad Format",
        });
    }

    // Check if user is VIP
    const hashedUserID = await getHashCache(userID);
    const userIsVIP = await isUserVIP(hashedUserID);

    if (!userIsVIP) {
        return res.status(403).json({
            message: "Must be a VIP to lock videos.",
        });
    }

    try {
        await deleteLockCategories(videoID, categories, actionTypes, getService(service));
    } catch (e) {
        Logger.error(e as string);
        return res.status(500);
    }

    return res.status(200).json({ message: `Removed lock categories entries for video ${videoID}` });
}

export async function deleteLockCategories(videoID: VideoID, categories: Category[], actionTypes: ActionType[], service: Service): Promise<void> {
    categories ??= config.categoryList as Category[];
    actionTypes ??= [ActionType.Skip, ActionType.Mute];

    const arrJoin = (arr: string[]): string => `'${arr.join(`','`)}'`;
    const categoryString = arrJoin(categories.filter((v) => !/[^a-z|_|-]/.test(v)));
    const actionTypeString = arrJoin(actionTypes.filter((v) => !/[^a-z|_|-]/.test(v)));

    await db.prepare("run", `DELETE FROM "lockCategories" WHERE "videoID" = ? AND "service" = ? AND "category" IN (${categoryString}) AND "actionType" IN (${actionTypeString})`, [videoID, service]);
}
