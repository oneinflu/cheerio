DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'delivery_status'
      AND e.enumlabel = 'accepted'
  ) THEN
    ALTER TYPE delivery_status ADD VALUE 'accepted';
  END IF;
END $$;
