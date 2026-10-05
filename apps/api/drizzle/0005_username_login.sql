-- One-time player-data reset approved for the username-login rollout.
-- Preserve game_configs and the migration journal.
TRUNCATE TABLE "match_actions", "match_players", "matches", "room_members", "rooms", "users";
--> statement-breakpoint
CREATE UNIQUE INDEX "users_human_username_unique" ON "users" USING btree (lower(btrim("display_name"))) WHERE "users"."is_bot" = false;
