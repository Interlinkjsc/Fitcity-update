const nodemailer = require('nodemailer');

let transporter = null;

function buildTransporter() {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) return null;

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
    });
    return transporter;
}

exports.sendClientWelcomeEmail = async (client, source = 'system') => {
    try {
        const t = buildTransporter();
        if (!t) return { skipped: true, reason: 'smtp_not_configured' };
        if (!client?.email) return { skipped: true, reason: 'missing_email' };

        const from = process.env.MAIL_FROM || process.env.SMTP_USER;
        const appName = process.env.APP_NAME || 'FitCity';

        await t.sendMail({
            from,
            to: client.email,
            subject: `Chao mung ban den voi ${appName}`,
            text:
                `Xin chao ${client.name || 'ban'},\n\n` +
                `Tai khoan hoi vien cua ban da duoc tao thanh cong (${source}).\n` +
                'Vui long dang nhap de xem lich tap, hop dong va thong tin ca nhan.\n\n' +
                `Tran trong,\n${appName}`
        });
        return { sent: true };
    } catch (err) {
        console.error('[WelcomeEmail] send failed:', err.message);
        return { sent: false, error: err.message };
    }
};
