const db = require('./db');
const bcrypt = require('bcryptjs');

function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateTransactions(accountId, targetBalance, count, accountType) {
    const transactions = [];
    let netChange = 0;

    const mainDescs = [
        { type: 'Debit', text: 'TESCO STORES', min: 10, max: 150 },
        { type: 'Debit', text: 'SAINSBURYS', min: 15, max: 200 },
        { type: 'Debit', text: 'AMAZON UK', min: 5, max: 300 },
        { type: 'Debit', text: 'UBER EATS', min: 15, max: 60 },
        { type: 'Debit', text: 'BRITISH GAS', min: 60, max: 250 },
        { type: 'Debit', text: 'THAMES WATER', min: 30, max: 100 },
        { type: 'Credit', text: 'SALARY BACS', min: 4500, max: 6000 },
        { type: 'Debit', text: 'APPLE PAY', min: 2, max: 50 },
        { type: 'Debit', text: 'MORTGAGE PAYMENT', min: 1500, max: 2500 }
    ];

    const invDescs = [
        { type: 'Credit', text: 'DIVIDEND PAYMENT', min: 50, max: 800 },
        { type: 'Credit', text: 'MONTHLY DEPOSIT', min: 500, max: 2000 },
        { type: 'Debit', text: 'PLATFORM FEE', min: 5, max: 25 },
        { type: 'Debit', text: 'WITHDRAWAL', min: 1000, max: 5000 },
        { type: 'Credit', text: 'BOND INTEREST', min: 100, max: 400 }
    ];

    const descs = accountType === 'Current Account' ? mainDescs : invDescs;

    for (let i = 0; i < count; i++) {
        const descTmpl = descs[Math.floor(Math.random() * descs.length)];
        const amount = +(Math.random() * (descTmpl.max - descTmpl.min) + descTmpl.min).toFixed(2);
        
        if (descTmpl.type === 'Debit') {
            netChange -= amount;
        } else {
            netChange += amount;
        }

        transactions.push({
            type: descTmpl.type,
            amount: amount,
            desc: descTmpl.text,
            date: randomDate(new Date('2024-01-01'), new Date())
        });
    }

    // Sort by date ascending
    transactions.sort((a, b) => a.date - b.date);

    let currentBalance = targetBalance - netChange;
    const finalTransactions = [];

    for (const tx of transactions) {
        if (tx.type === 'Debit') {
            currentBalance -= tx.amount;
        } else {
            currentBalance += tx.amount;
        }
        finalTransactions.push({
            ...tx,
            balanceAfter: +currentBalance.toFixed(2)
        });
    }

    return finalTransactions;
}

async function generateUniqueAccountNumber() {
    let accountNumber;
    let isUnique = false;
    while (!isUnique) {
        const randomPart = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
        accountNumber = '923' + randomPart;
        const { rows } = await db.query('SELECT id FROM accounts WHERE account_number = $1', [accountNumber]);
        if (rows.length === 0) {
            isUnique = true;
        }
    }
    return accountNumber;
}

async function seedSimon() {
    try {
        console.log('Seeding Simon Harris account...');

        // Check if exists and delete
        await db.query('DELETE FROM registrations WHERE email = $1', ['Simonharris@yahoo.com']);

        // Create User
        const hashedPassword = await bcrypt.hash('Password123!', 10);
        const regQuery = `
            INSERT INTO registrations (
                firstname, surname, email, phone, address, username, password, status, account_types, email_notifications
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
        `;
        const regValues = [
            'Simon', 'Harris', 'Simonharris@yahoo.com', '+44 7911 123456', 
            '124 Baker Street, London, NW1 5LA, United Kingdom', 'sharris', 
            hashedPassword, 'approved', 'Current Account, Investment Account', true
        ];
        
        const regRes = await db.query(regQuery, regValues);
        const userId = regRes.rows[0].id;
        console.log('Created user Simon Harris with ID:', userId);

        // Create Current Account
        const mainAccNum = await generateUniqueAccountNumber();
        const mainBal = 1094920.00;
        const mainAccRes = await db.query(
            'INSERT INTO accounts (registration_id, account_type, account_number, balance) VALUES ($1, $2, $3, $4) RETURNING id',
            [userId, 'Current Account', mainAccNum, mainBal]
        );
        const mainAccId = mainAccRes.rows[0].id;

        // Create Investment Account
        const invAccNum = await generateUniqueAccountNumber();
        const invBal = 175002.97;
        const invAccRes = await db.query(
            'INSERT INTO accounts (registration_id, account_type, account_number, balance) VALUES ($1, $2, $3, $4) RETURNING id',
            [userId, 'Investment Account', invAccNum, invBal]
        );
        const invAccId = invAccRes.rows[0].id;

        console.log(`Created Accounts: Main (${mainAccNum}), Investment (${invAccNum})`);

        // Generate Transactions
        const mainTx = generateTransactions(mainAccId, mainBal, 350, 'Current Account');
        const invTx = generateTransactions(invAccId, invBal, 120, 'Investment Account');

        // Insert Main Transactions
        for (const tx of mainTx) {
            await db.query(
                `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [mainAccId, tx.type, tx.amount, tx.desc, tx.balanceAfter, tx.date.toISOString()]
            );
        }

        // Insert Inv Transactions
        for (const tx of invTx) {
            await db.query(
                `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [invAccId, tx.type, tx.amount, tx.desc, tx.balanceAfter, tx.date.toISOString()]
            );
        }

        console.log('Successfully seeded active transaction history for 2024-2026!');
        process.exit(0);

    } catch (err) {
        console.error('Error seeding data:', err);
        process.exit(1);
    }
}

seedSimon();
