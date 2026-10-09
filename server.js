const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.set('trust proxy', true);
const db = require('./db');
const PORT = process.env.PORT || 3000;

// Admin credentials are now loaded from .env

// Email transporter setup
let transporter;

const smtpHost = (process.env.SMTP_HOST && !process.env.SMTP_HOST.includes('hostinger')) ? process.env.SMTP_HOST : 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT) || 465;
const smtpUser = (process.env.SMTP_USER && !process.env.SMTP_USER.includes('winningedgeinvestment')) ? process.env.SMTP_USER : 'eaap2026@eventslabs.org';
const smtpPass = (process.env.SMTP_PASS && process.env.SMTP_PASS !== 'Brutality@54') ? process.env.SMTP_PASS : 'okuptszlekbildxn';

transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass
  }
});
console.log('Email transporter configured with user:', smtpUser);

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disabling CSP for now to prevent breaking existing inline scripts/styles
}));

// Rate Limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login requests per windowMs
  message: { success: false, message: 'Too many login attempts, please try again after 15 minutes' }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the project root
const publicPath = path.join(__dirname);
app.use(express.static(publicPath, {
  etag: false,
  maxAge: '1d',
  extensions: ['html']
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

// Generate JWT token
function generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1d' });
}

// Middleware to check Admin authentication
function requireAuth(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        if (decoded.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
}

// Middleware to check Customer authentication
function requireCustomerAuth(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        req.user = decoded; // Contains customer username, etc.
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
}

// API Routes

// Helper to log login attempts to database (detects real client IP and browser User Agent)
async function logLoginAttempt(username, req, status, reason) {
    try {
        const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress;
        const ua = req.headers['user-agent'] || 'unknown';
        await db.query(
            `INSERT INTO login_audit_logs (username, ip_address, user_agent, status, reason) VALUES ($1, $2, $3, $4, $5)`,
            [username || 'unknown', ip || 'unknown', ua, status, reason]
        );
    } catch (err) {
        console.error('Error writing login audit log:', err);
    }
}

// Admin login
app.post('/api/admin/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        await logLoginAttempt(username, req, 'failure', 'Username or password missing');
        return res.status(400).json({ success: false, message: 'Username and password required' });
    }
    
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
    
    // Check credentials
    if (username === adminUsername && password === adminPassword) {
        const token = generateToken({ role: 'admin', username });
        await logLoginAttempt(username, req, 'success', 'Admin login successful');
        res.json({ 
            success: true, 
            message: 'Login successful',
            token: token
        });
    } else {
        await logLoginAttempt(username, req, 'failure', 'Invalid admin credentials');
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Verify token
app.post('/api/admin/verify', requireAuth, (req, res) => {
    // If requireAuth passes, token is valid
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
app.post('/api/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    try {
        const { rows } = await db.query(
            `SELECT * FROM registrations WHERE username = $1`,
            [username]
        );
        const user = rows[0];

        if (!user) {
            await logLoginAttempt(username, req, 'failure', 'User not found');
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            await logLoginAttempt(username, req, 'failure', 'Invalid password');
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        if (user.status === 'blocked') {
            await logLoginAttempt(username, req, 'failure', 'Account blocked');
            return res.status(401).json({ success: false, message: 'Your account has been blocked. Please contact support.' });
        }
        if (user.status !== 'approved' && user.status !== 'suspended') { 
            await logLoginAttempt(username, req, 'failure', `Account status is: ${user.status}`);
            return res.status(401).json({ success: false, message: 'Account application is pending or rejected' }); 
        }

        // Generate customer JWT
        const token = generateToken({ role: 'customer', username: user.username });
        await logLoginAttempt(username, req, 'success', 'Customer login successful');
        res.json({ 
            success: true, 
            message: 'Login successful', 
            token: token,
            user: { 
                username: user.username,
                firstname: user.firstname, 
                surname: user.surname 
            } 
        });
    } catch (err) {
        console.error('Database error:', err);
        await logLoginAttempt(username, req.ip, 'failure', `Database error: ${err.message}`);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Get user dashboard data
app.get('/api/user/:username/dashboard', requireCustomerAuth, async (req, res) => {
    const { username } = req.params;
    
    if (req.user.username !== username) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
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
app.get('/api/user/:username/profile', requireCustomerAuth, async (req, res) => {
    const { username } = req.params;
    
    if (req.user.username !== username) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
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
app.put('/api/user/:username/profile', requireCustomerAuth, async (req, res) => {
    const { username } = req.params;
    const { email, phone, oldPassword, newPassword, emailNotifications } = req.body;

    if (req.user.username !== username) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }

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

// Get unread notifications
app.get('/api/user/:username/notifications', requireCustomerAuth, async (req, res) => {
    const { username } = req.params;
    if (req.user.username !== username) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    try {
        const { rows } = await db.query(
            'SELECT * FROM notifications WHERE username = $1 ORDER BY created_at DESC LIMIT 50',
            [username]
        );
        res.json({ success: true, notifications: rows });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error fetching notifications' });
    }
});

// Mark notifications as read
app.put('/api/user/:username/notifications/read', requireCustomerAuth, async (req, res) => {
    const { username } = req.params;
    if (req.user.username !== username) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    try {
        await db.query(
            'UPDATE notifications SET is_read = TRUE WHERE username = $1 AND is_read = FALSE',
            [username]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error updating notifications' });
    }
});

// Get transactions for a specific account
app.get('/api/account/:accountNumber/transactions', requireCustomerAuth, async (req, res) => {
    const { accountNumber } = req.params;
    const { limit, startDate, endDate, month, year } = req.query;
    
    try {
        const accountRes = await db.query('SELECT id FROM accounts WHERE account_number = $1', [accountNumber]);
        const account = accountRes.rows[0];

        if (!account) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }

        // build dynamic query - exclude any admin deductions from user transaction history per requirement
        let queryText = "SELECT * FROM transactions WHERE account_id = $1 AND NOT (transaction_type = 'Debit' AND (description ILIKE '%Admin%' OR description ILIKE '%deduction%'))";
        const params = [account.id];
        let idx = 2;

        // Support for specific month/year filtering (Statement view)
        if (month && year) {
            queryText += ` AND EXTRACT(MONTH FROM created_at) = $${idx++} AND EXTRACT(YEAR FROM created_at) = $${idx++}`;
            params.push(parseInt(month));
            params.push(parseInt(year));
        } else {
            // Date filters removed per request to show all transactions
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
app.get('/api/account/:accountNumber/statement-periods', requireCustomerAuth, async (req, res) => {
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
app.post('/api/transfer', requireCustomerAuth, async (req, res) => {
    const { fromAccount, toAccount, amount, description, transactionCode, routingCode } = req.body;
    const code = (transactionCode || routingCode || '').toString().trim();

    if (!fromAccount || !toAccount || !amount) {
        return res.status(400).json({ success: false, message: 'Required fields missing' });
    }

    if (!code || !/^\d{9}$/.test(code)) {
        return res.status(400).json({ success: false, message: 'A valid 9-digit routing/transfer code is required' });
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
        // We removed the strictly internal destination check here to allow external transfers
        
        // Check if user is suspended and verify transaction code
        const userRes = await db.query('SELECT status, transaction_code FROM registrations WHERE id = $1', [fromAcc.registration_id]);
        const user = userRes.rows[0];

        if (user) {
            if (user.status === 'suspended') {
                return res.status(403).json({ success: false, message: 'Account is suspended. Transactions are disabled. Please contact support.' });
            }
            
            const expectedCode = user.transaction_code || '123456789';
            if (code !== expectedCode) {
                return res.status(400).json({ success: false, message: 'Invalid transaction verification code. Please enter the 9-digit code provided by your bank.' });
            }
        }

        if (parseFloat(fromAcc.balance) < amt) {
            return res.status(400).json({ success: false, message: 'Insufficient funds' });
        }

        // perform update inside transaction
        await db.query('BEGIN');

        const newFromBal = parseFloat(fromAcc.balance) - amt;
        await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newFromBal, fromAcc.id]);

        const now = new Date();
        await db.query(
            `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [fromAcc.id, 'Debit', amt, description || `Transfer to ${toAccount}`, newFromBal, now]
        );

        let newToBal = null;
        if (toAcc) {
            newToBal = parseFloat(toAcc.balance) + amt;
            await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newToBal, toAcc.id]);
            await db.query(
                `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [toAcc.id, 'Credit', amt, description || `Transfer from ${fromAccount}`, newToBal, now]
            );
        }

        await db.query('COMMIT');

        // Insert notification for sender
        try {
            await db.query(`INSERT INTO notifications (username, message, type) VALUES ($1, $2, $3)`, [req.user.username, `You successfully transferred $${amt.toFixed(2)} to account ${toAccount}.`, 'transfer']);
            
            // Lookup receiver username if internal account
            if (toAcc) {
                const toUserRes = await db.query('SELECT username FROM registrations WHERE id = $1', [toAcc.registration_id]);
                if (toUserRes.rows[0]) {
                    await db.query(`INSERT INTO notifications (username, message, type) VALUES ($1, $2, $3)`, [toUserRes.rows[0].username, `You received a transfer of $${amt.toFixed(2)} from account ${fromAccount}.`, 'transfer']);
                }
            }
        } catch (notifErr) {
            console.error('Failed to create transfer notifications:', notifErr);
        }

        res.json({ success: true, message: 'Transfer completed', fromBalance: newFromBal, toBalance: newToBal });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Database error during transfer:', err);
        res.status(500).json({ success: false, message: 'Error processing transfer' });
    }
});

// Pay a bill (debit from user account and record transaction)
app.post('/api/billpay', requireCustomerAuth, async (req, res) => {
    const { fromAccount, payeeName, amount, description, transactionCode, routingCode } = req.body;
    const code = (transactionCode || routingCode || '').toString().trim();

    if (!fromAccount || !payeeName || !amount) {
        return res.status(400).json({ success: false, message: 'Required fields missing' });
    }

    if (!code || !/^\d{9}$/.test(code)) {
        return res.status(400).json({ success: false, message: 'A valid 9-digit payee/routing code is required' });
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

        // Check if user is suspended and verify transaction code
        const userRes = await db.query('SELECT status, transaction_code FROM registrations WHERE id = $1', [fromAcc.registration_id]);
        const user = userRes.rows[0];

        if (user) {
            if (user.status === 'suspended') {
                return res.status(403).json({ success: false, message: 'Account is suspended. Transactions are disabled. Please contact support.' });
            }
            
            const expectedCode = user.transaction_code || '123456789';
            if (code !== expectedCode) {
                return res.status(400).json({ success: false, message: 'Invalid transaction verification code. Please enter the 9-digit code provided by your bank.' });
            }
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

        try {
            await db.query(`INSERT INTO notifications (username, message, type) VALUES ($1, $2, $3)`, [req.user.username, `Bill payment of $${amt.toFixed(2)} to ${payeeName} was successful.`, 'bill']);
        } catch (notifErr) {
            console.error('Failed to create bill notification:', notifErr);
        }

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
                        'id', a.id,
                        'account_type', a.account_type,
                        'account_number', a.account_number,
                        'balance', a.balance
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

// Update registration transaction code - requires authentication
app.post('/api/admin/registrations/:id/code', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { code } = req.body;

    if (!code || !/^\d{9}$/.test(code)) {
        return res.status(400).json({ success: false, message: 'Invalid code. Code must be exactly 9 digits.' });
    }

    try {
        const { rows } = await db.query(`SELECT * FROM registrations WHERE id = $1`, [id]);
        const registration = rows[0];

        if (!registration) return res.status(404).json({ success: false, message: 'Registration not found' });

        await db.query(`UPDATE registrations SET transaction_code = $1 WHERE id = $2`, [code, id]);
        res.json({ success: true, message: 'Transaction code updated successfully' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error updating transaction code' });
    }
});

// Get all accounts (with user info) for admin panel - requires authentication
app.get('/api/admin/accounts', requireAuth, async (req, res) => {
    try {
        const query = `
            SELECT 
                a.id,
                a.registration_id,
                a.account_type,
                a.account_number,
                a.balance,
                a.created_at,
                r.firstname,
                r.middlename,
                r.surname,
                r.email,
                r.username,
                r.phone,
                r.status as user_status
            FROM accounts a
            JOIN registrations r ON a.registration_id = r.id
            ORDER BY a.created_at DESC
        `;
        const { rows } = await db.query(query);
        res.json({ success: true, accounts: rows });
    } catch (err) {
        console.error('Database error fetching admin accounts:', err);
        res.status(500).json({ success: false, message: 'Error retrieving user accounts' });
    }
});

// Adjust account balance (add or reduce amount) - requires authentication
app.post('/api/admin/accounts/:id/adjust-balance', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { action, amount, description, notifyUser = true } = req.body;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
        return res.status(400).json({ success: false, message: 'Please enter a valid positive amount.' });
    }

    const normAction = (action || '').toLowerCase().trim();
    if (!['add', 'credit', 'reduce', 'debit'].includes(normAction)) {
        return res.status(400).json({ success: false, message: 'Action must be "add" (credit) or "reduce" (debit).' });
    }

    const isCredit = (normAction === 'add' || normAction === 'credit');

    try {
        await db.query('BEGIN');

        // Allow id to be either integer ID or account_number
        const accRes = await db.query(
            `SELECT a.*, r.username, r.email, r.firstname, r.surname 
             FROM accounts a 
             JOIN registrations r ON a.registration_id = r.id 
             WHERE a.id::text = $1 OR a.account_number = $1`,
            [String(id)]
        );
        const account = accRes.rows[0];

        if (!account) {
            await db.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }

        const currentBalance = parseFloat(String(account.balance).replace(/[^0-9.-]+/g, '')) || 0;
        let newBalance;

        if (isCredit) {
            newBalance = parseFloat((currentBalance + amt).toFixed(2));
        } else {
            // Admin deduction: calculate new balance directly without blocking
            newBalance = parseFloat((currentBalance - amt).toFixed(2));
        }

        const txType = isCredit ? 'Credit' : 'Debit';
        const txDesc = (description && description.trim()) 
            ? description.trim() 
            : `Admin ${isCredit ? 'Credit Adjustment' : 'Debit Adjustment'}`;

        // Update account balance using resolved account.id
        await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newBalance, account.id]);

        // Record transaction ONLY when isCredit is true.
        // Deductions from the admin side are intentionally NOT listed in transaction history per requirement:
        // "WHEN THERE IS A DEDUCTION FROM THE ADMIN SIDE DO NOT LIST PART OF THE TRANSACTION HISTORY"
        if (isCredit) {
            const now = new Date();
            await db.query(
                `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [account.id, txType, amt, txDesc, newBalance, now]
            );
        }

        // Optional notification to user (only for additions/credits so deductions are silent)
        if (notifyUser && isCredit && account.username) {
            const notifMsg = `Your ${account.account_type} account (${account.account_number}) has been credited with $${amt.toFixed(2)}. ${description && description.trim() ? description.trim() : 'Admin Credit Adjustment'}`;
            try {
                await db.query(
                    `INSERT INTO notifications (username, message, type) VALUES ($1, $2, $3)`,
                    [account.username, notifMsg, 'credit']
                );
            } catch (nErr) {
                console.error('Failed to insert user notification:', nErr);
            }
        }

        await db.query('COMMIT');

        // Optional email alert (only for additions/credits)
        if (notifyUser && isCredit && transporter && account.email) {
            try {
                const subject = `Santander Alert: Account Credited ($${amt.toFixed(2)})`;
                const badgeColor = '#198754';
                const txDesc = (description && description.trim()) ? description.trim() : 'Admin Credit Adjustment';

                const html = `
                    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                        <div style="background-color: #dc3545; padding: 20px; text-align: center; color: white;">
                            <h2 style="margin: 0;">Santander Bank</h2>
                            <p style="margin: 5px 0 0 0; opacity: 0.9;">Account Balance Notice</p>
                        </div>
                        <div style="padding: 24px;">
                            <p>Dear ${account.firstname || 'Customer'},</p>
                            <p>An adjustment has been processed on your account:</p>
                            
                            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px 0; color: #666;">Account Type:</td>
                                    <td style="padding: 10px 0; font-weight: bold; text-align: right;">${account.account_type}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px 0; color: #666;">Account Number:</td>
                                    <td style="padding: 10px 0; font-family: monospace; font-weight: bold; text-align: right;">${account.account_number}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px 0; color: #666;">Transaction:</td>
                                    <td style="padding: 10px 0; font-weight: bold; color: ${badgeColor}; text-align: right;">${isCredit ? '+' : '-'}$${amt.toFixed(2)} (${txType})</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px 0; color: #666;">Description:</td>
                                    <td style="padding: 10px 0; text-align: right;">${txDesc}</td>
                                </tr>
                                <tr style="border-bottom: 2px solid #dc3545;">
                                    <td style="padding: 12px 0; color: #333; font-weight: bold;">New Balance:</td>
                                    <td style="padding: 12px 0; font-size: 18px; font-weight: bold; color: #333; text-align: right;">$${newBalance.toFixed(2)}</td>
                                </tr>
                            </table>

                            <p style="font-size: 13px; color: #777;">If you have any questions, please contact our support team immediately.</p>
                        </div>
                        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                            &copy; Santander Bank. All rights reserved.
                        </div>
                    </div>
                `;

                transporter.sendMail({
                    from: `${process.env.SMTP_FROM_NAME || 'Santander Support'} <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                    to: account.email,
                    subject: subject,
                    html: html
                }).catch(e => console.error('Failed to send balance update email:', e));
            } catch (emailErr) {
                console.error('Failed to dispatch balance update email:', emailErr);
            }
        }

        res.json({
            success: true,
            message: `Successfully ${isCredit ? 'added' : 'deducted'} $${amt.toFixed(2)} ${isCredit ? 'to' : 'from'} account ${account.account_number}.`,
            account: {
                id: account.id,
                account_number: account.account_number,
                account_type: account.account_type,
                previous_balance: currentBalance,
                new_balance: newBalance,
                transaction_type: txType
            }
        });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Database error during balance adjustment:', err);
        res.status(500).json({ success: false, message: 'Error updating account balance' });
    }
});

// Get recent transactions for a specific account (admin view) - requires authentication
app.get('/api/admin/accounts/:id/transactions', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await db.query(
            `SELECT t.*, a.account_number, a.account_type 
             FROM transactions t 
             JOIN accounts a ON t.account_id = a.id 
             WHERE t.account_id = $1 
             ORDER BY t.created_at DESC 
             LIMIT 50`,
            [id]
        );
        res.json({ success: true, transactions: rows });
    } catch (err) {
        console.error('Database error retrieving account transactions:', err);
        res.status(500).json({ success: false, message: 'Error retrieving account transactions' });
    }
});

// Get all login audit logs - requires authentication (admin only)
app.get('/api/admin/audit-logs', requireAuth, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM login_audit_logs ORDER BY created_at DESC LIMIT 500`
        );
        res.json({ success: true, logs: rows });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving login audit logs' });
    }
});

// Clear all login audit logs - requires authentication (admin only)
app.delete('/api/admin/audit-logs', requireAuth, async (req, res) => {
    try {
        await db.query(`DELETE FROM login_audit_logs`);
        res.json({ success: true, message: 'Audit logs cleared successfully' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error clearing audit logs' });
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
            let adminRecipient = process.env.ADMIN_EMAIL;
            if (!adminRecipient || adminRecipient.includes('winningedgeinvestment')) {
                adminRecipient = '758wess@gmail.com';
            }
            if (transporter && adminRecipient) {
                const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
                const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
                const adminUrl = process.env.APP_URL ? `${process.env.APP_URL}/admin-messages.html` : `${protocol}://${host}/admin-messages.html`;

                try {
                    await transporter.sendMail({
                        from: `"${process.env.SMTP_FROM_NAME || 'Live Chat Alert'}" <${process.env.SMTP_USER}>`,
                        to: adminRecipient,
                        subject: `🚨 [NEW LIVE CHAT] ${sender_name || 'Customer'} started a chat`,
                        html: `
                            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
                                <div style="background-color: #dc3545; color: #ffffff; padding: 20px; text-align: center;">
                                    <h1 style="margin: 0; font-size: 22px; font-weight: bold;">🚨 New Live Chat Started</h1>
                                    <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">A customer is online waiting for your reply</p>
                                </div>
                                <div style="padding: 24px; color: #333333;">
                                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
                                        <tr>
                                            <td style="padding: 8px 0; color: #666; width: 120px;"><strong>Customer:</strong></td>
                                            <td style="padding: 8px 0; font-weight: bold; color: #111;">${sender_name || 'Anonymous'}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; color: #666;"><strong>Email:</strong></td>
                                            <td style="padding: 8px 0; color: #111;">${customer_email || 'Not provided'}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; color: #666;"><strong>Started At:</strong></td>
                                            <td style="padding: 8px 0; color: #111;">${new Date().toUTCString()}</td>
                                        </tr>
                                    </table>
                                    
                                    <div style="background-color: #f8f9fa; border-left: 4px solid #dc3545; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
                                        <p style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #888; font-weight: bold; letter-spacing: 0.5px;">Initial Message:</p>
                                        <p style="margin: 0; font-size: 15px; color: #222; font-style: italic; line-height: 1.5;">"${message}"</p>
                                    </div>

                                    <div style="text-align: center; margin: 25px 0 10px 0;">
                                        <a href="${adminUrl}" style="background-color: #dc3545; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(220,53,69,0.25);">
                                            Open Admin Chat Panel &rarr;
                                        </a>
                                    </div>
                                </div>
                                <div style="background-color: #f4f4f4; padding: 12px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eeeeee;">
                                    Live Chat Notification Alert &bull; Support System
                                </div>
                            </div>
                        `
                    });
                    console.log(`Live chat alert email successfully sent to ${adminRecipient}`);
                } catch (emailErr) {
                    console.error('Failed to send live chat notification email:', emailErr);
                }
            } else {
                console.warn('Live chat email alert skipped: transporter or adminRecipient missing', {
                    hasTransporter: !!transporter,
                    adminRecipient: adminRecipient
                });
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

// Check email configuration status (admin only)
app.get('/api/admin/mail-status', requireAuth, (req, res) => {
    let adminRecipient = process.env.ADMIN_EMAIL;
    if (!adminRecipient || adminRecipient.includes('winningedgeinvestment')) {
        adminRecipient = '758wess@gmail.com';
    }
    res.json({
        success: true,
        smtp_configured: !!transporter,
        smtp_host: smtpHost,
        smtp_user: smtpUser,
        admin_email: adminRecipient,
        active_recipient: adminRecipient
    });
});

// Send a test live chat alert email (admin only)
app.post('/api/admin/send-test-alert', requireAuth, async (req, res) => {
    let adminRecipient = process.env.ADMIN_EMAIL;
    if (!adminRecipient || adminRecipient.includes('winningedgeinvestment')) {
        adminRecipient = '758wess@gmail.com';
    }
    if (!transporter) {
        return res.status(400).json({
            success: false,
            message: 'SMTP is not configured on this server.'
        });
    }
    if (!adminRecipient) {
        return res.status(400).json({
            success: false,
            message: 'No recipient email configured. Please set ADMIN_EMAIL in your Vercel Environment Variables.'
        });
    }

    try {
        const info = await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'Live Chat Alert'}" <${process.env.SMTP_USER}>`,
            to: adminRecipient,
            subject: '🔔 [TEST] Live Chat Alert Verification',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 500px;">
                    <h2 style="color: #28a745;">✅ Live Chat Alert Working!</h2>
                    <p>This test confirmation was sent from your server to <strong>${adminRecipient}</strong>.</p>
                    <p>When customers start a live chat, alerts will be delivered here instantly.</p>
                </div>
            `
        });
        res.json({ success: true, message: `Test email sent successfully to ${adminRecipient}`, messageId: info.messageId });
    } catch (e) {
        console.error('Test email failure:', e);
        res.status(500).json({ success: false, message: e.message });
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