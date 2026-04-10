export interface EmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: [
    {
      filename: string;
      content: string | Buffer;
      encoding: string;
    },
  ];
}

export interface EmailProvider {
  sendMail(options: EmailOptions): Promise<void>;
}
