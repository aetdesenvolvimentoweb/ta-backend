CREATE INDEX "idx_music_requests_show_id" ON "music_requests" USING btree ("show_id");--> statement-breakpoint
CREATE INDEX "idx_music_requests_payment_id" ON "music_requests" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_music_requests_status" ON "music_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_music_requests_session_show" ON "music_requests" USING btree ("customer_session_id","show_id");--> statement-breakpoint
CREATE INDEX "idx_shows_artist_id" ON "shows" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_shows_status" ON "shows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_songs_artist_id" ON "songs" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_songs_style_id" ON "songs" USING btree ("style_id");