import { BilibiliVideoDetailView } from "../types/bilibiliViewApi.model";
import { BilibiliAPI } from "./bilibiliApi";
import { Logger } from "./logger";
import { QueryCacher } from "./queryCacher";
import { videoDetailCacheKey } from "./redisKeys";

export interface videoDetails {
    videoId: string;
    duration: number;
    authorId: string;
    authorName: string;
    title: string;
    published: number;
}

const convertFromVideoViewAPI = (videoId: string, input: BilibiliVideoDetailView): videoDetails => ({
    videoId: videoId,
    duration: input.pages.length >= 1 && input.pages[0].duration ? input.pages[0].duration : input.duration,
    authorId: input.owner.mid.toString(),
    authorName: input.owner.name,
    title: input.title,
    published: input.pubdate,
});

export function getVideoDetails(videoId: string, ignoreCache = false): Promise<videoDetails | null> {
    if (ignoreCache) {
        QueryCacher.clearKey(videoDetailCacheKey(videoId));
    }
    return QueryCacher.get(() => getVideoDetailsFromAPI(videoId), videoDetailCacheKey(videoId));
    function getVideoDetailsFromAPI(videoId: string): Promise<videoDetails> {
        return BilibiliAPI.getVideoDetailView(videoId)
            .then((data) => convertFromVideoViewAPI(videoId, data))
            .catch((e) => {
                Logger.error(e.message);
                return null;
            });
    }
}
