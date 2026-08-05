
-- Add popups table
CREATE TABLE IF NOT EXISTS popups (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  image_url TEXT,
  description TEXT,
  link_url TEXT,
  link_text VARCHAR(255) DEFAULT 'Learn More',
  auto_close_duration INT DEFAULT 10, -- in seconds
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  position VARCHAR(20) DEFAULT 'center', -- center, top-left, top-right, bottom-left, bottom-right
  display_delay INT DEFAULT 3, -- delay in seconds before showing
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);
