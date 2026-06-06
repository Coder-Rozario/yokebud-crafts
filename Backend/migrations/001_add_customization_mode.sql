-- Migration: add customization_mode column to products
-- Run this on your MySQL database (make a backup first)
ALTER TABLE products
  ADD COLUMN customization_mode VARCHAR(64) NULL DEFAULT NULL;

-- Optional: set a default for existing rows (example: 'normal_engraving')
-- UPDATE products SET customization_mode = 'normal_engraving' WHERE customization_mode IS NULL;
