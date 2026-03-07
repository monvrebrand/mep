# Santander Admin Panel - Email Reply Setup

This guide explains how to set up email replies for the admin message system.

## Prerequisites

- Node.js installed
- npm packages installed (`npm install`)

## Email Configuration Setup

### Step 1: Create .env File

Copy the `.env.example` file to `.env` and fill in your SMTP credentials:

```bash
cp .env.example .env
```

### Step 2: Edit .env with Your Email Settings

Open `.env` and configure it with your SMTP provider:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@santander.co.uk
SMTP_FROM_NAME=Santander Support

# Server Configuration
PORT=3000
```

### Using Gmail

1. Enable 2-Step Verification on your Google Account
2. Generate an [App Password](https://myaccount.google.com/apppasswords)
3. Use the generated password as `SMTP_PASS`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx  # 16-character password
```

### Using Other Email Providers

**Outlook/Microsoft 365:**
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxxxxxxxxxx  # SendGrid API key
```

**AWS SES:**
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-aws-smtp-username
SMTP_PASS=your-aws-smtp-password
```

## Running the Server

```bash
npm install
npm start
```

The server will start on `http://localhost:3000`

## Using the Admin Panel

1. Go to `http://localhost:3000/admin-login.html`
2. Login with:
   - Username: `admin`
   - Password: `password123`

3. Click on any message to open it
4. Scroll down to "Send Reply" section
5. Type your reply and click "Send Reply"
6. The reply will be:
   - Saved in the database
   - Sent to the customer via email (if SMTP is configured)
   - Displayed in the replies section

## Reply Features

- ✅ View all customer messages
- ✅ Send replies via email
- ✅ See reply history
- ✅ Mark messages as read/unread
- ✅ Delete messages
- ✅ Search messages by name, email, or subject

## Troubleshooting

### Email not sending?

1. Check .env file exists and has correct SMTP settings
2. Check console logs for error messages
3. Verify SMTP credentials are correct
4. Try with a different email provider
5. Check firewall/network settings allow outbound SMTP

### SMTP Port Issues?

- Port 587 (TLS) - Standard, recommended
- Port 465 (SSL) - Secure
- Port 25 (SMTP) - Often blocked by ISPs

### Gmail Issues?

- Use App Password, not regular password
- Enable "Less secure app access" if needed
- Check [Google Account Security](https://myaccount.google.com/security)

## Security Notes

⚠️ **Important for Production:**
- Change default admin credentials
- Use environment variables for all secrets
- Implement proper JWT token validation
- Use HTTPS only
- Hash and salt admin passwords
- Add rate limiting
- Add CSRF protection

## Database

Messages are stored in an in-memory SQLite database. To persist data across server restarts, modify the database connection:

```javascript
// Current (in-memory):
const db = new sqlite3.Database(':memory:');

// Persistent:
const db = new sqlite3.Database('./messages.db');
```

## API Endpoints

### Authentication
- `POST /api/admin/login` - Login
- `POST /api/admin/verify` - Verify token

### Messages
- `POST /api/contact` - Submit contact form
- `GET /api/messages` - Get all messages (requires auth)
- `PUT /api/messages/:id/read` - Mark as read (requires auth)
- `DELETE /api/messages/:id` - Delete message (requires auth)

### Replies
- `GET /api/messages/:id/replies` - Get message replies (requires auth)
- `POST /api/messages/:id/reply` - Send reply (requires auth)

---

For issues or questions, check the console logs for detailed error messages.
