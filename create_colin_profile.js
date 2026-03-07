const db = require('./db');
const bcrypt = require('bcryptjs');

async function createProfile() {
    try {
        console.log('Creating profile for Colin Heath...');

        const firstname = 'Colin';
        const surname = 'Heath';
        const email = 'coleheath525@gmail.com';
        const username = 'Cheath';
        const password = 'HeathC19@';
        const balance = 5250000.00;
        const accountType = 'Savings';

        // 1. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 2. Create Registration
        console.log('Registering user...');
        let registrationId;
        
        // Check if user exists to avoid duplicate key error
        const checkUser = await db.query('SELECT id FROM registrations WHERE username = $1 OR email = $2', [username, email]);
        
        if (checkUser.rows.length > 0) {
            console.log('User already exists. Updating existing user details...');
            registrationId = checkUser.rows[0].id;
            // Update details to match request
            await db.query(`
                UPDATE registrations 
                SET firstname = $1, surname = $2, password = $3, status = 'approved', account_types = $4, email = $5, username = $6
                WHERE id = $7
            `, [firstname, surname, hashedPassword, accountType, email, username, registrationId]);
        } else {
            const regResult = await db.query(`
                INSERT INTO registrations (
                    firstname, surname, email, username, password, 
                    status, account_types, created_at
                ) VALUES ($1, $2, $3, $4, $5, 'approved', $6, NOW())
                RETURNING id
            `, [firstname, surname, email, username, hashedPassword, accountType]);
            registrationId = regResult.rows[0].id;
        }

        // 3. Create Account
        console.log('Creating account...');
        // Check if account exists for this user
        const checkAccount = await db.query('SELECT id FROM accounts WHERE registration_id = $1 AND account_type = $2', [registrationId, accountType]);
        
        let accountId;
        let accountNumber;

        if (checkAccount.rows.length > 0) {
            console.log('Account already exists. Resetting balance and history...');
            accountId = checkAccount.rows[0].id;
            
            // Clear old transactions for a clean slate
            await db.query('DELETE FROM transactions WHERE account_id = $1', [accountId]);
            await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [balance, accountId]);
            
            // Get account number
            const accDetails = await db.query('SELECT account_number FROM accounts WHERE id = $1', [accountId]);
            accountNumber = accDetails.rows[0].account_number;
        } else {
            // Generate account number: 923 + 5 random digits
            const randomPart = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
            accountNumber = '923' + randomPart;

            const accResult = await db.query(`
                INSERT INTO accounts (
                    registration_id, account_type, account_number, balance, created_at
                ) VALUES ($1, $2, $3, $4, NOW())
                RETURNING id
            `, [registrationId, accountType, accountNumber, balance]);
            accountId = accResult.rows[0].id;
        }
        
        console.log(`Savings Account Number: ${accountNumber}`);

        // 4. Create Transactions
        console.log('Generating transaction history...');
        
        // Transactions that sum up to 5,250,000.00
        // 5,000,000 + 200,000 + 55,000 - 5,000 = 5,250,000
        const transactions = [
            { type: 'Credit', amount: 5000000.00, desc: 'International Transfer - CH Holdings', daysAgo: 45 },
            { type: 'Credit', amount: 200000.00, desc: 'Dividend Payout Q1', daysAgo: 30 },
            { type: 'Credit', amount: 55000.00, desc: 'Consulting Fees', daysAgo: 15 },
            { type: 'Debit', amount: 5000.00, desc: 'Harrods London', daysAgo: 5 }
        ];
        
        let runningBalance = 0;
        
        // Sort by date (oldest first)
        transactions.sort((a, b) => b.daysAgo - a.daysAgo);

        for (const tx of transactions) {
            const txDate = new Date();
            txDate.setDate(txDate.getDate() - tx.daysAgo);
            
            if (tx.type === 'Credit') {
                runningBalance += tx.amount;
            } else {
                runningBalance -= tx.amount;
            }
            
            await db.query(`
                INSERT INTO transactions (
                    account_id, transaction_type, amount, description, balance_after, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [accountId, tx.type, tx.amount, tx.desc, runningBalance, txDate]);
        }

        console.log('Profile created successfully!');
        console.log(`Username: ${username}`);
        console.log(`Password: ${password}`);
        console.log(`Balance: £${balance.toLocaleString()}`);
        
        process.exit(0);

    } catch (err) {
        console.error('Error creating profile:', err);
        process.exit(1);
    }
}

createProfile();