
ALTER TABLE `products`
ADD COLUMN `allow_customer_size_adjustment` TINYINT(1) DEFAULT 0
AFTER `customization_dimensions`;
