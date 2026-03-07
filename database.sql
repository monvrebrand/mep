-- Execute this SQL to create the users table in your 'Santanderbank' database
-- This SQL script sets up the necessary tables for the Santander application in a PostgreSQL database.
-- Using "CREATE TABLE IF NOT EXISTS" ensures that existing data is not lost when the script is re-run.

-- Table for user account registrations
CREATE TABLE IF NOT EXISTS registrations (
    id SERIAL PRIMARY KEY,
    firstname VARCHAR(100),
    middlename VARCHAR(100),
    surname VARCHAR(100),
    dob DATE,
    id_number VARCHAR(50),
    address TEXT,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    account_types TEXT,
    id_document_path VARCHAR(255),
    status TEXT DEFAULT 'pending',
    email_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for contact form messages from users
CREATE TABLE IF NOT EXISTS contact_messages (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read BOOLEAN DEFAULT FALSE,
    archived BOOLEAN DEFAULT FALSE
);

-- Table for admin replies to contact messages
CREATE TABLE IF NOT EXISTS message_replies (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES contact_messages(id) ON DELETE CASCADE,
    reply_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for tracking live chat sessions
CREATE TABLE IF NOT EXISTS live_chat_sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    customer_email TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Table for storing messages within a live chat session
CREATE TABLE IF NOT EXISTS live_chat_messages (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES live_chat_sessions(session_id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL,
    sender_name TEXT,
    message TEXT NOT NULL,
    read_by_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for generated bank accounts linked to a registration
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    registration_id INTEGER NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    account_type VARCHAR(100) NOT NULL,
    account_number VARCHAR(100) UNIQUE NOT NULL,
    balance NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing account transactions
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    description TEXT,
    balance_after NUMERIC(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);