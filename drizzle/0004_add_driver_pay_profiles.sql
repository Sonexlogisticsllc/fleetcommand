CREATE TABLE IF NOT EXISTS `driver_pay_profiles` (
  `driver_id` text PRIMARY KEY NOT NULL REFERENCES `carrier_drivers`(`id`) ON UPDATE no action ON DELETE cascade,
  `pay_type` text DEFAULT 'per_mile' NOT NULL,
  `pay_rate` real DEFAULT 0 NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `driver_pay_type_idx` ON `driver_pay_profiles` (`pay_type`);
