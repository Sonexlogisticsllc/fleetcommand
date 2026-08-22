CREATE INDEX IF NOT EXISTS driver_carrier_status_idx ON carrier_drivers (carrier_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS equipment_carrier_status_idx ON carrier_equipment (carrier_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS session_user_idx ON sessions (user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS load_carrier_delivery_idx ON loads (carrier_id, delivery_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS load_status_delivery_idx ON loads (status, delivery_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS load_mc_owner_delivery_idx ON loads (mc_owner_id, delivery_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS checkin_load_timestamp_idx ON load_checkins (load_id, timestamp);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cargo_photo_load_uploaded_idx ON cargo_photos (load_id, uploaded_at);
