const db = require('./db');
const bcrypt = require('bcryptjs');

async function createProfile() {
    try {
        console.log('Creating profile for Anthony P. Franklin...');

        const firstname = 'Anthony';
        const surname = 'P. Franklin';
        const email = 'anthony.franklin@email.com';
        const phone = '+1 555 123 4567';
        const username = 'a.franklin';
        const password = 'Password123!';
        
        // Account 1: Trust Account
        const trustBalance = 67999950.00;
        const trustType = 'Trust Fund';

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
                    account_types = $4, email = $5, username = $6, phone = $7
                WHERE id = $8
            `, [firstname, surname, hashedPassword, trustType, email, username, phone, registrationId]);
        } else {
            const regResult = await db.query(`
                INSERT INTO registrations (
                    firstname, surname, email, username, password,
                    status, account_types, phone, created_at
                ) VALUES ($1, $2, $3, $4, $5, 'approved', $6, $7, NOW())
                RETURNING id
            `, [firstname, surname, email, username, hashedPassword, trustType, phone]);
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
                accountNumber = '742' + randomPart;
                
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

        const trustTransactions = [
            { type: 'Credit', amount: 67999950.00, desc: 'APEX UNIVERSAL TRUST BANK — DEPOSIT AUTHORIZED BY MR. JOHNSON ALPERT.', daysAgo: 0 }
        ];
        await createAccountWithHistory(trustType, trustBalance, trustTransactions);

        console.log('Profile created successfully!');
        
        console.log('\n--- PROFILE DETAILS ---');
        console.log(`Name: ${firstname} ${surname}`);
        console.log(`Email: ${email}`);
        console.log(`Username: ${username}`);
        console.log(`Password: ${password}`);
        console.log(`Phone: ${phone}`);
        console.log(`Initial Deposit: $67,999,950`);
        
        process.exit(0);
    } catch (err) { console.error(err); process.exit(1); }
}
createProfile();
