CREATE TABLE `file_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`expiry` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `key_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`songId` text NOT NULL,
	`codec` text NOT NULL,
	`decryptionKey` text NOT NULL
);
