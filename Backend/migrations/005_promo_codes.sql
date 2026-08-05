-- Promo Codes Table
CREATE TABLE IF NOT EXISTS promo_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  value DECIMAL(10, 2) NOT NULL,
  usage_limit INT NULL,
  used_count INT NOT NULL DEFAULT 0,
  user_specific TINYINT(1) NOT NULL DEFAULT 0,
  user_id VARCHAR(100) NULL,
  valid_from DATETIME NULL,
  valid_until DATETIME NULL,
  product_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Promo Code Usage Tracking Table
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  promo_code_id INT NOT NULL,
  user_id VARCHAR(100) NULL,
  order_id VARCHAR(100) NULL,
  used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE CASCADE
);
