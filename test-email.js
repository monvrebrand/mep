require('dotenv').config();
const nodemailer = require('nodemailer');

// --- Configuration ---
// The email address to send a test email TO.
// IMPORTANT: Change this to an email address you can access.
const TEST_RECIPIENT = '758wess@gmail.com'; 
// -------------------

async function testEmail() {
    console.log('🔍 Testing Email Configuration...');
    console.log('================================');

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME, SMTP_FROM } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        console.error('❌ Missing required SMTP environment variables in .env file.');
        console.error('   Please ensure SMTP_HOST, SMTP_USER, and SMTP_PASS are set.');
        process.exit(1);
    }

    if (TEST_RECIPIENT === 'test@example.com') {
        console.error('❌ Please open `test-email.js` and change `TEST_RECIPIENT` to your own email address.');
        process.exit(1);
    }

    console.log(`SMTP Host: ${SMTP_HOST}`);
    console.log(`SMTP Port: ${SMTP_PORT || '587 (default)'}`);
    console.log(`SMTP User: ${SMTP_USER}`);

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT || 587,
        secure: SMTP_PORT == 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
        // Add this for more detailed logs
        logger: true,
        debug: true 
    });

    try {
        console.log('\n[1/2] Verifying SMTP connection...');
        await transporter.verify();
        console.log('✅ SMTP Connection and Authentication successful.');
    } catch (error) {
        console.error('❌ SMTP Connection or Authentication failed!');
        console.error(error);
        console.log('\n🤔 Common Issues:');
        console.log('   - Incorrect SMTP_HOST, SMTP_PORT, SMTP_USER, or SMTP_PASS in your .env file.');
        console.log('   - Firewall blocking the connection to the SMTP port.');
        console.log('   - If using Gmail, you may need an "App Password" instead of your regular password.');
        console.log('   - Your email provider may have other specific security requirements.');
        process.exit(1);
    }

    const fromAddress = `"${SMTP_FROM_NAME || 'Santander Support'}" <${SMTP_FROM || SMTP_USER}>`;

    try {
        console.log(`\n[2/2] Sending a test email to ${TEST_RECIPIENT}...`);
        console.log(`      From: ${fromAddress}`);
        
        const info = await transporter.sendMail({
            from: fromAddress,
            to: TEST_RECIPIENT,
            subject: 'Nodemailer Test Email',
            text: 'This is a test email from your application.',
            html: '<p>This is a test email from your application.</p>',
        });

        console.log('✅ Test email sent successfully!');
        console.log('   Message ID:', info.messageId);
        console.log('\n🎉 Your SMTP configuration appears to be correct.');
        console.log(`   Check the inbox (and spam folder) of ${TEST_RECIPIENT}.`);

    } catch (error) {
        console.error('❌ Failed to send test email!');
        console.error(error);
        console.log('\n🤔 Common Issues:');
        console.log('   - The "From" address might not be authorized by your email provider (it often must match the SMTP_USER).');
        console.log('   - The recipient email address might be invalid or rejecting emails.');
        console.log('   - Your email provider may have rate limits or other sending restrictions.');
    }
}

testEmail();