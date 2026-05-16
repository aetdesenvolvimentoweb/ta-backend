ALTER TABLE "artists" ADD COLUMN "payment_gateway" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "payment_external_account_id" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "payment_access_token_enc" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "payment_refresh_token_enc" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "payment_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "payment_connected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "music_requests" ADD COLUMN "payment_gateway" text;--> statement-breakpoint
ALTER TABLE "music_requests" ADD COLUMN "payment_id" text;--> statement-breakpoint
ALTER TABLE "music_requests" ADD COLUMN "payment_status" text;