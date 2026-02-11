BEGIN;

-- Update existing users with a default password 'password123'
UPDATE users SET password_hash = '$2b$10$YTuzXApSN72y.9q8RpWJrOtChbj4wJl/wOrNFD2FssYpzhQVQjsXq' WHERE password_hash IS NULL;

COMMIT;
