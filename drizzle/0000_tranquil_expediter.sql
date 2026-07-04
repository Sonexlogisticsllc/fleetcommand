CREATE TABLE `cargo_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`load_id` text NOT NULL,
	`url` text NOT NULL,
	`stage` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`uploaded_by` text NOT NULL,
	FOREIGN KEY (`load_id`) REFERENCES `loads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `carrier_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`carrier_id` text NOT NULL,
	`doc_type` text NOT NULL,
	`file_name` text NOT NULL,
	`file_url` text NOT NULL,
	`file_path` text NOT NULL,
	`expiration_date` text,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`uploaded_by` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`carrier_id`) REFERENCES `carriers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `carrier_doc_current_idx` ON `carrier_documents` (`carrier_id`,`doc_type`,`is_current`);--> statement-breakpoint
CREATE TABLE `carrier_drivers` (
	`id` text PRIMARY KEY NOT NULL,
	`carrier_id` text NOT NULL,
	`user_id` text,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`phone` text NOT NULL,
	`license_number` text,
	`license_state` text,
	`license_class` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`carrier_id`) REFERENCES `carriers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `carrier_equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`carrier_id` text NOT NULL,
	`type` text NOT NULL,
	`equipment_type` text NOT NULL,
	`year` integer NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`vin` text NOT NULL,
	`plate` text NOT NULL,
	`state` text NOT NULL,
	`length` integer,
	`weight_capacity` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`carrier_id`) REFERENCES `carriers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `carriers` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`address` text,
	`city` text,
	`state` text,
	`zip` text,
	`has_own_authority` integer DEFAULT false NOT NULL,
	`mc_number` text,
	`dot_number` text,
	`is_leased_mc` integer DEFAULT false NOT NULL,
	`mc_holder_name` text,
	`mc_holder_mc` text,
	`insurance_type` text NOT NULL,
	`insurance_company` text,
	`insurance_policy_number` text,
	`dispatch_fee_percent` real DEFAULT 10 NOT NULL,
	`status` text DEFAULT 'onboarding' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`portal_email` text NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `carriers_portal_email_unique` ON `carriers` (`portal_email`);--> statement-breakpoint
CREATE TABLE `load_checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`load_id` text NOT NULL,
	`event` text NOT NULL,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`logged_by` text NOT NULL,
	FOREIGN KEY (`load_id`) REFERENCES `loads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `loads` (
	`id` text PRIMARY KEY NOT NULL,
	`load_number` text NOT NULL,
	`carrier_id` text NOT NULL,
	`driver_id` text,
	`equipment_id` text,
	`broker_name` text NOT NULL,
	`broker_contact` text NOT NULL,
	`broker_phone` text NOT NULL,
	`broker_email` text,
	`broker_mc` text,
	`pickup_facility` text NOT NULL,
	`pickup_address` text NOT NULL,
	`pickup_city` text NOT NULL,
	`pickup_state` text NOT NULL,
	`pickup_zip` text NOT NULL,
	`pickup_date` text NOT NULL,
	`pickup_time` text NOT NULL,
	`pickup_appt_number` text,
	`delivery_facility` text NOT NULL,
	`delivery_address` text NOT NULL,
	`delivery_city` text NOT NULL,
	`delivery_state` text NOT NULL,
	`delivery_zip` text NOT NULL,
	`delivery_date` text NOT NULL,
	`delivery_time` text NOT NULL,
	`delivery_appt_number` text,
	`commodity` text NOT NULL,
	`weight` integer NOT NULL,
	`miles` real NOT NULL,
	`rate` real NOT NULL,
	`dispatch_fee_percent` real NOT NULL,
	`dispatch_fee_amount` real NOT NULL,
	`carrier_net` real NOT NULL,
	`rate_per_mile` real NOT NULL,
	`status` text DEFAULT 'booked' NOT NULL,
	`rat_con_url` text,
	`bol_url` text,
	`pod_url` text,
	`notes` text DEFAULT '' NOT NULL,
	`free_time_minutes` integer DEFAULT 120 NOT NULL,
	`detention_hours` real DEFAULT 0 NOT NULL,
	`detention_rate` real DEFAULT 50 NOT NULL,
	`detention_revenue` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`carrier_id`) REFERENCES `carriers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `carrier_drivers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`equipment_id`) REFERENCES `carrier_equipment`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `loads_load_number_unique` ON `loads` (`load_number`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`company_name` text NOT NULL,
	`company_address` text,
	`company_city` text,
	`company_state` text,
	`company_zip` text,
	`company_email` text,
	`company_phone` text,
	`default_dispatch_fee_percent` real DEFAULT 10 NOT NULL,
	`admin_users` text DEFAULT '[]' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`carrier_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`load_ids` text NOT NULL,
	`gross_total` real NOT NULL,
	`fee_total` real NOT NULL,
	`net_total` real NOT NULL,
	`generated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`carrier_id`) REFERENCES `carriers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`display_name` text NOT NULL,
	`carrier_id` text,
	`avatar` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`carrier_id`) REFERENCES `carriers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);