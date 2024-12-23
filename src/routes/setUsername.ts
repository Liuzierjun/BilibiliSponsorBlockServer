import { Request, Response } from "express";
import { config } from "../config";
import { db, privateDB } from "../databases/databases";
import { ContentModerationApi } from "../service/api/ContenModerationApi";
import { isUserBanned } from "../service/checkBan";
import { HashedUserID } from "../types/user.model";
import { getHashCache } from "../utils/HashCacheUtil";
import { Logger } from "../utils/logger";
import { acquireLock } from "../service/redis/redisLock";

function logUserNameChange(userID: string, newUserName: string, oldUserName: string, updatedByAdmin: boolean): Promise<Response> {
    return privateDB.prepare(
        "run",
        `INSERT INTO "userNameLogs"("userID", "newUserName", "oldUserName", "updatedByAdmin", "updatedAt") VALUES(?, ?, ?, ?, ?)`,
        [userID, newUserName, oldUserName, +updatedByAdmin, new Date().getTime()]
    );
}

export async function setUsername(req: Request, res: Response): Promise<Response> {
    const userIDInput = req.query.userID as string;
    const adminUserIDInput = req.query.adminUserID as string;
    let userName = req.query.username as string;
    let hashedUserID: HashedUserID;

    if (userIDInput == undefined || userName == undefined || userIDInput === "undefined" || userName.length > 64) {
        //invalid request
        return res.sendStatus(400);
    }

    const timings = [Date.now()];

    // remove unicode control characters from username (example: \n, \r, \t etc.)
    // source: https://en.wikipedia.org/wiki/Control_character#In_Unicode
    // eslint-disable-next-line no-control-regex
    userName = userName.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

    try {
        timings.push(Date.now());

        if (adminUserIDInput != undefined) {
            //this is the admin controlling the other users account, don't hash the controling account's ID
            hashedUserID = userIDInput as HashedUserID;

            if ((await getHashCache(adminUserIDInput)) != config.adminUserID) {
                //they aren't the admin
                return res.sendStatus(403);
            }
        } else {
            // check privateID against publicID
            if (!(await checkPrivateUsername(userName, userIDInput))) {
                return res.sendStatus(400);
            }
            //hash the userID
            hashedUserID = (await getHashCache(userIDInput)) as HashedUserID;

            timings.push(Date.now());

            // check if the username is locked
            const row = await db.prepare("get", `SELECT count(*) as "userCount" FROM "userNames" WHERE "userID" = ? AND "locked" = 1`, [
                hashedUserID,
            ]);
            if (row.userCount > 0) {
                return res.sendStatus(200);
            }

            timings.push(Date.now());

            if (await isUserBanned(hashedUserID)) {
                return res.sendStatus(200);
            }

            // check username moderator
            if (!adminUserIDInput) {
                const lock = await acquireLock(`lock.setUsername:${hashedUserID}`, 10 * 60);
                if (!lock.status) {
                    return res.status(429).send("只能每十分钟修改一次用户名");
                }
            }
            const moderatorCheck = await ContentModerationApi.checkNickname(userName);
            if (!moderatorCheck) {
                return res.status(401).send("用户名不符合规范");
            }
        }
    } catch (error) /* istanbul ignore next */ {
        Logger.error(error as string);
        return res.sendStatus(500);
    }

    try {
        //check if username is already set
        const row = await db.prepare("get", `SELECT "userName" FROM "userNames" WHERE "userID" = ? LIMIT 1`, [hashedUserID]);
        const locked = adminUserIDInput === undefined ? 0 : 1;
        let oldUserName = "";

        timings.push(Date.now());

        if (row?.userName !== undefined) {
            //already exists, update this row
            oldUserName = row.userName;
            if (userName == hashedUserID && !locked) {
                await db.prepare("run", `DELETE FROM "userNames" WHERE "userID" = ?`, [hashedUserID]);
            } else {
                await db.prepare("run", `UPDATE "userNames" SET "userName" = ?, "locked" = ? WHERE "userID" = ?`, [
                    userName,
                    locked,
                    hashedUserID,
                ]);
            }
        } else {
            //add to the db
            await db.prepare("run", `INSERT INTO "userNames"("userID", "userName", "locked") VALUES(?, ?, ?)`, [
                hashedUserID,
                userName,
                locked,
            ]);
        }

        timings.push(Date.now());

        await logUserNameChange(hashedUserID, userName, oldUserName, adminUserIDInput !== undefined);

        timings.push(Date.now());

        return res.status(200).send(timings.join(", "));
    } catch (err) /* istanbul ignore next */ {
        Logger.error(err as string);
        return res.sendStatus(500);
    }
}

async function checkPrivateUsername(username: string, userID: string): Promise<boolean> {
    if (username == userID) return false;
    if (username.length <= config.minUserIDLength) return true; // don't check for cross matches <= 30 characters
    const userNameHash = await getHashCache(username);
    const userNameRow = await db.prepare("get", `SELECT "userID" FROM "userNames" WHERE "userID" = ? LIMIT 1`, [userNameHash]);
    if (userNameRow?.userID) return false;
    return true;
}
