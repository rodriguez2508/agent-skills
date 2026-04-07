/**
 * Email Service (Mock Implementation)
 *
 * Handles sending emails for verification and password reset.
 * Replace with actual email provider (SendGrid, AWS SES, etc.) in production.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly appName: string;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail =
      this.configService.get<string>('EMAIL_FROM') || 'noreply@example.com';
    this.appName =
      this.configService.get<string>('APP_NAME') || 'Agent Skills API';
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(
    to: string,
    verificationUrl: string,
    userName?: string,
  ): Promise<void> {
    const subject = 'Verify your email';
    const html = this.buildVerificationEmailHtml(verificationUrl, userName);
    const text = this.buildVerificationEmailText(verificationUrl, userName);

    await this.sendEmail({ to, subject, html, text });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
    userName?: string,
  ): Promise<void> {
    const subject = 'Reset your password';
    const html = this.buildPasswordResetEmailHtml(resetUrl, userName);
    const text = this.buildPasswordResetEmailText(resetUrl, userName);

    await this.sendEmail({ to, subject, html, text });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(to: string, userName?: string): Promise<void> {
    const subject = 'Welcome!';
    const html = this.buildWelcomeEmailHtml(userName);
    const text = this.buildWelcomeEmailText(userName);

    await this.sendEmail({ to, subject, html, text });
  }

  /**
   * Send email (mock implementation - log to console)
   * In production, integrate with SendGrid, AWS SES, etc.
   */
  private async sendEmail(options: EmailOptions): Promise<void> {
    this.logger.log(`📧 Email would be sent to: ${options.to}`);
    this.logger.log(`📝 Subject: ${options.subject}`);
    this.logger.log(`📄 HTML: ${options.html.substring(0, 200)}...`);

    // In production, replace with actual email sending logic
    // Example with nodemailer:
    // const transporter = nodemailer.createTransport({ ... });
    // await transporter.sendMail({
    //   from: this.fromEmail,
    //   to: options.to,
    //   subject: options.subject,
    //   html: options.html,
    //   text: options.text,
    // });
  }

  private buildVerificationEmailHtml(
    verificationUrl: string,
    userName?: string,
  ): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Welcome${userName ? `, ${userName}` : ''}!</h2>
          <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
          <p>
            <a href="${verificationUrl}" 
               style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">
              Verify Email
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p><a href="${verificationUrl}">${verificationUrl}</a></p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, please ignore this email.</p>
        </body>
      </html>
    `;
  }

  private buildVerificationEmailText(
    verificationUrl: string,
    userName?: string,
  ): string {
    return `
Welcome${userName ? `, ${userName}` : ''}!

Thank you for registering. Please verify your email address by visiting this link:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, please ignore this email.
    `.trim();
  }

  private buildPasswordResetEmailHtml(
    resetUrl: string,
    userName?: string,
  ): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Password Reset Request${userName ? `, ${userName}` : ''}</h2>
          <p>You requested to reset your password. Click the button below to proceed:</p>
          <p>
            <a href="${resetUrl}" 
               style="display: inline-block; padding: 12px 24px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 4px;">
              Reset Password
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
        </body>
      </html>
    `;
  }

  private buildPasswordResetEmailText(
    resetUrl: string,
    userName?: string,
  ): string {
    return `
Password Reset Request${userName ? `, ${userName}` : ''}

You requested to reset your password. Visit this link to proceed:

${resetUrl}

This link will expire in 24 hours.

If you didn't request a password reset, please ignore this email and your password will remain unchanged.
    `.trim();
  }

  private buildWelcomeEmailHtml(userName?: string): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Welcome${userName ? `, ${userName}` : ''}!</h2>
          <p>Your email has been verified successfully.</p>
          <p>You can now enjoy all the features of our platform.</p>
        </body>
      </html>
    `;
  }

  private buildWelcomeEmailText(userName?: string): string {
    return `
Welcome${userName ? `, ${userName}` : ''}!

Your email has been verified successfully.
You can now enjoy all the features of our platform.
    `.trim();
  }
}
