const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const fs = require('fs');
require('dotenv').config();

const app = express();
const db = require('./db');
const PORT = process.env.PORT || 3000;

// Admin credentials (in production, these should be hashed and stored securely)
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'password123'
};

// Email transporter setup
let transporter;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('Email transporter configured');
} else {
  console.warn('SMTP configuration missing - email replies will not work');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the project root
const publicPath = path.join(__dirname);
app.use(express.static(publicPath, {
  etag: false,
  maxAge: '1d'
}));

// Serve static directories explicitly
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/vendor', express.static(path.join(__dirname, 'vendor')));
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Use /tmp in production (Vercel) because the root is read-only
        const dir = process.env.NODE_ENV === 'production' ? '/tmp' : './uploads';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
    }
});
const upload = multer({ storage: storage });

// Helper to generate a unique 8-digit account number starting with 923
async function generateUniqueAccountNumber() {
    let accountNumber;
    let isUnique = false;
    while (!isUnique) {
        // Generate 5 random digits to append to 923
        const randomPart = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
        accountNumber = '923' + randomPart;
        const { rows } = await db.query('SELECT id FROM accounts WHERE account_number = $1', [accountNumber]);
        if (rows.length === 0) {
            isUnique = true;
        }
    }
    return accountNumber;
}

// Generate a simple token (in production, use JWT)
function generateToken() {
    return 'admin_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Middleware to check authentication
function requireAuth(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    
    // For simplicity, we'll just check if a token was provided
    // In production, you'd verify the token properly
    if (!token || !token.startsWith('admin_')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    next();
}

// API Routes

// Admin login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password required' });
    }
    
    // Check credentials
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        const token = generateToken();
        res.json({ 
            success: true, 
            message: 'Login successful',
            token: token
        });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Verify token
app.post('/api/admin/verify', (req, res) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    
    if (!token || !token.startsWith('admin_')) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    
    res.json({ success: true, message: 'Token valid' });
});

// Submit contact form
app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        const result = await db.query(
            `INSERT INTO contact_messages (name, email, subject, message) VALUES ($1, $2, $3, $4) RETURNING id`,
            [name, email, subject, message]
        );
        res.json({ success: true, message: 'Message sent successfully', messageId: result.rows[0].id });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error saving message' });
    }
});

// Handle Registration
app.post('/api/register', upload.single('idDocument'), async (req, res) => {
    const {
        firstname, middlename, surname, dob, id_number, address,
        email, phone, account_types, username, password
    } = req.body;

    const id_document_path = req.file ? req.file.path : null;

    // Convert date format for PostgreSQL
    let formattedDob = null;
    if (dob && typeof dob === 'string') {
        const parts = dob.split('/');
        // Assuming input is DD/MM/YYYY, convert to YYYY-MM-DD
        if (parts.length === 3) {
            formattedDob = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const query = `
            INSERT INTO registrations (
                firstname, middlename, surname, dob, id_number, address,
                email, phone, account_types, id_document_path, username, password
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;
        const values = [
            firstname, middlename, surname, formattedDob, id_number, address,
            email, phone, account_types, id_document_path, username, hashedPassword
        ];
        await db.query(query, values);
        res.json({ success: true, message: 'Registration successful' });
    } catch (err) {
        console.error('Database error:', err);
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ success: false, message: 'Username or email already exists.' });
        }
        return res.status(500).json({ success: false, message: 'Error saving registration' });
    }
});

// Customer Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const { rows } = await db.query(
            `SELECT * FROM registrations WHERE username = $1`,
            [username]
        );
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        if (user.status === 'blocked') {
            return res.status(401).json({ success: false, message: 'Your account has been blocked. Please contact support.' });
        }
        if (user.status !== 'approved' && user.status !== 'suspended') { 
            return res.status(401).json({ success: false, message: 'Account application is pending or rejected' }); 
        }

        // In a real app, you would generate a JWT here
        res.json({ 
            success: true, 
            message: 'Login successful', 
            user: { 
                username: user.username,
                firstname: user.firstname, 
                surname: user.surname 
            } 
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Get user dashboard data
app.get('/api/user/:username/dashboard', async (req, res) => {
    const { username } = req.params;
    
    try {
        // Get user details
        const userRes = await db.query('SELECT id, firstname, surname FROM registrations WHERE username = $1', [username]);
        const user = userRes.rows[0];

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Get accounts
        const accountsRes = await db.query('SELECT * FROM accounts WHERE registration_id = $1', [user.id]);
        
        res.json({
            success: true,
            user: {
                firstname: user.firstname,
                surname: user.surname
            },
            accounts: accountsRes.rows
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error fetching dashboard data' });
    }
});

// Get user profile (all fields except password)
app.get('/api/user/:username/profile', async (req, res) => {
    const { username } = req.params;
    try {
        const { rows } = await db.query(
            `SELECT firstname, middlename, surname, dob, id_number, address, email, phone, account_types, status, email_notifications
             FROM registrations WHERE username = $1`,
            [username]
        );
        const user = rows[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, profile: user });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error fetching profile' });
    }
});

// Update user profile (email, phone, password optional)
app.put('/api/user/:username/profile', async (req, res) => {
    const { username } = req.params;
    const { email, phone, oldPassword, newPassword, emailNotifications } = req.body;

    try {
        const { rows } = await db.query('SELECT * FROM registrations WHERE username = $1', [username]);
        const user = rows[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const updates = [];
        const params = [];
        let idx = 1;
        if (email && email !== user.email) {
            updates.push(`email = $${idx++}`);
            params.push(email);
        }
        if (phone && phone !== user.phone) {
            updates.push(`phone = $${idx++}`);
            params.push(phone);
        }
        if (emailNotifications !== undefined && emailNotifications !== user.email_notifications) {
            updates.push(`email_notifications = $${idx++}`);
            params.push(emailNotifications);
        }
        if (newPassword) {
            // require oldPassword match
            if (!oldPassword) {
                return res.status(400).json({ success: false, message: 'Old password required to change password' });
            }
            const match = await bcrypt.compare(oldPassword, user.password);
            if (!match) {
                return res.status(401).json({ success: false, message: 'Old password incorrect' });
            }
            const hashed = await bcrypt.hash(newPassword, 10);
            updates.push(`password = $${idx++}`);
            params.push(hashed);
        }
        if (updates.length === 0) {
            return res.json({ success: true, message: 'No changes to update' });
        }
        params.push(username);
        const query = `UPDATE registrations SET ${updates.join(', ')} WHERE username = $${idx}`;
        await db.query(query, params);
        res.json({ success: true, message: 'Profile updated' });
    } catch (err) {
        console.error('Database error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ success: false, message: 'Email already in use' });
        }
        res.status(500).json({ success: false, message: 'Error updating profile' });
    }
});

// Get transactions for a specific account
app.get('/api/account/:accountNumber/transactions', async (req, res) => {
    const { accountNumber } = req.params;
    const { limit, startDate, endDate, month, year } = req.query;
    
    try {
        const accountRes = await db.query('SELECT id FROM accounts WHERE account_number = $1', [accountNumber]);
        const account = accountRes.rows[0];

        if (!account) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }

        // build dynamic query
        let queryText = 'SELECT * FROM transactions WHERE account_id = $1';
        const params = [account.id];
        let idx = 2;

        // Support for specific month/year filtering (Statement view)
        if (month && year) {
            queryText += ` AND EXTRACT(MONTH FROM created_at) = $${idx++} AND EXTRACT(YEAR FROM created_at) = $${idx++}`;
            params.push(parseInt(month));
            params.push(parseInt(year));
        } else {
            // Existing date filter logic (kept as fallback)
            if (startDate) {
                let start = startDate;
                // Convert DD/MM/YYYY to YYYY-MM-DD if necessary
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(start)) {
                    const [d, m, y] = start.split('/');
                    start = `${y}-${m}-${d}`;
                }
                queryText += ` AND created_at >= $${idx++}`;
                params.push(start);
            }
            if (endDate) {
                let end = endDate;
                // Convert DD/MM/YYYY to YYYY-MM-DD if necessary
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(end)) {
                    const [d, m, y] = end.split('/');
                    end = `${y}-${m}-${d}`;
                }
                queryText += ` AND created_at < ($${idx++}::date + interval '1 day')`;
                params.push(end);
            }
        }
        queryText += ' ORDER BY created_at DESC';
        if (limit) {
            queryText += ` LIMIT $${idx++}`;
            params.push(parseInt(limit, 10));
        }

        const transactionsRes = await db.query(queryText, params);
        
        res.json({
            success: true,
            transactions: transactionsRes.rows
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error fetching transactions' });
    }
});

// Get available statement periods (months with transactions)
app.get('/api/account/:accountNumber/statement-periods', async (req, res) => {
    const { accountNumber } = req.params;
    
    try {
        const accountRes = await db.query('SELECT id FROM accounts WHERE account_number = $1', [accountNumber]);
        const account = accountRes.rows[0];

        if (!account) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }

        // Get distinct months from transactions
        const query = `
            SELECT DISTINCT 
                EXTRACT(MONTH FROM created_at) as month,
                EXTRACT(YEAR FROM created_at) as year,
                TO_CHAR(created_at, 'FMMonth YYYY') as label
            FROM transactions 
            WHERE account_id = $1
            ORDER BY year DESC, month DESC
        `;
        
        const { rows } = await db.query(query, [account.id]);
        
        res.json({ success: true, periods: rows });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error fetching statement periods' });
    }
});

// Create a transfer/payment between accounts
app.post('/api/transfer', async (req, res) => {
    const { fromAccount, toAccount, amount, description } = req.body;

    if (!fromAccount || !toAccount || !amount) {
        return res.status(400).json({ success: false, message: 'Required fields missing' });
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    try {
        // load both accounts
        const fromRes = await db.query('SELECT * FROM accounts WHERE account_number = $1', [fromAccount]);
        const toRes = await db.query('SELECT * FROM accounts WHERE account_number = $1', [toAccount]);
        const fromAcc = fromRes.rows[0];
        const toAcc = toRes.rows[0];

        if (!fromAcc) {
            return res.status(404).json({ success: false, message: 'Source account not found' });
        }
        if (!toAcc) {
            return res.status(404).json({ success: false, message: 'Destination account not found' });
        }

        // Check if user is suspended
        const userRes = await db.query('SELECT status FROM registrations WHERE id = $1', [fromAcc.registration_id]);
        if (userRes.rows[0] && userRes.rows[0].status === 'suspended') {
            return res.status(403).json({ success: false, message: 'Account is suspended. Transactions are disabled. Please contact support.' });
        }

        if (parseFloat(fromAcc.balance) < amt) {
            return res.status(400).json({ success: false, message: 'Insufficient funds' });
        }

        // perform update inside transaction
        await db.query('BEGIN');

        const newFromBal = parseFloat(fromAcc.balance) - amt;
        const newToBal = parseFloat(toAcc.balance) + amt;

        await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newFromBal, fromAcc.id]);
        await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newToBal, toAcc.id]);

        // record transactions for each side
        const now = new Date();
        await db.query(
            `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [fromAcc.id, 'Debit', amt, description || `Transfer to ${toAccount}`, newFromBal, now]
        );
        await db.query(
            `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [toAcc.id, 'Credit', amt, description || `Transfer from ${fromAccount}`, newToBal, now]
        );

        await db.query('COMMIT');

        res.json({ success: true, message: 'Transfer completed', fromBalance: newFromBal, toBalance: newToBal });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Database error during transfer:', err);
        res.status(500).json({ success: false, message: 'Error processing transfer' });
    }
});

// Pay a bill (debit from user account and record transaction)
app.post('/api/billpay', async (req, res) => {
    const { fromAccount, payeeName, amount, description } = req.body;

    if (!fromAccount || !payeeName || !amount) {
        return res.status(400).json({ success: false, message: 'Required fields missing' });
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    try {
        const fromRes = await db.query('SELECT * FROM accounts WHERE account_number = $1', [fromAccount]);
        const fromAcc = fromRes.rows[0];

        if (!fromAcc) {
            return res.status(404).json({ success: false, message: 'Source account not found' });
        }

        // Check if user is suspended
        const userRes = await db.query('SELECT status FROM registrations WHERE id = $1', [fromAcc.registration_id]);
        if (userRes.rows[0] && userRes.rows[0].status === 'suspended') {
            return res.status(403).json({ success: false, message: 'Account is suspended. Transactions are disabled. Please contact support.' });
        }

        if (parseFloat(fromAcc.balance) < amt) {
            return res.status(400).json({ success: false, message: 'Insufficient funds' });
        }

        // update balance and record transaction
        const newFromBal = parseFloat(fromAcc.balance) - amt;
        await db.query('BEGIN');
        await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newFromBal, fromAcc.id]);

        const now = new Date();
        await db.query(
            `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [fromAcc.id, 'Debit', amt, description || `Bill to ${payeeName}`, newFromBal, now]
        );
        await db.query('COMMIT');

        res.json({ success: true, message: 'Bill paid', newBalance: newFromBal });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Database error during bill payment:', err);
        res.status(500).json({ success: false, message: 'Error processing bill payment' });
    }
});

// Password Reset Request
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    try {
        const { rows } = await db.query('SELECT * FROM registrations WHERE email = $1', [email]);
        const user = rows[0];

        if (!user) {
            return res.status(404).json({ success: false, message: 'Email not found in our records.' });
        }

        if (user.status !== 'approved') {
             return res.status(403).json({ success: false, message: 'Account is not active. Please contact support.' });
        }

        if (transporter) {
            const resetLink = `http://localhost:${PORT}/reset-password.html?email=${encodeURIComponent(email)}`;
            
            try {
                await transporter.sendMail({
                    from: `${process.env.SMTP_FROM_NAME || 'Santander Support'} <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                    to: email,
                    subject: 'Password Reset Request',
                    html: `
                        <h2>Password Reset</h2>
                        <p>Dear ${user.firstname},</p>
                        <p>We received a request to reset the password for your Santander account.</p>
                        <p>Please click the link below to proceed:</p>
                        <a href="${resetLink}">Reset Password</a>
                        <p>If you did not request this, please ignore this email.</p>
                    `
                });
            } catch (emailErr) {
                console.error('Failed to send email:', emailErr);
                return res.status(500).json({ success: false, message: 'Failed to send reset email.' });
            }
        }

        res.json({ success: true, message: 'Password reset link sent to your email.' });

    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all contact messages (for admin panel) - requires authentication
app.get('/api/messages', requireAuth, async (req, res) => {
    try {
        const { rows } = await db.query(`SELECT * FROM contact_messages ORDER BY created_at DESC`);
        res.json({ success: true, messages: rows });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving messages' });
    }
});

// Get all registrations (for admin panel) - requires authentication
app.get('/api/admin/registrations', requireAuth, async (req, res) => {
    try {
        const query = `
            SELECT r.*, (
                SELECT json_agg(
                    json_build_object(
                        'account_type', a.account_type,
                        'account_number', a.account_number
                    )
                )
                FROM accounts a
                WHERE a.registration_id = r.id
            ) as accounts
            FROM registrations r
            ORDER BY r.created_at DESC
        `;
        const { rows } = await db.query(query);
        res.json({ success: true, registrations: rows });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving registrations' });
    }
});

// Update registration status - requires authentication
app.post('/api/admin/registrations/:id/status', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected', 'suspended', 'blocked'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    try {
        const { rows } = await db.query(`SELECT * FROM registrations WHERE id = $1`, [id]);
        const registration = rows[0];

        if (!registration) return res.status(404).json({ success: false, message: 'Registration not found' });

        // If status is not changing, do nothing.
        if (registration.status === status) {
            return res.json({ success: true, message: `Registration status is already ${status}` });
        }

        await db.query(`UPDATE registrations SET status = $1 WHERE id = $2`, [status, id]);

        let generatedAccounts = [];
        // If approving, generate account numbers if they don't exist
        if (status === 'approved' && registration.account_types) {
            const existingAccountsResult = await db.query('SELECT * FROM accounts WHERE registration_id = $1', [id]);
            if (existingAccountsResult.rows.length === 0) {
                const accountTypes = registration.account_types.split(',').map(t => t.trim()).filter(t => t);
                for (const type of accountTypes) {
                    const accountNumber = await generateUniqueAccountNumber();
                    const newAccount = await db.query(
                        `INSERT INTO accounts (registration_id, account_type, account_number) VALUES ($1, $2, $3) RETURNING *`,
                        [id, type, accountNumber]
                    );
                    generatedAccounts.push({ type: newAccount.rows[0].account_type, accountNumber: newAccount.rows[0].account_number });
                }
            } else {
                generatedAccounts = existingAccountsResult.rows.map(acc => ({ type: acc.account_type, accountNumber: acc.account_number }));
            }
        }

        // Send Email Notification
        if (transporter) {
            try {
                const isApproved = status === 'approved';
                const subject = isApproved ? 'Santander Account Application Approved' : 'Important Update on your Santander Account';
                let html;

                if (status === 'approved') {
                    const accountsHtml = generatedAccounts.length > 0
                        ? '<ul>' + generatedAccounts.map(acc => `<li><strong>${acc.type} Account:</strong> ${acc.accountNumber}</li>`).join('') + '</ul>'
                        : '<p>Your account details will be sent in a separate communication.</p>';

                    html = `
                        <h2>Welcome to Santander!</h2>
                        <p>Dear ${registration.firstname},</p>
                        <p>We are pleased to inform you that your account application has been <strong>approved</strong>.</p>
                        <p>Your new account details are as follows:</p>
                        ${accountsHtml}
                        <p>You can now log in to Online Banking using the username and password you created during registration.</p>
                        <p>Thank you for choosing Santander.</p>
                    `;
                } else if (status === 'rejected') {
                    html = `
                        <h2>Application Update</h2>
                        <p>Dear ${registration.firstname},</p>
                        <p>We have reviewed your application and unfortunately, we are unable to proceed with opening your account at this time.</p>
                        <p>If you have any questions, please contact our support team.</p>
                    `;
                } else if (status === 'suspended') {
                    html = `
                        <h2>Account Suspended</h2>
                        <p>Dear ${registration.firstname},</p>
                        <p>Your account has been temporarily suspended. You can still log in, but transactions are disabled.</p>
                        <p>Please contact our support team for more information.</p>
                    `;
                } else if (status === 'blocked') {
                    html = `
                        <h2>Account Blocked</h2>
                        <p>Dear ${registration.firstname},</p>
                        <p>Your account has been blocked. You will not be able to log in.</p>
                        <p>Please contact our support team immediately.</p>
                    `;
                }

                await transporter.sendMail({
                    from: `${process.env.SMTP_FROM_NAME || 'Santander Support'} <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                    to: registration.email,
                    subject: subject,
                    html: html
                });
            } catch (emailErr) {
                console.error('Failed to send email:', emailErr);
            }
        }
        res.json({ success: true, message: `Registration ${status}` });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error updating status' });
    }
});

// Mark message as read - requires authentication
app.put('/api/messages/:id/read', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query(`UPDATE contact_messages SET read = TRUE WHERE id = $1`, [id]);
        res.json({ success: true, message: 'Message marked as read' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error updating message' });
    }
});

// Delete message - requires authentication
app.delete('/api/messages/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query(`UPDATE contact_messages SET archived = TRUE WHERE id = $1`, [id]);
        res.json({ success: true, message: 'Message archived successfully' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error deleting message' });
    }
});

// Get replies for a message - requires authentication
app.get('/api/messages/:id/replies', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await db.query(`SELECT * FROM message_replies WHERE message_id = $1 ORDER BY created_at ASC`, [id]);
        res.json({ success: true, replies: rows || [] });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving replies' });
    }
});

// Send reply to message - requires authentication
app.post('/api/messages/:id/reply', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { reply_text } = req.body;

    if (!reply_text || reply_text.trim() === '') {
        return res.status(400).json({ success: false, message: 'Reply text is required' });
    }

    try {
        const messageResult = await db.query(`SELECT email, name, subject FROM contact_messages WHERE id = $1`, [id]);
        const message = messageResult.rows[0];

        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        const replyResult = await db.query(
            `INSERT INTO message_replies (message_id, reply_text) VALUES ($1, $2) RETURNING id`,
            [id, reply_text]
        );
        const replyId = replyResult.rows[0].id;

        if (transporter) {
            try {
                const mailOptions = {
                    from: `${process.env.SMTP_FROM_NAME || 'Santander Support'} <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                    to: message.email,
                    subject: `Re: ${message.subject}`,
                    html: `
                        <h2>Reply from Santander Support</h2>
                        <p>Hello ${message.name},</p>
                        <p>Thank you for contacting Santander. Here is our response to your inquiry:</p>
                        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; border-left: 4px solid #dc3545;">
                            <p>${reply_text.replace(/\n/g, '<br>')}</p>
                        </div>
                        <p>If you have any further questions, please don't hesitate to contact us.</p>
                        <p>Best regards,<br>Santander Support Team</p>
                        <hr>
                        <p style="color: #999; font-size: 12px;">Original Message Subject: ${message.subject}</p>
                    `
                };
                await transporter.sendMail(mailOptions);
                console.log(`Reply sent to ${message.email}`);
                res.json({ success: true, message: 'Reply saved and email sent successfully', replyId });
            } catch (emailError) {
                console.error('Email send error:', emailError);
                res.json({ success: true, message: 'Reply saved but email could not be sent', replyId, emailError: emailError.message });
            }
        } else {
            res.json({ success: true, message: 'Reply saved (email transporter not configured)', replyId });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error processing reply' });
    }
});
// ======================
// LIVE CHAT API ENDPOINTS
// ======================

// Send a live chat message (customer or admin)
app.post('/api/chat/send', async (req, res) => {
    const { session_id, sender_type, sender_name, message, customer_email } = req.body;

    if (!session_id || !sender_type || !message) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
        const sessionRes = await db.query(`SELECT is_active FROM live_chat_sessions WHERE session_id = $1`, [session_id]);
        if (sessionRes.rows.length > 0 && sessionRes.rows[0].is_active === false) {
            return res.status(400).json({ success: false, message: 'Chat session has been closed' });
        }

        let isNewSession = false;
        if (sender_type === 'customer' && sessionRes.rows.length === 0) {
            isNewSession = true;
            await db.query(
                `INSERT INTO live_chat_sessions (session_id, customer_name, customer_email, is_active) VALUES ($1, $2, $3, TRUE)`,
                [session_id, sender_name, customer_email]
            );

            // Send email notification to admin for new chat
            if (transporter && process.env.ADMIN_EMAIL) {
                try {
                    const adminUrl = `http://localhost:${PORT}/admin-messages.html`;
                    await transporter.sendMail({
                        from: `${process.env.SMTP_FROM_NAME || 'Santander Support'} <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                        to: process.env.ADMIN_EMAIL,
                        subject: `New Live Chat Request from ${sender_name}`,
                        html: `
                            <h2>New Live Chat Session</h2>
                            <p>A new live chat session has been started by a customer.</p>
                            <ul>
                                <li><strong>Name:</strong> ${sender_name}</li>
                                <li><strong>Email:</strong> ${customer_email}</li>
                            </ul>
                            <p><strong>Initial Message:</strong></p>
                            <p><em>${message}</em></p>
                            <p>Please log in to the admin panel to respond.</p>
                            <a href="${adminUrl}" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Go to Admin Panel</a>
                        `
                    });
                    console.log(`Live chat notification sent to ${process.env.ADMIN_EMAIL}`);
                } catch (emailErr) {
                    console.error('Failed to send live chat notification email:', emailErr);
                }
            }
        }

        const result = await db.query(
            `INSERT INTO live_chat_messages (session_id, sender_type, sender_name, message) VALUES ($1, $2, $3, $4) RETURNING id`,
            [session_id, sender_type, sender_name, message]
        );

        if (isNewSession) {
            await db.query(
                `INSERT INTO live_chat_messages (session_id, sender_type, sender_name, message) VALUES ($1, 'admin', 'Santander Support', $2)`,
                [session_id, 'Thank you for contacting Santander Support. An agent will be with you shortly.']
            );
        }

        res.json({ success: true, message: 'Message sent successfully', messageId: result.rows[0].id });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error saving chat message' });
    }
});

// Get all messages for a chat session (include active status)
app.get('/api/chat/messages/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    try {
        const sessionRes = await db.query(`SELECT is_active FROM live_chat_sessions WHERE session_id = $1`, [sessionId]);
        const active = sessionRes.rows.length > 0 ? sessionRes.rows[0].is_active : false;

        const messagesRes = await db.query(`SELECT * FROM live_chat_messages WHERE session_id = $1 ORDER BY created_at ASC`, [sessionId]);
        res.json({ success: true, active, messages: messagesRes.rows || [] });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving messages' });
    }
});

// Get all active chat sessions (admin only)
app.get('/api/admin/chat/sessions', requireAuth, async (req, res) => {
    try {
        const query = `
            SELECT s.*, (
                SELECT COUNT(*) 
                FROM live_chat_messages 
                WHERE session_id = s.session_id AND sender_type = 'customer' AND read_by_admin = FALSE
            ) as unread_count
            FROM live_chat_sessions s 
            WHERE s.is_active = TRUE 
            ORDER BY s.created_at DESC
        `;
        const { rows } = await db.query(query);
        res.json({ success: true, sessions: rows });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving sessions' });
    }
});

// Get all messages in a chat session (admin only)
app.get('/api/admin/chat/sessions/:sessionId/messages', requireAuth, async (req, res) => {
    const { sessionId } = req.params;
    try {
        const messagesRes = await db.query(`SELECT * FROM live_chat_messages WHERE session_id = $1 ORDER BY created_at ASC`, [sessionId]);

        await db.query(`UPDATE live_chat_messages SET read_by_admin = TRUE WHERE session_id = $1 AND sender_type = 'customer'`, [sessionId]);

        res.json({ success: true, messages: messagesRes.rows || [] });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving messages' });
    }
});

// Send a live chat reply (admin only)
app.post('/api/chat/reply', requireAuth, async (req, res) => {
    const { session_id, message } = req.body;

    if (!session_id || !message) {
        return res.status(400).json({ success: false, message: 'Session ID and message required' });
    }

    try {
        const result = await db.query(
            `INSERT INTO live_chat_messages (session_id, sender_type, sender_name, message) VALUES ($1, 'admin', 'Support Team', $2) RETURNING id`,
            [session_id, message]
        );
        res.json({ success: true, message: 'Reply sent successfully', messageId: result.rows[0].id });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error saving reply' });
    }
});

// Close a chat session (customer or admin)
// Unauthenticated route for customers to end their own conversation. Admins may still
// use the authenticated endpoint below if preferred.
app.put('/api/chat/sessions/:sessionId/close', (req, res, next) => {
    // if admin token present and valid, requireAuth middleware will run; otherwise continue
    if (req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        return requireAuth(req, res, next);
    }
    next();
}, async (req, res) => {
    const { sessionId } = req.params;
    try {
        // Per your request, closing the chat now deletes the session and all associated messages from the database.
        await db.query(`DELETE FROM live_chat_sessions WHERE session_id = $1`, [sessionId]);
        res.json({ success: true, message: 'Chat session closed and history cleared' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error closing session' });
    }
});
// Start the server (for local development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`View Business Accounts at http://localhost:${PORT}/business-accounts.html`);
    console.log(`Admin Login at http://localhost:${PORT}/admin-login.html`);
  });
}

// Export app for Vercel serverless
module.exports = app;