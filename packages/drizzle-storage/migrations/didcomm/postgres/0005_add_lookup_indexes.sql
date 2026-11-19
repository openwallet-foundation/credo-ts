CREATE INDEX "didcommConnection_did_idx" ON "DidcommConnection" USING btree ("context_correlation_id","did");--> statement-breakpoint
CREATE INDEX "didcommConnection_their_did_idx" ON "DidcommConnection" USING btree ("context_correlation_id","their_did");--> statement-breakpoint
CREATE INDEX "didcommMediation_recipient_keys_idx" ON "DidcommMediation" USING gin ("recipient_keys");--> statement-breakpoint
CREATE INDEX "didcommOutOfBand_recipient_key_fingerprints_idx" ON "DidcommOutOfBand" USING gin ("recipient_key_fingerprints");--> statement-breakpoint
CREATE INDEX "didcommOutOfBand_recipient_routing_key_fingerprint_idx" ON "DidcommOutOfBand" USING btree ("context_correlation_id","recipient_routing_key_fingerprint");