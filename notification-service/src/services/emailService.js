const nodemailer = require("nodemailer");

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

const sendEmail = async ({ to, subject, html }) => {
  return getTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to:      Array.isArray(to) ? to.join(", ") : to,
    subject,
    html,
  });
};

const verifyConnection = async () => {
  try {
    await getTransporter().verify();
    return true;
  } catch {
    return false;
  }
};

module.exports = { sendEmail, verifyConnection };
