const db = require('./db');

async function initDb() {
    try {
        console.log('Initializing database tables...');

        // Create registrations table
        await db.query(`
            CREATE TABLE IF NOT EXISTS registrations (
                id SERIAL PRIMARY KEY,
                firstname VARCHAR(255) NOT NULL,
                middlename VARCHAR(255),
                surname VARCHAR(255) NOT NULL,
                dob DATE,
                id_number VARCHAR(255),
                address TEXT,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(50),
                account_types VARCHAR(255),
                id_document_path VARCHAR(255),
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                email_notifications BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created registrations table');

        // Create contact_messages table
        await db.query(`
            CREATE TABLE IF NOT EXISTS contact_messages (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                subject TEXT,
                message TEXT NOT NULL,
                read BOOLEAN DEFAULT FALSE,
                archived BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created contact_messages table');

        // Add archived column if it doesn't exist (for existing databases)
        try {
            await db.query(`ALTER TABLE contact_messages ADD COLUMN archived BOOLEAN DEFAULT FALSE;`);
            console.log('Added archived column to contact_messages table');
        } catch (err) {
            if (err.code !== '42701') { // 42701 = column already exists
                throw err;
            }
        }

        // Create message_replies table
        await db.query(`
            CREATE TABLE IF NOT EXISTS message_replies (
                id SERIAL PRIMARY KEY,
                message_id INTEGER REFERENCES contact_messages(id) ON DELETE CASCADE,
                reply_text TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created message_replies table');

        // Create live_chat_sessions table
        await db.query(`
            CREATE TABLE IF NOT EXISTS live_chat_sessions (
                session_id VARCHAR(255) PRIMARY KEY,
                customer_name VARCHAR(255),
                customer_email VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                closed_at TIMESTAMP WITH TIME ZONE
            );
        `);
        console.log('Created live_chat_sessions table');

        // Create live_chat_messages table
        await db.query(`
            CREATE TABLE IF NOT EXISTS live_chat_messages (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) REFERENCES live_chat_sessions(session_id) ON DELETE CASCADE,
                sender_type VARCHAR(50) NOT NULL,
                sender_name VARCHAR(255),
                message TEXT NOT NULL,
                read_by_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created live_chat_messages table');

        // Create accounts table
        await db.query(`
            CREATE TABLE IF NOT EXISTS accounts (
                id SERIAL PRIMARY KEY,
                registration_id INTEGER NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
                account_type VARCHAR(100) NOT NULL,
                account_number VARCHAR(100) UNIQUE NOT NULL,
                balance NUMERIC(15, 2) DEFAULT 0.00,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created accounts table');

        // ensure email_notifications column exists for registrations
        await db.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE;`);


        // Create transactions table
        await db.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                transaction_type VARCHAR(50) NOT NULL,
                amount NUMERIC(15, 2) NOT NULL,
                description TEXT,
                balance_after NUMERIC(15, 2),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created transactions table');

        console.log('Database initialization complete.');
        process.exit(0);
    } catch (err) {
        console.error('Error initializing database:', err);
        process.exit(1);
    }
}

initDb();