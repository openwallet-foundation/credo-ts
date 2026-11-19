CREATE INDEX `didcommConnection_did_idx` ON `DidcommConnection` (`context_correlation_id`,`did`);--> statement-breakpoint
CREATE INDEX `didcommConnection_their_did_idx` ON `DidcommConnection` (`context_correlation_id`,`their_did`);--> statement-breakpoint
CREATE INDEX `didcommMediation_connection_id_idx` ON `DidcommMediation` (`context_correlation_id`,`connection_id`);--> statement-breakpoint
CREATE INDEX `didcommOutOfBand_recipient_routing_key_fingerprint_idx` ON `DidcommOutOfBand` (`context_correlation_id`,`recipient_routing_key_fingerprint`);