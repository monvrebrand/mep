const db = require('./db');
const bcrypt = require('bcryptjs');

async function createProfile() {
    try {
        console.log('Creating profile for Lydia Erdmann...');

        const firstname = 'Lydia';
        const surname = 'Erdmann';
        const primaryEmail = 'erdmannlydia32@gmail.com';
        const username = 'Erlydmann';
        const password = 'Erdmann1960!';

        const currentBalance = 100000.00;
        const currentType = 'Current Account';

        // 1. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 2. Create/Update Registration
        console.log('Registering user...');
        let registrationId;

        // Check if user exists by username or email
        const checkUser = await db.query(
            'SELECT id FROM registrations WHERE username = $1 OR email = $2',
            [username, primaryEmail]
        );

        if (checkUser.rows.length > 0) {
            console.log('User already exists. Updating details...');
            registrationId = checkUser.rows[0].id;
            await db.query(`
                UPDATE registrations
                SET firstname = $1, surname = $2, password = $3, status = 'approved',
                    account_types = $4, email = $5, username = $6
                WHERE id = $7
            `, [firstname, surname, hashedPassword, currentType, primaryEmail, username, registrationId]);
        } else {
            const regResult = await db.query(`
                INSERT INTO registrations (
                    firstname, surname, email, username, password,
                    status, account_types, created_at
                ) VALUES ($1, $2, $3, $4, $5, 'approved', $6, NOW())
                RETURNING id
            `, [firstname, surname, primaryEmail, username, hashedPassword, currentType]);
            registrationId = regResult.rows[0].id;
        }

        // 3. Helper function to create/reset account & transactions
        async function createAccountWithHistory(type, targetBalance, transactions) {
            console.log(`\nProcessing ${type}...`);

            let accountId;
            let accountNumber;

            const checkAccount = await db.query(
                'SELECT id, account_number FROM accounts WHERE registration_id = $1 AND account_type = $2',
                [registrationId, type]
            );

            if (checkAccount.rows.length > 0) {
                console.log(`  Account exists. Resetting...`);
                accountId = checkAccount.rows[0].id;
                accountNumber = checkAccount.rows[0].account_number;
                await db.query('DELETE FROM transactions WHERE account_id = $1', [accountId]);
                await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [targetBalance, accountId]);
            } else {
                // Generate 923 + 5 random digits for account number
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

            console.log(`  Generating transaction history...`);
            let runningBalance = 0;

            for (const tx of transactions) {
                if (tx.type === 'Credit') {
                    runningBalance += tx.amount;
                } else {
                    runningBalance -= tx.amount;
                }

                await db.query(`
                    INSERT INTO transactions (
                        account_id, transaction_type, amount, description, balance_after, created_at
                    ) VALUES ($1, $2, $3, $4, $5, NOW())
                `, [accountId, tx.type, tx.amount, tx.desc, runningBalance]);
            }
        }

        // Single transaction requirement: Deposit by Johnson Alpert FROM Apex Universal Trust Bank (€100,000)
        const currentTransactions = [
            {
                type: 'Credit',
                amount: 100000.00,
                desc: 'Deposit by Johnson Alpert FROM Apex Universal Trust Bank'
            }
        ];

        await createAccountWithHistory(currentType, currentBalance, currentTransactions);

        console.log('\n====================================');
        console.log('✅ PROFILE CREATED SUCCESSFULLY');
        console.log('====================================');
        console.log(`Name:        ${firstname} ${surname}`);
        console.log(`Username:    ${username}`);
        console.log(`Email:       ${primaryEmail}`);
        console.log(`Password:    ${password}`);
        console.log(`Account:     ${currentType}`);
        console.log(`Balance:     100,000.00 €`);
        console.log(`Transaction: Deposit by Johnson Alpert FROM Apex Universal Trust Bank (Credit 100,000.00 €)`);
        console.log('====================================\n');

        process.exit(0);

    } catch (err) {
        console.error('❌ Error creating profile:', err);
        process.exit(1);
    }
}

createProfile();
