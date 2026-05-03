export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  encoding?: BufferEncoding;
}

export interface EmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  sendMail(options: EmailOptions): Promise<void>;
}
