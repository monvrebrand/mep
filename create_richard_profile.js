const db = require('./db');
const bcrypt = require('bcryptjs');

async function createProfile() {
    try {
        console.log('Creating profile for Dick-Richard C Rees...');

        const firstname = 'Dick-Richard C';
        const middlename = 'C';
        const surname = 'Rees';
        const email = 'Joanababy181@gmail.com';
        const username = 'Richrees';
        const rawPassword = 'GodsTime@23';
        const phone = '+1 (555) 749-2180';
        const address = '1048 Fifth Avenue, , Dallas, TX ';
        const transactionCode = '849201736';
        const accountType = 'Current Account';
        const finalTargetBalance = 10000000.00; // $10,000,000.00

        // 1. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(rawPassword, salt);

        // Account registration date: 2 years ago (730 days ago)
        const accountCreatedDate = new Date();
        accountCreatedDate.setDate(accountCreatedDate.getDate() - 730);

        // 2. Check and Create/Update Registration
        console.log('Registering user in registrations table...');
        let registrationId;

        const checkUser = await db.query(
            'SELECT id FROM registrations WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (checkUser.rows.length > 0) {
            console.log('User already exists. Updating registration...');
            registrationId = checkUser.rows[0].id;
            await db.query(`
                UPDATE registrations
                SET firstname = $1, middlename = $2, surname = $3, password = $4, status = 'approved',
                    account_types = $5, email = $6, username = $7, phone = $8, address = $9,
                    email_notifications = TRUE, transaction_code = $10
                WHERE id = $11
            `, [firstname, middlename, surname, hashedPassword, accountType, email, username, phone, address, transactionCode, registrationId]);
        } else {
            const regResult = await db.query(`
                INSERT INTO registrations (
                    firstname, middlename, surname, email, username, password,
                    status, account_types, phone, address, email_notifications,
                    transaction_code, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7, $8, $9, TRUE, $10, $11)
                RETURNING id
            `, [firstname, middlename, surname, email, username, hashedPassword, accountType, phone, address, transactionCode, accountCreatedDate]);
            registrationId = regResult.rows[0].id;
        }

        console.log(`Registration ID: ${registrationId}`);

        // 3. Create or Update Account
        let accountId;
        let accountNumber;

        const checkAccount = await db.query(
            'SELECT id, account_number FROM accounts WHERE registration_id = $1 AND account_type = $2',
            [registrationId, accountType]
        );

        if (checkAccount.rows.length > 0) {
            console.log('Account exists. Resetting account balance and transactions...');
            accountId = checkAccount.rows[0].id;
            accountNumber = checkAccount.rows[0].account_number;
            await db.query('DELETE FROM transactions WHERE account_id = $1', [accountId]);
            await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [finalTargetBalance, accountId]);
        } else {
            // Generate unique 923-prefixed 8-digit account number
            let isUnique = false;
            while (!isUnique) {
                const randomPart = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
                accountNumber = '923' + randomPart;
                const { rows } = await db.query('SELECT id FROM accounts WHERE account_number = $1', [accountNumber]);
                if (rows.length === 0) isUnique = true;
            }

            const accResult = await db.query(`
                INSERT INTO accounts (
                    registration_id, account_type, account_number, balance, created_at
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `, [registrationId, accountType, accountNumber, finalTargetBalance, accountCreatedDate]);
            accountId = accResult.rows[0].id;
        }

        console.log(`Account ID: ${accountId}, Account Number: ${accountNumber}`);

        // 4. Generate 2-Year Transaction History ending exactly at $10,000,000.00
        console.log('Generating 2-year realistic transaction history...');

        // Curated set of transactions spanning from day 720 ago up to day 2 ago (approx 24 months)
        const rawHistory = [
            // Month 1 (Nov 2024) - Days 720 to 695
            { daysAgo: 720, type: 'Credit', amount: 8500000.00, desc: 'Initial Wire Deposit - Rees Global Capital Portfolio Transfer' },
            { daysAgo: 708, type: 'Debit', amount: 45000.00, desc: 'Legal & Wealth Retainer - Sullivan & Cromwell LLP' },
            { daysAgo: 695, type: 'Credit', amount: 125000.00, desc: 'Quarterly Preferred Dividend - Vanguard US Treasury Fund' },

            // Month 2 (Dec 2024) - Days 680 to 665
            { daysAgo: 680, type: 'Debit', amount: 62500.00, desc: 'Amex Centurion Concierge & Travel Settlement' },
            { daysAgo: 668, type: 'Credit', amount: 95000.00, desc: 'Private Equity Advisory Distribution' },
            { daysAgo: 665, type: 'Debit', amount: 250000.00, desc: 'Wire Out: Private Investment Syndicate Tranche 1' },

            // Month 3 (Jan 2025) - Days 650 to 630
            { daysAgo: 650, type: 'Credit', amount: 350000.00, desc: 'Commercial Real Estate Yield - Rees Asset Holdings' },
            { daysAgo: 635, type: 'Debit', amount: 85000.00, desc: 'NetJets Fleet Aviation Services' },

            // Month 4 (Feb 2025) - Days 620 to 600
            { daysAgo: 620, type: 'Credit', amount: 180000.00, desc: 'Fixed Income Treasury Note Yield' },
            { daysAgo: 605, type: 'Debit', amount: 38000.00, desc: 'Executive Health & Family Trust Management' },

            // Month 5 (Mar 2025) - Days 590 to 570
            { daysAgo: 590, type: 'Credit', amount: 520000.00, desc: 'Corporate Performance Bonus & Dividend' },
            { daysAgo: 575, type: 'Debit', amount: 140000.00, desc: 'Q1 Estimated Tax Settlement - US Treasury' },

            // Month 6 (Apr 2025) - Days 560 to 540
            { daysAgo: 560, type: 'Credit', amount: 110000.00, desc: 'Consulting Retainer - Rees Advisory Group' },
            { daysAgo: 545, type: 'Debit', amount: 75000.00, desc: 'Private Equity Capital Call - Series C Syndicate' },

            // Month 7 (May 2025) - Days 530 to 510
            { daysAgo: 530, type: 'Credit', amount: 240000.00, desc: 'Morgan Stanley Global Liquidity Distribution' },
            { daysAgo: 515, type: 'Debit', amount: 52000.00, desc: 'Wire Transfer: Art & Antique Acquisition Escrow' },

            // Month 8 (Jun 2025) - Days 500 to 480
            { daysAgo: 500, type: 'Credit', amount: 310000.00, desc: 'Commercial Lease Revenue - Manhattan Properties' },
            { daysAgo: 485, type: 'Debit', amount: 165000.00, desc: 'Q2 Estimated Tax Settlement - US Treasury' },

            // Month 9 (Jul 2025) - Days 470 to 450
            { daysAgo: 470, type: 'Credit', amount: 145000.00, desc: 'Venture Debt Yield Payment' },
            { daysAgo: 455, type: 'Debit', amount: 68000.00, desc: 'Luxury Marine Charter & Summer Docking Services' },

            // Month 10 (Aug 2025) - Days 440 to 420
            { daysAgo: 440, type: 'Credit', amount: 275000.00, desc: 'Rees Investment Trust Capital Return' },
            { daysAgo: 425, type: 'Debit', amount: 42000.00, desc: 'Wealth Planning & Audit - Deloitte Private' },

            // Month 11 (Sep 2025) - Days 410 to 390
            { daysAgo: 410, type: 'Credit', amount: 480000.00, desc: 'Liquidity Distribution - Tech Fund Secondary Sale' },
            { daysAgo: 395, type: 'Debit', amount: 175000.00, desc: 'Q3 Estimated Tax Settlement - US Treasury' },

            // Month 12 (Oct 2025) - Days 380 to 360
            { daysAgo: 380, type: 'Credit', amount: 160000.00, desc: 'Quarterly Preferred Dividend - BlackRock Equity' },
            { daysAgo: 365, type: 'Debit', amount: 95000.00, desc: 'Philanthropic Foundation Annual Contribution' },

            // Month 13 (Nov 2025) - Days 350 to 330
            { daysAgo: 350, type: 'Credit', amount: 320000.00, desc: 'Commercial Real Estate Proceeds - Rees Group' },
            { daysAgo: 335, type: 'Debit', amount: 58000.00, desc: 'Centurion Luxury Card Monthly Statement' },

            // Month 14 (Dec 2025) - Days 320 to 300
            { daysAgo: 320, type: 'Credit', amount: 650000.00, desc: 'Year-End Capital Distribution & Retainer' },
            { daysAgo: 305, type: 'Debit', amount: 320000.00, desc: 'Wire Out: Real Estate Development Co-Investment' },

            // Month 15 (Jan 2026) - Days 290 to 270
            { daysAgo: 290, type: 'Credit', amount: 210000.00, desc: 'Municipal Bond Semi-Annual Coupon' },
            { daysAgo: 275, type: 'Debit', amount: 48000.00, desc: 'NetJets Corporate Fleet Quarterly Retainer' },

            // Month 16 (Feb 2026) - Days 260 to 240
            { daysAgo: 260, type: 'Credit', amount: 175000.00, desc: 'Treasury Yield & Short-Term Note Settlement' },
            { daysAgo: 245, type: 'Debit', amount: 35000.00, desc: 'Baker McKenzie Advisory Legal Services' },

            // Month 17 (Mar 2026) - Days 230 to 210
            { daysAgo: 230, type: 'Credit', amount: 430000.00, desc: 'Q1 Partnership Dividend - Rees Global Capital' },
            { daysAgo: 215, type: 'Debit', amount: 155000.00, desc: 'Q1 Federal Estimated Tax Settlement' },

            // Month 18 (Apr 2026) - Days 200 to 180
            { daysAgo: 200, type: 'Credit', amount: 290000.00, desc: 'Asset Sale Proceeds - Venture Portfolio Exit' },
            { daysAgo: 185, type: 'Debit', amount: 82000.00, desc: 'PwC Family Office Tax Filing & Compliance' },

            // Month 19 (May 2026) - Days 170 to 150
            { daysAgo: 170, type: 'Credit', amount: 195000.00, desc: 'Commercial Rent Distribution - Rees Plaza' },
            { daysAgo: 155, type: 'Debit', amount: 65000.00, desc: 'Amex Centurion Card Statement' },

            // Month 20 (Jun 2026) - Days 140 to 120
            { daysAgo: 140, type: 'Credit', amount: 380000.00, desc: 'Corporate Advisory Fee - Rees Strategic Advisory' },
            { daysAgo: 125, type: 'Debit', amount: 160000.00, desc: 'Q2 Estimated Federal Tax Payment' },

            // Month 21 (Jul 2026) - Days 110 to 90
            { daysAgo: 110, type: 'Credit', amount: 260000.00, desc: 'Morgan Stanley Wealth Management Div Payout' },
            { daysAgo: 95, type: 'Debit', amount: 72000.00, desc: 'Executive Aviation & Fleet Charter' },

            // Month 22 (Aug 2026) - Days 80 to 60
            { daysAgo: 80, type: 'Credit', amount: 340000.00, desc: 'Private Equity Fund Secondary Liquidity Return' },
            { daysAgo: 65, type: 'Debit', amount: 90000.00, desc: 'Wire Transfer: Escrow Security Deposit' },

            // Month 23 (Sep 2026) - Days 50 to 30
            { daysAgo: 50, type: 'Credit', amount: 410000.00, desc: 'Commercial Real Estate Yield & Refinancing Dividend' },
            { daysAgo: 35, type: 'Debit', amount: 180000.00, desc: 'Q3 Estimated Tax Settlement - US Treasury' },

            // Month 24 (Oct 2026) - Days 20 to 2
            { daysAgo: 20, type: 'Credit', amount: 285000.00, desc: 'Treasury Bond Yield & Portfolio Interest' },
            { daysAgo: 8, type: 'Debit', amount: 45000.00, desc: 'Centurion Monthly Concierge & Executive Expenses' },
            // Final balancing credit to reach exactly $10,000,000.00
            // Will be dynamically calculated below!
        ];

        // Calculate sum of history so far
        let runningBalance = 0;
        for (const tx of rawHistory) {
            if (tx.type === 'Credit') {
                runningBalance += tx.amount;
            } else {
                runningBalance -= tx.amount;
            }
        }

        const remainingDifference = finalTargetBalance - runningBalance;
        console.log(`Current subtotal before final entry: $${runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        console.log(`Adjusting final transaction to achieve target: $${remainingDifference.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

        if (remainingDifference >= 0) {
            rawHistory.push({
                daysAgo: 2,
                type: 'Credit',
                amount: +remainingDifference.toFixed(2),
                desc: 'Wire In: Rees Global Capital Asset Liquidation & Distribution'
            });
        } else {
            rawHistory.push({
                daysAgo: 2,
                type: 'Debit',
                amount: +Math.abs(remainingDifference).toFixed(2),
                desc: 'Wire Out: Escrow - Rees Property Acquisition'
            });
        }

        // Sort oldest first (highest daysAgo to lowest)
        rawHistory.sort((a, b) => b.daysAgo - a.daysAgo);

        // Verify calculation and insert
        let calculatedBalance = 0;
        for (const tx of rawHistory) {
            const txDate = new Date();
            txDate.setDate(txDate.getDate() - tx.daysAgo);

            if (tx.type === 'Credit') {
                calculatedBalance += tx.amount;
            } else {
                calculatedBalance -= tx.amount;
            }
            calculatedBalance = +calculatedBalance.toFixed(2);

            await db.query(`
                INSERT INTO transactions (
                    account_id, transaction_type, amount, description, balance_after, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [accountId, tx.type, tx.amount, tx.desc, calculatedBalance, txDate]);
        }

        console.log(`Final calculated balance: $${calculatedBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        console.log(`Inserted ${rawHistory.length} transactions across 2 years of active account history.`);

        // Add a welcome notification
        // Avoid duplicate notification
        const notifMsg = 'Welcome back, Dick-Richard C Rees. Your Santander Wealth Portfolio is active and up to date.';
        const existingNotif = await db.query(
            'SELECT id FROM notifications WHERE username = $1 AND message = $2',
            [username, notifMsg]
        );
        if (existingNotif.rows.length === 0) {
            await db.query(`
                INSERT INTO notifications (username, message, type, created_at)
                VALUES ($1, $2, 'info', NOW())
            `, [username, notifMsg]);
        }

        console.log('\n======================================================');
        console.log('✅ USER AND ACCOUNT CREATED SUCCESSFULLY');
        console.log('======================================================');
        console.log(`Full Name:       ${firstname} ${surname}`);
        console.log(`Username:        ${username}`);
        console.log(`Password:        ${rawPassword}`);
        console.log(`Email:           ${email}`);
        console.log(`Phone:           ${phone}`);
        console.log(`Account Type:    ${accountType}`);
        console.log(`Account Number:  ${accountNumber}`);
        console.log(`Balance:         $${finalTargetBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        console.log(`History:         2 Years (${rawHistory.length} transactions)`);
        console.log(`Status:          Approved`);
        console.log(`Transaction Code: ${transactionCode}`);
        console.log('======================================================\n');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error creating profile:', err);
        process.exit(1);
    }
}

createProfile();

