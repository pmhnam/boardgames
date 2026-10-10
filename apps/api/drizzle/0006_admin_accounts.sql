ALTER TABLE "game_configs" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'player' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "game_configs" ADD CONSTRAINT "game_configs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_valid" CHECK ("users"."role" in ('player', 'admin'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_admin_has_password" CHECK ("users"."role" = 'player' or ("users"."password_hash" is not null and "users"."is_bot" = false));