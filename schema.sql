-- Run this SQL in your Database SQL Editor to create the necessary tables

CREATE TABLE IF NOT EXISTS registrations (
    id SERIAL PRIMARY KEY,
    firstname VARCHAR(255),
    middlename VARCHAR(255),
    surname VARCHAR(255),
    dob DATE,
    id_number VARCHAR(255),
    address TEXT,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    account_types TEXT,
    id_document_path TEXT,
    username VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- approved, rejected, suspended, blocked
    email_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    registration_id INTEGER REFERENCES registrations(id),
    account_type VARCHAR(50),
    account_number VARCHAR(50) UNIQUE,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id),
    transaction_type VARCHAR(50), -- Debit, Credit
    amount DECIMAL(15, 2),
    description TEXT,
    balance_after DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_messages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    subject VARCHAR(255),
    message TEXT,
    read BOOLEAN DEFAULT FALSE,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_replies (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES contact_messages(id),
    reply_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS live_chat_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS live_chat_messages (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES live_chat_sessions(session_id) ON DELETE CASCADE,
    sender_type VARCHAR(50), -- customer, admin
    sender_name VARCHAR(255),
    message TEXT,
    read_by_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);