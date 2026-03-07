const db = require('./db');
const bcrypt = require('bcryptjs');

async function createProfile() {
    try {
        console.log('Creating profile for Lamini Gausu...');

        const firstname = 'Lamini';
        const surname = 'Gausu';
        const email = 'Laminigausu256@outlook.com';
        const username = 'Lgausu25';
        const password = 'Justlovemygirl123@';
        
        // Account 1: Savings ISA
        // Balance: 15,918,891.00
        const isaBalance = 15918891.00;
        const isaType = 'Savings ISA';

        // Account 2: Current Account
        // Balance calculated based on history below
        const currentBalance = 2500000.00; 
        const currentType = 'Current Account';

        // 1. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 2. Create/Update Registration
        console.log('Registering user...');
        let registrationId;
        
        const checkUser = await db.query('SELECT id FROM registrations WHERE username = $1 OR email = $2', [username, email]);
        
        if (checkUser.rows.length > 0) {
            console.log('User already exists. Updating details...');
            registrationId = checkUser.rows[0].id;
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

        // Helper function
        async function createAccountWithHistory(type, targetBalance, transactions) {
            console.log(`\nProcessing ${type}...`);
            
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

            console.log(`  Generating history...`);
            let runningBalance = 0;
            
            // Sort oldest first
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

        // 3. Savings ISA Transactions (4 Years History: 2020-2024 + Late Fee)
        // Target: 15,918,891.00
        const isaTransactions = [
            { type: 'Credit', amount: 15000000.00, desc: 'Initial Deposit', daysAgo: 2100 }, // ~2020
            { type: 'Credit', amount: 500000.00, desc: 'Annual Interest Return 2021', daysAgo: 1700 },
            { type: 'Credit', amount: 300000.00, desc: 'Annual Interest Return 2022', daysAgo: 1300 },
            { type: 'Credit', amount: 100000.00, desc: 'Annual Interest Return 2023', daysAgo: 900 },
            { type: 'Credit', amount: 18941.00, desc: 'Interest Adjustment 2024', daysAgo: 500 }, // End of 2024
            { type: 'Debit', amount: 50.00, desc: 'Account Inactivity Fee', daysAgo: 30 } // Recent Fee
        ];
        await createAccountWithHistory(isaType, isaBalance, isaTransactions);

        // 4. Current Account Transactions (Investment Returns & Mortgage Debits)
        const currentTransactions = [
            { type: 'Credit', amount: 5000000.00, desc: 'Investment Return - Portfolio A', daysAgo: 2000 },
            { type: 'Debit', amount: 1000000.00, desc: 'Mortgage Payment', daysAgo: 1900 },
            { type: 'Credit', amount: 2000000.00, desc: 'Investment Return - Portfolio B', daysAgo: 1600 },
            { type: 'Debit', amount: 1000000.00, desc: 'Mortgage Payment', daysAgo: 1500 },
            { type: 'Debit', amount: 1000000.00, desc: 'Mortgage Payment', daysAgo: 1100 },
            { type: 'Debit', amount: 1000000.00, desc: 'Mortgage Payment', daysAgo: 700 },
            { type: 'Debit', amount: 499975.00, desc: 'Mortgage Payment', daysAgo: 500 }, // End of 2024
            { type: 'Debit', amount: 25.00, desc: 'Account Inactivity Fee', daysAgo: 30 } // Recent Fee
        ];
        await createAccountWithHistory(currentType, currentBalance, currentTransactions);

        console.log('Profile created successfully!');
        process.exit(0);
    } catch (err) { console.error(err); process.exit(1); }
}
createProfile();