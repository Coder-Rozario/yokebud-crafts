CREATE TABLE IF NOT EXISTS custom_laser_orders (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NULL,
    width DECIMAL(10,2) NULL,
    height DECIMAL(10,2) NULL,
    depth DECIMAL(10,2) NULL,
    material VARCHAR(100) NULL,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_user (user_id)
);
