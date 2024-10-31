-- sponsorTimes

CREATE INDEX IF NOT EXISTS "privateDB_sponsorTimes_v4"
    ON public."sponsorTimes" USING btree
    ("videoID" ASC NULLS LAST, "cid" ASC NULLS LAST, service COLLATE pg_catalog."default" ASC NULLS LAST, "timeSubmitted" ASC NULLS LAST);

-- votes

CREATE INDEX IF NOT EXISTS "votes_userID"
    ON public.votes USING btree
    ("UUID" COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

-- categoryVotes

CREATE INDEX IF NOT EXISTS "categoryVotes_UUID"
    ON public."categoryVotes" USING btree
    ("UUID" COLLATE pg_catalog."default" ASC NULLS LAST, "userID" COLLATE pg_catalog."default" ASC NULLS LAST, "hashedIP" COLLATE pg_catalog."default" ASC NULLS LAST, category COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

-- portVideoVotes

CREATE INDEX IF NOT EXISTS "portVideoVotes_UUID"
    ON "portVideoVotes" USING btree ("UUID", "userID");
