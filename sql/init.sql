-- Banking Transactions Database Schema
-- Designed for Belgian bank statement format (Belfius)

CREATE DATABASE IF NOT EXISTS banking_transactions CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE banking_transactions;

-- Main transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- Account information
    account_number VARCHAR(50) NOT NULL,
    statement_number VARCHAR(20),
    transaction_number VARCHAR(50),
    
    -- Dates
    booking_date DATE NOT NULL,
    value_date DATE,
    
    -- Counterpart information
    counterpart_account VARCHAR(50),
    counterpart_name VARCHAR(255),
    counterpart_address TEXT,
    counterpart_postal_code VARCHAR(20),
    counterpart_city VARCHAR(100),
    
    -- Transaction details
    transaction_type VARCHAR(100),
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    
    -- Additional information
    bic VARCHAR(11),
    country_code VARCHAR(2),
    description TEXT,
    reference_number VARCHAR(100),
    
    -- Metadata
    file_hash VARCHAR(64), -- To prevent duplicate imports
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_account_date (account_number, booking_date),
    INDEX idx_counterpart (counterpart_account),
    INDEX idx_amount (amount),
    INDEX idx_booking_date (booking_date),
    INDEX idx_file_hash (file_hash),
    
    -- Unique constraint to prevent exact duplicates
    UNIQUE KEY unique_transaction (
        account_number, 
        booking_date, 
        amount, 
        counterpart_account, 
        reference_number
    )
) ENGINE=InnoDB;

-- Table for import logs
CREATE TABLE IF NOT EXISTS import_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64) NOT NULL UNIQUE,
    total_records INT DEFAULT 0,
    imported_records INT DEFAULT 0,
    skipped_records INT DEFAULT 0,
    error_records INT DEFAULT 0,
    import_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    error_message TEXT,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    INDEX idx_status (import_status),
    INDEX idx_imported_at (imported_at)
) ENGINE=InnoDB;

-- Table for categorization (future feature)
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7), -- Hex color code
    icon VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Junction table for transaction categories
CREATE TABLE IF NOT EXISTS transaction_categories (
    transaction_id BIGINT,
    category_id INT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (transaction_id, category_id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Insert some default categories
INSERT INTO categories (name, description, color) VALUES 
('Groceries', 'Food and household items', '#4CAF50'),
('Transport', 'Fuel, public transport, parking', '#2196F3'),
('Utilities', 'Electricity, gas, water, internet', '#FF9800'),
('Insurance', 'Home, car, health insurance', '#9C27B0'),
('Entertainment', 'Restaurants, movies, activities', '#E91E63'),
('Healthcare', 'Medical expenses, pharmacy', '#00BCD4'),
('Shopping', 'Clothing, electronics, general purchases', '#FF5722'),
('Income', 'Salary, bonuses, refunds', '#8BC34A'),
('Banking', 'Bank fees, transfers', '#607D8B')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Create a view for easier querying
CREATE OR REPLACE VIEW transaction_summary AS
SELECT 
    t.id,
    t.account_number,
    t.booking_date,
    t.counterpart_name,
    t.amount,
    t.currency,
    t.description,
    GROUP_CONCAT(c.name SEPARATOR ', ') as categories,
    t.imported_at
FROM transactions t
LEFT JOIN transaction_categories tc ON t.id = tc.transaction_id
LEFT JOIN categories c ON tc.category_id = c.id
GROUP BY t.id
ORDER BY t.booking_date DESC;