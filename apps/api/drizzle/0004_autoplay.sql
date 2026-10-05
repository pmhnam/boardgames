ALTER TABLE "match_players" ADD COLUMN "autoplay_level" text;--> statement-breakpoint
ALTER TABLE "match_players" ADD COLUMN "control_version" bigint DEFAULT 0 NOT NULL;