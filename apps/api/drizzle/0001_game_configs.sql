CREATE TABLE "game_configs" (
	"game_type" text NOT NULL,
	"version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_configs_game_type_version_pk" PRIMARY KEY("game_type","version")
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "config_version" integer DEFAULT 1 NOT NULL;