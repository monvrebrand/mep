const db = require('./db');
const bcrypt = require('bcryptjs');

async function createProfile() {
    try {
        console.log('Creating profile for Mr. Colin Heath...');

        const firstname = 'Colin';
        const surname = 'Heath';
        const email = 'coleheath525@gmail.com';
        const username = 'Cheath';
        const password = 'HeathC19@';
        
        // Account 1: Savings ISA
        const isaBalance = 5250000.00;
        const isaType = 'Savings ISA';

        // Account 2: Current Account (Investment Returns)
        const currentBalance = 790090.00;
        const currentType = 'Current Account';

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
                SET firstname = $1, surname = $2, password = $3, status = 'approved',
                    account_types = $4, email = $5, username = $6
                WHERE id = $7
            `, [firstname, surname, hashedPassword, `${isaType}, ${currentType}`, email, username, registrationId]);
        } else {
            const regResult = await db.query(`
                INSERT INTO registrations (
                    firstname, surname, email, username, password,
                    status, account_types, created_at
                ) VALUES ($1, $2, $3, $4, $5, 'approved', $6, NOW())
                RETURNING id
            `, [firstname, surname, email, username, hashedPassword, `${isaType}, ${currentType}`]);
            registrationId = regResult.rows[0].id;
        }

        // Helper function to create account and transactions
        async function createAccountWithHistory(type, targetBalance, transactions) {
            console.log(`\nProcessing ${type}...`);
            
            // Check/Create Account
            let accountId;
            let accountNumber;
            
            const checkAccount = await db.query('SELECT id, account_number FROM accounts WHERE registration_id = $1 AND account_type = $2', [registrationId, type]);
            
            if (checkAccount.rows.length > 0) {
                console.log(`  Account exists. Resetting...`);
                accountId = checkAccount.rows[0].id;
                accountNumber = checkAccount.rows[0].account_number;
                await db.query('DELETE FROM transactions WHERE account_id = $1', [accountId]);
                await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [targetBalance, accountId]);
            } else {
                // Generate 923 + 5 random digits
                const randomPart = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
                accountNumber = '923' + randomPart;
                
                const accResult = await db.query(`
                    INSERT INTO accounts (
                        registration_id, account_type, account_number, balance, created_at
                    ) VALUES ($1, $2, $3, $4, NOW())
                    RETURNING id
                `, [registrationId, type, accountNumber, targetBalance]);
                accountId = accResult.rows[0].id;
            }
            console.log(`  Account Number: ${accountNumber}`);

            // Insert Transactions
            console.log(`  Generating history...`);
            let runningBalance = 0;
            
            // Sort oldest first for calculation
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
        }

        // 3. Define Transactions for Savings ISA (£5,250,000.00) - 4 Months History
        const isaTransactions = [
            { type: 'Credit', amount: 5000000.00, desc: 'Initial Transfer - CH Capital', daysAgo: 120 },
            { type: 'Credit', amount: 150000.00, desc: 'Quarterly Interest', daysAgo: 90 },
            { type: 'Credit', amount: 50000.00, desc: 'Deposit', daysAgo: 60 },
            { type: 'Credit', amount: 50000.00, desc: 'Monthly Interest', daysAgo: 30 }
        ];
        // 5,000,000 + 150,000 + 50,000 + 50,000 = 5,250,000

        await createAccountWithHistory(isaType, isaBalance, isaTransactions);

        // 4. Define Transactions for Current Account (£790,090.00) - Investment Returns
        const currentTransactions = [
            { type: 'Credit', amount: 400000.00, desc: 'Investment Return - Global Tech Fund', daysAgo: 100 },
            { type: 'Credit', amount: 250000.00, desc: 'Dividend Payout - Shell PLC', daysAgo: 75 },
            { type: 'Credit', amount: 100000.00, desc: 'Bond Maturity Yield', daysAgo: 45 },
            { type: 'Credit', amount: 40090.00, desc: 'Stock Sale Proceeds', daysAgo: 10 }
        ];
        // 400,000 + 250,000 + 100,000 + 40,090 = 790,090

        await createAccountWithHistory(currentType, currentBalance, currentTransactions);

        console.log('Profile created successfully!');
        console.log(`Username: ${username}`);
        console.log(`Password: ${password}`);
        
        process.exit(0);

    } catch (err) {
        console.error('Error creating profile:', err);
        process.exit(1);
    }
}

createProfile();