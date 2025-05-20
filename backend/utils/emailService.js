/**
 * RedBird Email Service
 * Handles email communications with users
 */
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const logger = require('./utils/logger');

class EmailService {
  constructor() {
    // Create reusable transporter using environment variables
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Template directory
    this.templateDir = path.join(__dirname, '../templates/emails');
  }

  /**
   * Send an email using a template
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} options.template - Template name (without extension)
   * @param {Object} options.data - Data to pass to the template
   * @returns {Promise} - Nodemailer response
   */
  async sendEmail({ to, subject, template, data }) {
    try {
      // Load template
      const templatePath = path.join(this.templateDir, `${template}.ejs`);
      
      // Fallback to string template if file doesn't exist
      let html;
      if (fs.existsSync(templatePath)) {
        // Render template with data
        html = await ejs.renderFile(templatePath, data);
      } else {
        // Basic fallback template
        html = this._generateBasicTemplate(data);
      }

      // Send email
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'RedBird Real Estate'}" <${process.env.EMAIL_FROM || 'noreply@redbird-realestate.com'}>`,
        to,
        subject,
        html
      };

      const info = await this.transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      logger.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Generate basic email template as fallback
   * @param {Object} data - Template data
   * @returns {string} - HTML email content
   */
  _generateBasicTemplate(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #777; }
          .btn { display: inline-block; background-color: #e72e2e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.title || 'RedBird Real Estate'}</h1>
          </div>
          <p>Hallo ${data.name || 'Kunde'},</p>
          <p>${data.message || ''}</p>
          ${data.actionUrl ? `<p style="text-align:center;margin-top:30px;"><a href="${data.actionUrl}" class="btn">${data.actionText || 'Weiter'}</a></p>` : ''}
          <p>Mit freundlichen Grüßen,<br>Ihr RedBird Team</p>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} RedBird Real Estate. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send password reset email
   * @param {string} to - Recipient email
   * @param {string} name - Recipient name
   * @param {string} resetUrl - Password reset URL with token
   * @returns {Promise} - Email send result
   */
  async sendPasswordReset(to, name, resetUrl) {
    return this.sendEmail({
      to,
      subject: 'Passwort zurücksetzen - RedBird Real Estate',
      template: 'password-reset',
      data: {
        title: 'Passwort zurücksetzen',
        name,
        message: 'Sie haben angefordert, Ihr Passwort zurückzusetzen. Bitte klicken Sie auf den untenstehenden Button, um Ihr Passwort neu zu setzen. Dieser Link ist 1 Stunde gültig.',
        actionUrl: resetUrl,
        actionText: 'Passwort zurücksetzen'
      }
    });
  }

  /**
   * Send contact form confirmation email to the user
   * @param {string} to - Recipient email
   * @param {string} name - Recipient name
   * @returns {Promise} - Email send result
   */
  async sendContactConfirmation(to, name) {
    return this.sendEmail({
      to,
      subject: 'Vielen Dank für Ihre Kontaktanfrage - RedBird Real Estate',
      template: 'contact-confirmation',
      data: {
        title: 'Ihre Anfrage wurde erfolgreich übermittelt',
        name,
        message: 'Vielen Dank für Ihre Kontaktanfrage. Wir haben Ihre Anfrage erhalten und werden uns innerhalb von 24 Stunden bei Ihnen melden. Dies ist eine automatische Bestätigung, bitte antworten Sie nicht auf diese E-Mail.',
        actionUrl: process.env.WEBSITE_URL || 'https://redbird-realestate.com',
        actionText: 'Zurück zur Website'
      }
    });
  }

  /**
   * Send contact form notification to admin
   * @param {string} to - Admin email
   * @param {Object} formData - Contact form data
   * @returns {Promise} - Email send result
   */
  async sendContactNotification(to, formData) {
    const { name, email, phone, subject, message } = formData;
    
    const formattedMessage = `
      <strong>Neue Kontaktanfrage</strong>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>E-Mail:</strong> ${email}</p>
      <p><strong>Telefon:</strong> ${phone}</p>
      <p><strong>Betreff:</strong> ${subject}</p>
      <p><strong>Nachricht:</strong></p>
      <p style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #e72e2e;">${message.replace(/\n/g, '<br>')}</p>
    `;

    return this.sendEmail({
      to,
      subject: `Neue Kontaktanfrage: ${subject}`,
      template: 'contact-notification',
      data: {
        title: 'Neue Kontaktanfrage',
        name: 'Administrator',
        message: formattedMessage,
        actionUrl: process.env.ADMIN_URL || 'https://app.redbird-realestate.com/admin',
        actionText: 'Zum Admin-Bereich'
      }
    });
  }
}

module.exports = new EmailService();