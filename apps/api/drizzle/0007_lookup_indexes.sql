CREATE INDEX "match_players_user_idx" ON "match_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "matches_playing_room_idx" ON "matches" USING btree ("room_id") WHERE "matches"."status" = 'playing';--> statement-breakpoint
CREATE INDEX "room_members_user_idx" ON "room_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rooms_active_created_at_idx" ON "rooms" USING btree ("created_at" DESC NULLS LAST) WHERE "rooms"."status" <> 'closed';