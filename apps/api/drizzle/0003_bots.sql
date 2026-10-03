ALTER TABLE "match_players" ADD COLUMN "bot_level" text;--> statement-breakpoint
ALTER TABLE "room_members" ADD COLUMN "bot_level" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_bot" boolean DEFAULT false NOT NULL;