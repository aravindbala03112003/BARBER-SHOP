-- Barber Shop Database Schema
-- Compatible with MySQL 5.7+ and MySQL 8.0+

CREATE TABLE IF NOT EXISTS `appointments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `booking_reference` VARCHAR(30) NOT NULL UNIQUE,
  `customer_name` VARCHAR(100) NOT NULL,
  `customer_email` VARCHAR(150) NOT NULL,
  `customer_phone` VARCHAR(30) NOT NULL,
  `service_name` VARCHAR(100) NOT NULL,
  `barber_name` VARCHAR(100) NOT NULL DEFAULT 'Master Barber',
  `appointment_date` DATE NOT NULL,
  `appointment_time` VARCHAR(20) NOT NULL,
  `notes` TEXT NULL,
  `status` ENUM('confirmed', 'pending', 'completed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  `notification_sent` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_booking_slot` (`appointment_date`, `appointment_time`, `status`),
  INDEX `idx_date_status` (`appointment_date`, `status`),
  INDEX `idx_customer_email` (`customer_email`),
  INDEX `idx_booking_ref` (`booking_reference`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `newsletter_subscribers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `status` ENUM('subscribed', 'unsubscribed') NOT NULL DEFAULT 'subscribed',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_newsletter_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `services` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `price` DECIMAL(10,2) NOT NULL,
  `duration_minutes` INT NOT NULL DEFAULT 45,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default services if not already present
INSERT IGNORE INTO `services` (`name`, `price`, `duration_minutes`) VALUES
('Hair Cutting Style', 89.00, 45),
('Hair Washing', 35.00, 30),
('Body Treatments', 56.00, 60),
('Beauty & Spa', 27.00, 45),
('Stylist Shaving & Facial', 45.00, 40),
('Multi Hair Colors', 35.00, 60);
