CREATE TABLE IF NOT EXISTS `operational_tasks` (
  `id` text PRIMARY KEY NOT NULL,
  `load_id` text REFERENCES `loads`(`id`) ON UPDATE no action ON DELETE cascade,
  `carrier_id` text REFERENCES `carriers`(`id`) ON UPDATE no action ON DELETE cascade,
  `title` text NOT NULL,
  `category` text DEFAULT 'dispatch' NOT NULL,
  `priority` text DEFAULT 'normal' NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `assignee_name` text,
  `due_at` text,
  `completed_at` text,
  `notes` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `task_load_idx` ON `operational_tasks` (`load_id`,`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `task_carrier_idx` ON `operational_tasks` (`carrier_id`,`status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `load_expenses` (
  `id` text PRIMARY KEY NOT NULL,
  `load_id` text NOT NULL REFERENCES `loads`(`id`) ON UPDATE no action ON DELETE cascade,
  `carrier_id` text NOT NULL REFERENCES `carriers`(`id`) ON UPDATE no action ON DELETE cascade,
  `category` text NOT NULL,
  `vendor_name` text,
  `amount` real NOT NULL,
  `incurred_at` text NOT NULL,
  `notes` text DEFAULT '' NOT NULL,
  `receipt_url` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `expense_load_idx` ON `load_expenses` (`load_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `expense_carrier_idx` ON `load_expenses` (`carrier_id`,`incurred_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` text PRIMARY KEY NOT NULL,
  `invoice_number` text NOT NULL UNIQUE,
  `load_id` text NOT NULL REFERENCES `loads`(`id`) ON UPDATE no action ON DELETE restrict,
  `customer_name` text NOT NULL,
  `amount` real NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `issued_at` text,
  `due_at` text,
  `paid_at` text,
  `notes` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `invoice_load_idx` ON `invoices` (`load_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `invoice_status_idx` ON `invoices` (`status`,`due_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `maintenance_tasks` (
  `id` text PRIMARY KEY NOT NULL,
  `equipment_id` text NOT NULL REFERENCES `carrier_equipment`(`id`) ON UPDATE no action ON DELETE cascade,
  `carrier_id` text NOT NULL REFERENCES `carriers`(`id`) ON UPDATE no action ON DELETE cascade,
  `title` text NOT NULL,
  `status` text DEFAULT 'scheduled' NOT NULL,
  `due_at` text,
  `completed_at` text,
  `estimated_cost` real,
  `actual_cost` real,
  `vendor_name` text,
  `notes` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `maintenance_equipment_idx` ON `maintenance_tasks` (`equipment_id`,`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `maintenance_due_idx` ON `maintenance_tasks` (`status`,`due_at`);
