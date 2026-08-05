-- Migration: add moq (Minimum Order Quantity) column to products
-- Run this on your MySQL database (make a backup first)
ALTER TABLE products
  ADD COLUMN moq INT NOT NULL DEFAULT 1 COMMENT 'Minimum Order Quantity' AFTER stock;

-- Optional: Backfill existing rows from metadata JSON if moq was previously stored there
-- UPDATE products SET moq = CASE
--   WHEN JSON_VALID(metadata) AND JSON_EXTRACT(metadata, '$.moq') IS NOT NULL
--     THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.moq')) AS UNSIGNED)
--   ELSE 1
-- END WHERE moq = 1;
