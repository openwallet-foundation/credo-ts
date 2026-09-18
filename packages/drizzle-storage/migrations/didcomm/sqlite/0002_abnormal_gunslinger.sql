ALTER TABLE `DidcommBasicMessage` ADD `protocol_version` text;--> statement-breakpoint
ALTER TABLE `DidcommConnection` ADD `didcomm_version` text;--> statement-breakpoint
ALTER TABLE `DidcommMediation` ADD `routing_did` text;--> statement-breakpoint
ALTER TABLE `DidcommMediation` ADD `recipient_dids` text;--> statement-breakpoint
ALTER TABLE `DidcommMediation` ADD `protocol_version` text;