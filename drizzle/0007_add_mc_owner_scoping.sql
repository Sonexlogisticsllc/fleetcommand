CREATE TABLE IF NOT EXISTS mc_owners (
  id TEXT PRIMARY KEY NOT NULL,
  owner_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  mc_number TEXT NOT NULL UNIQUE,
  dot_number TEXT,
  can_manage_leased_carriers INTEGER NOT NULL DEFAULT 0,
  primary_carrier_id TEXT,
  default_total_fee_percent REAL NOT NULL DEFAULT 18,
  default_dispatch_fee_percent REAL NOT NULL DEFAULT 8,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE carriers ADD COLUMN mc_owner_id TEXT REFERENCES mc_owners(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE carriers ADD COLUMN total_fee_percent REAL NOT NULL DEFAULT 10;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN mc_owner_id TEXT REFERENCES mc_owners(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE loads ADD COLUMN mc_owner_id TEXT REFERENCES mc_owners(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE loads ADD COLUMN total_fee_percent REAL NOT NULL DEFAULT 10;
--> statement-breakpoint
ALTER TABLE loads ADD COLUMN total_fee_amount REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE loads ADD COLUMN mc_owner_fee_amount REAL NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE carriers SET total_fee_percent = dispatch_fee_percent;
--> statement-breakpoint
UPDATE loads
SET total_fee_percent = dispatch_fee_percent,
    total_fee_amount = dispatch_fee_amount,
    mc_owner_fee_amount = 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS carriers_mc_owner_idx ON carriers(mc_owner_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS loads_mc_owner_idx ON loads(mc_owner_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS users_mc_owner_idx ON users(mc_owner_id, role);
