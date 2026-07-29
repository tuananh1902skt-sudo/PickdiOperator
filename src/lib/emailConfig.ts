import { getAppConfig, setAppConfig } from '../db';

export interface EmailConfig {
  email: string;
  password: string;
  imapHost: string;
  imapPort: number | null;
  smtpHost: string;
  smtpPort: number | null;
  smtpSecure?: boolean;
  brand?: string;
  product?: string;
  lastImapUid?: number;
}

const CONFIG_KEY = 'emailConfig';
const EMPTY: EmailConfig = {
  email: '',
  password: '',
  imapHost: '',
  imapPort: null,
  smtpHost: '',
  smtpPort: null,
};

export async function getEmailConfig(): Promise<EmailConfig> {
  try {
    return await getAppConfig<EmailConfig>(CONFIG_KEY, EMPTY);
  } catch (err) {
    console.error('Error reading email config:', err);
    return EMPTY;
  }
}

export async function saveEmailConfig(partial: Partial<EmailConfig>): Promise<EmailConfig> {
  const current = await getEmailConfig();

  const updated: EmailConfig = {
    email: partial.email !== undefined ? partial.email : current.email,
    password: (partial.password && partial.password.trim() !== '') ? partial.password : current.password,
    imapHost: partial.imapHost !== undefined ? partial.imapHost : current.imapHost,
    imapPort: partial.imapPort !== undefined ? partial.imapPort : current.imapPort,
    smtpHost: partial.smtpHost !== undefined ? partial.smtpHost : current.smtpHost,
    smtpPort: partial.smtpPort !== undefined ? partial.smtpPort : current.smtpPort,
    smtpSecure: partial.smtpSecure !== undefined ? partial.smtpSecure : current.smtpSecure,
    brand: partial.brand !== undefined ? partial.brand : current.brand,
    product: partial.product !== undefined ? partial.product : current.product,
    lastImapUid: partial.lastImapUid !== undefined ? partial.lastImapUid : current.lastImapUid,
  };

  await setAppConfig(CONFIG_KEY, updated);
  return updated;
}

export async function saveLastImapUid(uid: number): Promise<void> {
  const current = await getEmailConfig();
  current.lastImapUid = uid;
  await setAppConfig(CONFIG_KEY, current);
}
