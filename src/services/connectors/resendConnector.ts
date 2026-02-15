/**
 * Resend Connector
 * 
 * Handles email campaigns, sending, and tracking with Resend API
 * https://resend.com/docs/api-reference
 * 
 * Supports multiple Resend accounts - API keys are stored per-account in the database
 */

import storage, { STORAGE_KEYS } from '../electronStore';
import { db } from '../database';

export interface ResendEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  created_at: string;
  last_event?: string;
  clicks?: number;
  opens?: number;
}

export interface ResendEmailEvent {
  id: string;
  email_id: string;
  type: 'email.sent' | 'email.delivered' | 'email.bounced' | 'email.opened' | 'email.clicked' | 'email.complained';
  created_at: string;
  data?: {
    click_url?: string;
    user_agent?: string;
  };
}

export interface ResendAudience {
  id: string;
  name: string;
  created_at: string;
}

export interface ResendContact {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  unsubscribed: boolean;
  created_at: string;
}

export interface ResendDomain {
  id: string;
  name: string;
  status: 'not_started' | 'pending' | 'verified' | 'failed';
  created_at: string;
  region: string;
  records: Array<{
    record: string;
    name: string;
    type: string;
    ttl: string;
    status: 'not_started' | 'pending' | 'verified' | 'failed';
    value: string;
    priority?: number;
  }>;
}

export interface CampaignDraft {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string;
  tags?: { name: string; value: string }[];
}

export interface SendEmailResponse {
  id: string;
}

export interface ResendApiError {
  statusCode: number;
  message: string;
  name: string;
}

/**
 * Get all connected Resend accounts from the database
 */
export async function getResendAccounts(): Promise<{ id: string; name: string; email: string; apiKey: string }[]> {
  const accounts = await db.accounts.getAll();
  const resendAccounts = accounts.filter(a => a.platform === 'resend');
  
  const result = [];
  for (const account of resendAccounts) {
    const keys = await storage.get(`aether-hub_keys_resend_${account.id}`) as { apiKey?: string } | null;
    if (keys?.apiKey) {
      result.push({
        id: account.id,
        name: account.name,
        email: account.email,
        apiKey: keys.apiKey
      });
    }
  }
  return result;
}

/**
 * Get the stored Resend API key for a specific account (or first available)
 */
export async function getResendApiKey(accountId?: string): Promise<string | null> {
  // If specific account requested
  if (accountId) {
    const keys = await storage.get(`aether-hub_keys_resend_${accountId}`) as { apiKey?: string } | null;
    return keys?.apiKey || null;
  }
  
  // Otherwise get first available Resend account
  const accounts = await getResendAccounts();
  if (accounts.length > 0) {
    return accounts[0].apiKey;
  }
  
  // Fallback to legacy storage key for backwards compatibility
  const legacyKey = await storage.get(STORAGE_KEYS.RESEND_KEY);
  if (legacyKey && typeof legacyKey === 'string') return legacyKey;

  // Fallback to environment variable
  return (process.env.RESEND_API_KEY as string) || null;
}

/**
 * Save Resend API key for an account
 */
export async function saveResendApiKey(accountId: string, apiKey: string): Promise<void> {
  await storage.set(`aether-hub_keys_resend_${accountId}`, { apiKey });
}

/**
 * Remove Resend API key for an account
 */
export async function removeResendApiKey(accountId: string): Promise<void> {
  await storage.remove(`aether-hub_keys_resend_${accountId}`);
}

/**
 * Validate Resend API key by fetching domains (via IPC to avoid CORS)
 */
export async function validateResendApiKey(apiKey: string): Promise<boolean> {
  try {
    if (!window.electronAPI?.resend?.validateApiKey) {
      console.error('Resend IPC not available');
      return false;
    }
    return await window.electronAPI.resend.validateApiKey(apiKey);
  } catch (error) {
    console.error('Failed to validate Resend API key:', error);
    return false;
  }
}

/**
 * Get all domains configured in Resend (via IPC to avoid CORS)
 */
export async function getDomains(): Promise<ResendDomain[]> {
  const apiKey = await getResendApiKey();
  if (!apiKey) throw new Error('Resend API key not configured');
  if (!window.electronAPI?.resend?.getDomains) throw new Error('Resend IPC not available');

  const data = await window.electronAPI.resend.getDomains(apiKey);
  return data.data || [];
}

/**
 * Get all audiences (contact lists) - via IPC to avoid CORS
 */
export async function getAudiences(): Promise<ResendAudience[]> {
  const apiKey = await getResendApiKey();
  if (!apiKey) throw new Error('Resend API key not configured');
  if (!window.electronAPI?.resend?.getAudiences) throw new Error('Resend IPC not available');

  const data = await window.electronAPI.resend.getAudiences(apiKey);
  return data.data || [];
}

/**
 * Create a new audience - via IPC to avoid CORS
 */
export async function createAudience(name: string): Promise<ResendAudience> {
  const apiKey = await getResendApiKey();
  if (!apiKey) throw new Error('Resend API key not configured');
  if (!window.electronAPI?.resend?.createAudience) throw new Error('Resend IPC not available');

  return await window.electronAPI.resend.createAudience(apiKey, name);
}

/**
 * Get contacts in an audience - via IPC to avoid CORS
 */
export async function getContacts(audienceId: string): Promise<ResendContact[]> {
  const apiKey = await getResendApiKey();
  if (!apiKey) throw new Error('Resend API key not configured');
  if (!window.electronAPI?.resend?.getContacts) throw new Error('Resend IPC not available');

  const data = await window.electronAPI.resend.getContacts(apiKey, audienceId);
  return data.data || [];
}

/**
 * Add a contact to an audience - via IPC to avoid CORS
 */
export async function addContact(
  audienceId: string, 
  contact: { email: string; first_name?: string; last_name?: string; unsubscribed?: boolean }
): Promise<ResendContact> {
  const apiKey = await getResendApiKey();
  if (!apiKey) throw new Error('Resend API key not configured');
  if (!window.electronAPI?.resend?.addContact) throw new Error('Resend IPC not available');

  return await window.electronAPI.resend.addContact(apiKey, audienceId, contact);
}

/**
 * Remove a contact from an audience - via IPC to avoid CORS
 */
export async function removeContact(audienceId: string, contactId: string): Promise<void> {
  const apiKey = await getResendApiKey();
  if (!apiKey) throw new Error('Resend API key not configured');
  if (!window.electronAPI?.resend?.removeContact) throw new Error('Resend IPC not available');

  await window.electronAPI.resend.removeContact(apiKey, audienceId, contactId);
}

/**
 * Send a single email - via IPC to avoid CORS
 */
export async function sendEmail(email: CampaignDraft): Promise<SendEmailResponse> {
  const apiKey = await getResendApiKey();
  if (!apiKey) throw new Error('Resend API key not configured');
  if (!window.electronAPI?.resend?.sendEmail) throw new Error('Resend IPC not available');

  return await window.electronAPI.resend.sendEmail(apiKey, email);
}

/**
 * Send campaign to an audience
 */
export async function sendCampaign(
  audienceId: string,
  from: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ sent: number; failed: number; emailIds: string[] }> {
  const contacts = await getContacts(audienceId);
  const activeContacts = contacts.filter(c => !c.unsubscribed);
  
  const results = { sent: 0, failed: 0, emailIds: [] as string[] };
  
  for (const contact of activeContacts) {
    try {
      const result = await sendEmail({
        from,
        to: [contact.email],
        subject,
        html,
        text,
      });
      results.sent++;
      results.emailIds.push(result.id);
    } catch (error) {
      console.error(`Failed to send to ${contact.email}:`, error);
      results.failed++;
    }
  }
  
  return results;
}

/**
 * Get email details by ID - via IPC to avoid CORS
 */
export async function getEmail(emailId: string): Promise<ResendEmail | null> {
  const apiKey = await getResendApiKey();
  if (!apiKey) throw new Error('Resend API key not configured');
  if (!window.electronAPI?.resend?.getEmail) throw new Error('Resend IPC not available');

  return await window.electronAPI.resend.getEmail(apiKey, emailId);
}

/**
 * Get received emails (inbox) - via IPC to avoid CORS
 */
export async function getReceivedEmails(limit?: number): Promise<ResendEmail[]> {
  const apiKey = await getResendApiKey();
  if (!apiKey) throw new Error('Resend API key not configured');
  if (!window.electronAPI?.resend?.getReceivedEmails) throw new Error('Resend IPC not available');

  const response = await window.electronAPI.resend.getReceivedEmails(apiKey, limit);
  console.log('📧 getReceivedEmails response:', response);
  
  // Response structure: { data: [...emails] }
  return response.data || [];
}

/**
 * Get sent emails from Resend API + merge with locally stored emails
 */
export async function getSentEmails(): Promise<ResendEmail[]> {
  try {
    const apiKey = await getResendApiKey();
    if (!apiKey || !window.electronAPI?.resend?.getSentEmails) {
      console.log('📧 Resend API not configured, loading from database only');
      const dbEmails = await db.resendSentEmails.getAll(100);
      return dbEmails.map((e: any) => ({
        id: e.id,
        from: e.from_email,
        to: JSON.parse(e.to_emails),
        subject: e.subject,
        html: e.html || undefined,
        text: e.text || undefined,
        created_at: e.created_at,
        last_event: e.last_event || undefined,
        clicks: e.clicks || 0,
        opens: e.opens || 0,
      }));
    }

    // Fetch from Resend API
    const response = await window.electronAPI.resend.getSentEmails(apiKey, 100);
    console.log('📧 Resend API response:', response);
    
    // Response structure: { data: [...emails] }
    const apiEmails = response.data || [];
    
    // Also get database emails
    const dbEmails = await db.resendSentEmails.getAll(100);
    const localEmails = dbEmails.map((e: any) => ({
      id: e.id,
      from: e.from_email,
      to: JSON.parse(e.to_emails),
      subject: e.subject,
      html: e.html || undefined,
      text: e.text || undefined,
      created_at: e.created_at,
      last_event: e.last_event || undefined,
      clicks: e.clicks || 0,
      opens: e.opens || 0,
    }));
    
    // Merge and deduplicate by ID
    const emailMap = new Map<string, ResendEmail>();
    [...localEmails, ...apiEmails].forEach(email => {
      emailMap.set(email.id, email);
    });
    
    return Array.from(emailMap.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch (error) {
    console.error('Failed to load sent emails from API, using database:', error);
    const dbEmails = await db.resendSentEmails.getAll(100);
    return dbEmails.map((e: any) => ({
      id: e.id,
      from: e.from_email,
      to: JSON.parse(e.to_emails),
      subject: e.subject,
      html: e.html || undefined,
      text: e.text || undefined,
      created_at: e.created_at,
      last_event: e.last_event || undefined,
      clicks: e.clicks || 0,
      opens: e.opens || 0,
    }));
  }
}

/**
 * Store a sent email in database
 */
export async function storeSentEmail(email: ResendEmail): Promise<void> {
  await db.resendSentEmails.create({
    id: email.id,
    from_email: email.from,
    to_emails: JSON.stringify(email.to),
    subject: email.subject,
    html: email.html,
    text: email.text,
    created_at: email.created_at,
  });
  
  if (email.last_event) {
    await db.resendSentEmails.updateEvent(email.id, email.last_event, email.clicks, email.opens);
  }
}

/**
 * Get email templates (stored in database)
 */
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  text?: string;
  created_at: string;
}

export async function getTemplates(): Promise<EmailTemplate[]> {
  const templates = await db.resendTemplates.getAll();
  return templates || [];
}

export async function saveTemplate(template: Omit<EmailTemplate, 'id' | 'created_at'>): Promise<EmailTemplate> {
  const newTemplate: EmailTemplate = {
    ...template,
    id: `tpl_${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  await db.resendTemplates.create(newTemplate);
  return newTemplate;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await db.resendTemplates.delete(templateId);
}

export default {
  getResendApiKey,
  validateResendApiKey,
  getDomains,
  getAudiences,
  createAudience,
  getContacts,
  addContact,
  removeContact,
  sendEmail,
  sendCampaign,
  getEmail,
  getReceivedEmails,
  getSentEmails,
  storeSentEmail,
  getTemplates,
  saveTemplate,
  deleteTemplate,
};
