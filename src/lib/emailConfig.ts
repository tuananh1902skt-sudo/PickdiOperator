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
  // Marketing-style HTML outreach email branding — logoUrl must be a publicly reachable
  // URL (email clients fetch images over the open internet, not from this app's server).
  logoUrl?: string;
  primaryColor?: string;
  // Sign-off name used in the first-contact outreach email ("Best regards, {senderName}").
  // Defaults to "Juan" when unset — see DEFAULT_SENDER_NAME below.
  senderName?: string;
  // Pre-fills the CC field on the outreach composer/bulk-send modals (operator can still
  // edit or clear it per send) — comma-separated for multiple addresses.
  defaultCc?: string;
  lastImapUid?: number;
}

export const DEFAULT_SENDER_NAME = 'Juan';

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
    logoUrl: partial.logoUrl !== undefined ? partial.logoUrl : current.logoUrl,
    primaryColor: partial.primaryColor !== undefined ? partial.primaryColor : current.primaryColor,
    senderName: partial.senderName !== undefined ? partial.senderName : current.senderName,
    defaultCc: partial.defaultCc !== undefined ? partial.defaultCc : current.defaultCc,
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
