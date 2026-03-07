const db = require('./db');

async function seedTransactions() {
    try {
        console.log('Seeding sample transactions...');

        // Get all accounts
        const accountsResult = await db.query('SELECT id, account_number, balance FROM accounts');
        const accounts = accountsResult.rows;

        if (accounts.length === 0) {
            console.log('No accounts found. Please create an account first.');
            process.exit(0);
        }

        // Sample transactions for testing
        const transactions = [
            { type: 'Debit', desc: 'Grocery Store', amount: 45.50 },
            { type: 'Credit', desc: 'Salary Deposit', amount: 2500.00 },
            { type: 'Debit', desc: 'Netflix Subscription', amount: 12.99 },
            { type: 'Debit', desc: 'Electricity Bill', amount: 78.40 },
            { type: 'Credit', desc: 'Refund - Online Purchase', amount: 24.99 },
            { type: 'Debit', desc: 'Coffee Shop', amount: 5.20 },
            { type: 'Debit', desc: 'Fuel', amount: 55.00 },
            { type: 'Credit', desc: 'Interest Credit', amount: 3.50 }
        ];

        // Add transactions to each account
        for (const account of accounts) {
            console.log(`\nAdding transactions for account: ${account.account_number}`);
            
            let currentBalance = parseFloat(account.balance) || 5000.00;

            // Add transactions in reverse order (oldest first for realistic display)
            for (let i = transactions.length - 1; i >= 0; i--) {
                const tx = transactions[i];
                const isDebit = tx.type === 'Debit';
                const amount = parseFloat(tx.amount);
                
                // Update balance
                if (isDebit) {
                    currentBalance -= amount;
                } else {
                    currentBalance += amount;
                }

                // Create transaction
                const txDate = new Date();
                txDate.setDate(txDate.getDate() - (transactions.length - i)); // Spread over days

                await db.query(
                    `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        account.id,
                        tx.type,
                        amount,
                        tx.desc,
                        currentBalance,
                        txDate.toISOString()
                    ]
                );
                console.log(`  ✓ ${tx.type}: ${tx.desc} - £${amount} (Balance: £${currentBalance.toFixed(2)})`);
            }
        }

        console.log('\n✓ Sample transactions added successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding transactions:', err);
        process.exit(1);
    }
}

seedTransactions();
