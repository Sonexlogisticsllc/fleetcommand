CREATE TABLE IF NOT EXISTS `communication_events` (
  `id` text PRIMARY KEY NOT NULL,
  `provider` text DEFAULT 'quo' NOT NULL,
  `external_id` text NOT NULL UNIQUE,
  `event_type` text NOT NULL,
  `direction` text DEFAULT 'system' NOT NULL,
  `carrier_id` text REFERENCES `carriers`(`id`) ON UPDATE no action ON DELETE set null,
  `load_id` text REFERENCES `loads`(`id`) ON UPDATE no action ON DELETE set null,
  `contact_phone` text,
  `content` text,
  `status` text,
  `duration_seconds` integer,
  `occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `provider_payload` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `communication_carrier_idx` ON `communication_events` (`carrier_id`, `occurred_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `communication_load_idx` ON `communication_events` (`load_id`, `occurred_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `communication_phone_idx` ON `communication_events` (`contact_phone`, `occurred_at`);
