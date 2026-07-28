import { getAppConfig, setAppConfig } from '../db';

export interface EmailConfig {
  gmailUser: string;
  appPassword: string;
  brand?: string;
  product?: string;
  lastImapUid?: number;
}

const CONFIG_KEY = 'emailConfig';
const EMPTY: EmailConfig = { gmailUser: '', appPassword: '' };

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
    gmailUser: partial.gmailUser !== undefined ? partial.gmailUser : current.gmailUser,
    appPassword: (partial.appPassword && partial.appPassword.trim() !== '') ? partial.appPassword : current.appPassword,
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
