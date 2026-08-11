CREATE TABLE IF NOT EXISTS `load_dispatch_assignments` (
  `load_id` text PRIMARY KEY NOT NULL REFERENCES `loads`(`id`) ON UPDATE no action ON DELETE cascade,
  `dispatcher_id` text NOT NULL REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `load_dispatcher_idx` ON `load_dispatch_assignments` (`dispatcher_id`);
