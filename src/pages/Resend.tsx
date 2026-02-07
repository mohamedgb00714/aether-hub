import React, { useState, useEffect, useRef } from 'react';
import storage, { STORAGE_KEYS } from '../services/electronStore';
import resendConnector, { 
  ResendAudience, 
  ResendContact, 
  ResendDomain,
  EmailTemplate,
  ResendEmail,
  CampaignDraft
} from '../services/connectors/resendConnector';
import {
  PaperAirplaneIcon,
  UserGroupIcon,
  EnvelopeIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  DocumentTextIcon,
  ChartBarIcon,
  XMarkIcon,
  EyeIcon,
  PencilIcon,
  ClockIcon,
  SparklesIcon,
  GlobeAltIcon,
  UserPlusIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/solid';
import { callAI } from '../services/geminiService';

// Tab type for navigation
type TabType = 'compose' | 'audiences' | 'templates' | 'history' | 'domains';

const ResendPage: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('compose');
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Domains
  const [domains, setDomains] = useState<ResendDomain[]>([]);
  
  // Audiences & Contacts
  const [audiences, setAudiences] = useState<ResendAudience[]>([]);
  const [selectedAudience, setSelectedAudience] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ResendContact[]>([]);
  const [newAudienceName, setNewAudienceName] = useState('');
  const [showNewAudience, setShowNewAudience] = useState(false);
  const [newContact, setNewContact] = useState({ email: '', first_name: '', last_name: '' });
  const [showAddContact, setShowAddContact] = useState(false);
  
  // Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);
  
  // Sent Emails History
  const [sentEmails, setSentEmails] = useState<ResendEmail[]>([]);
  
  // Compose
  const [campaign, setCampaign] = useState<CampaignDraft>({
    from: '',
    to: [],
    subject: '',
    html: '',
    text: '',
  });
  const [sendMode, setSendMode] = useState<'individual' | 'audience'>('individual');
  const [sending, setSending] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [recipientInput, setRecipientInput] = useState('');

  // Initialize - use ref to prevent double-invocation in StrictMode
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    checkConfiguration();
  }, []);

  useEffect(() => {
    if (selectedAudience) {
      loadContacts(selectedAudience);
    }
  }, [selectedAudience]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const checkConfiguration = async () => {
    setLoading(true);
    try {
      const apiKey = await resendConnector.getResendApiKey();
      if (apiKey) {
        const isValid = await resendConnector.validateResendApiKey(apiKey);
        setIsConfigured(isValid);
        if (isValid) {
          await loadData();
        }
      } else {
        setIsConfigured(false);
      }
    } catch (error) {
      console.error('Configuration check failed:', error);
      setIsConfigured(false);
    }
    setLoading(false);
  };

  const loadData = async () => {
    try {
      // Only load domains on init - other data loads when user navigates to tabs
      const domainsData = await resendConnector.getDomains();
      setDomains(domainsData);
      
      // Set default from address
      const verifiedDomain = domainsData.find(d => d.status === 'verified');
      if (verifiedDomain && !campaign.from) {
        setCampaign(prev => ({ ...prev, from: `noreply@${verifiedDomain.name}` }));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('Failed to load Resend data', 'error');
    }
  };

  // Lazy load audiences when tab is activated
  const loadAudiences = async () => {
    if (audiences.length > 0) return; // Already loaded
    try {
      const audiencesData = await resendConnector.getAudiences();
      setAudiences(audiencesData);
    } catch (error) {
      console.error('Failed to load audiences:', error);
      showToast('Failed to load audiences', 'error');
    }
  };

  // Lazy load templates when tab is activated
  const loadTemplates = async () => {
    if (templates.length > 0) return; // Already loaded
    try {
      const templatesData = await resendConnector.getTemplates();
      setTemplates(templatesData);
    } catch (error) {
      console.error('Failed to load templates:', error);
      showToast('Failed to load templates', 'error');
    }
  };

  // Lazy load sent emails when tab is activated
  const loadSentEmails = async () => {
    if (sentEmails.length > 0) return; // Already loaded
    try {
      const emailsData = await resendConnector.getSentEmails();
      setSentEmails(emailsData);
    } catch (error) {
      console.error('Failed to load sent emails:', error);
      showToast('Failed to load sent emails', 'error');
    }
  };

  // Load data when tab changes
  useEffect(() => {
    if (!isConfigured) return;
    
    if (activeTab === 'audiences') {
      loadAudiences();
    } else if (activeTab === 'templates') {
      loadTemplates();
    } else if (activeTab === 'history') {
      loadSentEmails();
    }
  }, [activeTab, isConfigured]);

  const loadContacts = async (audienceId: string) => {
    try {
      const contactsData = await resendConnector.getContacts(audienceId);
      setContacts(contactsData);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      showToast('Failed to load contacts', 'error');
    }
  };

  const handleCreateAudience = async () => {
    if (!newAudienceName.trim()) return;
    try {
      const audience = await resendConnector.createAudience(newAudienceName);
      setAudiences(prev => [...prev, audience]);
      setNewAudienceName('');
      setShowNewAudience(false);
      showToast(`Audience "${newAudienceName}" created`);
    } catch (error: any) {
      showToast(error.message || 'Failed to create audience', 'error');
    }
  };

  const handleAddContact = async () => {
    if (!selectedAudience || !newContact.email) return;
    try {
      const contact = await resendConnector.addContact(selectedAudience, newContact);
      setContacts(prev => [...prev, contact]);
      setNewContact({ email: '', first_name: '', last_name: '' });
      setShowAddContact(false);
      showToast('Contact added successfully');
    } catch (error: any) {
      showToast(error.message || 'Failed to add contact', 'error');
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!selectedAudience) return;
    try {
      await resendConnector.removeContact(selectedAudience, contactId);
      setContacts(prev => prev.filter(c => c.id !== contactId));
      showToast('Contact removed');
    } catch (error: any) {
      showToast(error.message || 'Failed to remove contact', 'error');
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate?.name || !editingTemplate?.subject) return;
    try {
      const saved = await resendConnector.saveTemplate({
        name: editingTemplate.name,
        subject: editingTemplate.subject,
        html: editingTemplate.html || '',
        text: editingTemplate.text,
      });
      setTemplates(prev => [...prev, saved]);
      setEditingTemplate(null);
      showToast('Template saved');
    } catch (error: any) {
      showToast(error.message || 'Failed to save template', 'error');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await resendConnector.deleteTemplate(templateId);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      showToast('Template deleted');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete template', 'error');
    }
  };

  const handleLoadTemplate = (template: EmailTemplate) => {
    setCampaign(prev => ({
      ...prev,
      subject: template.subject,
      html: template.html,
      text: template.text || '',
    }));
    setActiveTab('compose');
    showToast('Template loaded');
  };

  const addRecipient = () => {
    if (!recipientInput.trim()) return;
    // Support comma-separated emails
    const emails = recipientInput.split(',').map(e => e.trim()).filter(e => e);
    setCampaign(prev => ({
      ...prev,
      to: [...new Set([...prev.to, ...emails])],
    }));
    setRecipientInput('');
  };

  const removeRecipient = (email: string) => {
    setCampaign(prev => ({
      ...prev,
      to: prev.to.filter(e => e !== email),
    }));
  };

  const handleSendCampaign = async () => {
    if (!campaign.from || !campaign.subject || (!campaign.html && !campaign.text)) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setSending(true);
    try {
      if (sendMode === 'audience' && selectedAudience) {
        const result = await resendConnector.sendCampaign(
          selectedAudience,
          campaign.from,
          campaign.subject,
          campaign.html || '',
          campaign.text
        );
        showToast(`Campaign sent! ${result.sent} delivered, ${result.failed} failed`);
        
        // Store in history
        for (const emailId of result.emailIds) {
          await resendConnector.storeSentEmail({
            id: emailId,
            from: campaign.from,
            to: [],
            subject: campaign.subject,
            html: campaign.html,
            created_at: new Date().toISOString(),
            last_event: 'sent',
          });
        }
      } else {
        if (campaign.to.length === 0) {
          showToast('Please add at least one recipient', 'error');
          setSending(false);
          return;
        }
        
        const result = await resendConnector.sendEmail(campaign);
        showToast('Email sent successfully!');
        
        // Store in history
        await resendConnector.storeSentEmail({
          id: result.id,
          from: campaign.from,
          to: campaign.to,
          subject: campaign.subject,
          html: campaign.html,
          created_at: new Date().toISOString(),
          last_event: 'sent',
        });
      }
      
      // Refresh history
      const updated = await resendConnector.getSentEmails();
      setSentEmails(updated);
      
      // Clear form
      setCampaign(prev => ({ ...prev, to: [], subject: '', html: '', text: '' }));
    } catch (error: any) {
      showToast(error.message || 'Failed to send campaign', 'error');
    }
    setSending(false);
  };

  const generateWithAI = async () => {
    if (!campaign.subject) {
      showToast('Please enter a subject first', 'error');
      return;
    }
    
    setGeneratingAI(true);
    try {
      const prompt = `Generate a professional HTML email template for the following subject: "${campaign.subject}"
      
Requirements:
- Clean, modern design with inline CSS styles
- Professional tone
- Include a clear call-to-action button
- Mobile-responsive layout
- Use a clean color scheme (blues and grays)
- Include placeholder text that can be customized
- Keep it concise and scannable

Return ONLY the HTML code, no explanations.`;

      const result = await callAI(prompt);
      if (result) {
        setCampaign(prev => ({ ...prev, html: result }));
        showToast('Email content generated!');
      }
    } catch (error: any) {
      showToast('Failed to generate content', 'error');
    }
    setGeneratingAI(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <ArrowPathIcon className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading Resend configuration...</p>
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <EnvelopeIcon className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Connect Resend</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Configure your Resend API key to send email campaigns.<br/>
            Get your API key from the Resend dashboard.
          </p>
          <div className="space-y-4">
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-indigo-600 transition-colors"
            >
              <GlobeAltIcon className="w-5 h-5" />
              Get API Key from Resend
            </a>
            <p className="text-sm text-slate-400">
              Then add it in Settings → Integrations → Resend
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-10 py-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5 ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircleIcon className="w-5 h-5" />
          ) : (
            <ExclamationCircleIcon className="w-5 h-5" />
          )}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Email Campaigns</h1>
          <p className="text-slate-500 mt-1">Send and manage email campaigns with Resend</p>
        </div>
        <button
          onClick={() => loadData()}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
        {[
          { id: 'compose', label: 'Compose', icon: PencilIcon },
          { id: 'audiences', label: 'Audiences', icon: UserGroupIcon },
          { id: 'templates', label: 'Templates', icon: DocumentTextIcon },
          { id: 'history', label: 'History', icon: ClockIcon },
          { id: 'domains', label: 'Domains', icon: GlobeAltIcon },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Compose Tab */}
        {activeTab === 'compose' && (
          <div className="p-8 space-y-6">
            {/* Send Mode Toggle */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-slate-500">Send to:</span>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setSendMode('individual')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    sendMode === 'individual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Individual Emails
                </button>
                <button
                  onClick={() => setSendMode('audience')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    sendMode === 'audience' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Audience List
                </button>
              </div>
            </div>

            {/* From Address */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">From</label>
              <select
                value={campaign.from}
                onChange={(e) => setCampaign(prev => ({ ...prev, from: e.target.value }))}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              >
                <option value="">Select sender address</option>
                {domains.filter(d => d.status === 'verified').map(domain => (
                  <option key={domain.id} value={`noreply@${domain.name}`}>
                    noreply@{domain.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipients */}
            {sendMode === 'individual' ? (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">To</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addRecipient()}
                    placeholder="Enter email address(es), comma-separated"
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                  <button
                    onClick={addRecipient}
                    className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>
                {campaign.to.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {campaign.to.map(email => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium"
                      >
                        {email}
                        <button onClick={() => removeRecipient(email)}>
                          <XMarkIcon className="w-4 h-4 hover:text-indigo-900" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Select Audience</label>
                <select
                  value={selectedAudience || ''}
                  onChange={(e) => setSelectedAudience(e.target.value || null)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                >
                  <option value="">Choose an audience...</option>
                  {audiences.map(aud => (
                    <option key={aud.id} value={aud.id}>{aud.name}</option>
                  ))}
                </select>
                {selectedAudience && (
                  <p className="mt-2 text-sm text-slate-500">
                    {contacts.filter(c => !c.unsubscribed).length} active contacts will receive this campaign
                  </p>
                )}
              </div>
            )}

            {/* Subject */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Subject</label>
              <input
                type="text"
                value={campaign.subject}
                onChange={(e) => setCampaign(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Email subject line"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-slate-700">Email Content (HTML)</label>
                <button
                  onClick={generateWithAI}
                  disabled={generatingAI || !campaign.subject}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {generatingAI ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <SparklesIcon className="w-4 h-4" />
                  )}
                  Generate with AI
                </button>
              </div>
              <textarea
                value={campaign.html}
                onChange={(e) => setCampaign(prev => ({ ...prev, html: e.target.value }))}
                placeholder="<html>Your email HTML content...</html>"
                rows={12}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono text-sm"
              />
            </div>

            {/* Plain Text Fallback */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Plain Text (Optional)</label>
              <textarea
                value={campaign.text}
                onChange={(e) => setCampaign(prev => ({ ...prev, text: e.target.value }))}
                placeholder="Plain text version for email clients that don't support HTML"
                rows={4}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>

            {/* Send Button */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  setEditingTemplate({
                    name: '',
                    subject: campaign.subject,
                    html: campaign.html,
                    text: campaign.text,
                  });
                  setActiveTab('templates');
                }}
                className="flex items-center gap-2 px-5 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors"
              >
                <DocumentDuplicateIcon className="w-5 h-5" />
                Save as Template
              </button>
              <button
                onClick={handleSendCampaign}
                disabled={sending || !campaign.from || !campaign.subject || (!campaign.html && !campaign.text)}
                className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                ) : (
                  <PaperAirplaneIcon className="w-5 h-5" />
                )}
                {sendMode === 'audience' ? 'Send Campaign' : 'Send Email'}
              </button>
            </div>
          </div>
        )}

        {/* Audiences Tab */}
        {activeTab === 'audiences' && (
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">Manage Audiences</h2>
              <button
                onClick={() => setShowNewAudience(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                New Audience
              </button>
            </div>

            {showNewAudience && (
              <div className="mb-6 p-4 bg-slate-50 rounded-2xl flex gap-3">
                <input
                  type="text"
                  value={newAudienceName}
                  onChange={(e) => setNewAudienceName(e.target.value)}
                  placeholder="Audience name"
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  onClick={handleCreateAudience}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold"
                >
                  Create
                </button>
                <button
                  onClick={() => { setShowNewAudience(false); setNewAudienceName(''); }}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-6">
              {/* Audience List */}
              <div className="col-span-1 space-y-2">
                {audiences.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No audiences yet</p>
                ) : (
                  audiences.map(aud => (
                    <button
                      key={aud.id}
                      onClick={() => setSelectedAudience(aud.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selectedAudience === aud.id
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                          : 'bg-white border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <UserGroupIcon className={`w-5 h-5 ${
                          selectedAudience === aud.id ? 'text-indigo-600' : 'text-slate-400'
                        }`} />
                        <span className="font-bold">{aud.name}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Contacts List */}
              <div className="col-span-2 bg-slate-50 rounded-2xl p-6">
                {selectedAudience ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-900">
                        Contacts ({contacts.length})
                      </h3>
                      <button
                        onClick={() => setShowAddContact(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:border-indigo-300"
                      >
                        <UserPlusIcon className="w-4 h-4" />
                        Add Contact
                      </button>
                    </div>

                    {showAddContact && (
                      <div className="mb-4 p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                        <input
                          type="email"
                          value={newContact.email}
                          onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="Email address *"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newContact.first_name}
                            onChange={(e) => setNewContact(prev => ({ ...prev, first_name: e.target.value }))}
                            placeholder="First name"
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <input
                            type="text"
                            value={newContact.last_name}
                            onChange={(e) => setNewContact(prev => ({ ...prev, last_name: e.target.value }))}
                            placeholder="Last name"
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleAddContact}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => { setShowAddContact(false); setNewContact({ email: '', first_name: '', last_name: '' }); }}
                            className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {contacts.length === 0 ? (
                        <p className="text-slate-400 text-center py-8">No contacts in this audience</p>
                      ) : (
                        contacts.map(contact => (
                          <div
                            key={contact.id}
                            className={`flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 ${
                              contact.unsubscribed ? 'opacity-50' : ''
                            }`}
                          >
                            <div>
                              <p className="font-medium text-slate-900">
                                {contact.first_name || contact.last_name
                                  ? `${contact.first_name} ${contact.last_name}`.trim()
                                  : contact.email}
                              </p>
                              <p className="text-sm text-slate-500">{contact.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {contact.unsubscribed && (
                                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold">
                                  Unsubscribed
                                </span>
                              )}
                              <button
                                onClick={() => handleRemoveContact(contact.id)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <UserGroupIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select an audience to manage contacts</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">Email Templates</h2>
              <button
                onClick={() => setEditingTemplate({ name: '', subject: '', html: '', text: '' })}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                New Template
              </button>
            </div>

            {editingTemplate && (
              <div className="mb-6 p-6 bg-slate-50 rounded-2xl space-y-4">
                <input
                  type="text"
                  value={editingTemplate.name || ''}
                  onChange={(e) => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Template name"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <input
                  type="text"
                  value={editingTemplate.subject || ''}
                  onChange={(e) => setEditingTemplate(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Email subject"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <textarea
                  value={editingTemplate.html || ''}
                  onChange={(e) => setEditingTemplate(prev => ({ ...prev, html: e.target.value }))}
                  placeholder="HTML content"
                  rows={8}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveTemplate}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold"
                  >
                    Save Template
                  </button>
                  <button
                    onClick={() => setEditingTemplate(null)}
                    className="px-4 py-2 text-slate-500 hover:bg-slate-200 rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {templates.length === 0 ? (
                <p className="col-span-2 text-center text-slate-400 py-12">No templates saved yet</p>
              ) : (
                templates.map(template => (
                  <div
                    key={template.id}
                    className="p-5 bg-white border border-slate-100 rounded-2xl hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-slate-900">{template.name}</h3>
                        <p className="text-sm text-slate-500">{template.subject}</p>
                      </div>
                      <DocumentTextIcon className="w-5 h-5 text-slate-300" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleLoadTemplate(template)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-100"
                      >
                        <EyeIcon className="w-4 h-4" />
                        Use
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-sm font-bold transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="p-8">
            <h2 className="text-xl font-black text-slate-900 mb-6">Sent Emails</h2>
            
            {sentEmails.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ClockIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No emails sent yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sentEmails.map(email => (
                  <div
                    key={email.id}
                    className="p-5 bg-white border border-slate-100 rounded-2xl hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900">{email.subject}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                          <span>From: {email.from}</span>
                          {email.to.length > 0 && (
                            <span>To: {email.to.length} recipient{email.to.length > 1 ? 's' : ''}</span>
                          )}
                          <span>{new Date(email.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          email.last_event === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                          email.last_event === 'opened' ? 'bg-blue-100 text-blue-700' :
                          email.last_event === 'clicked' ? 'bg-purple-100 text-purple-700' :
                          email.last_event === 'bounced' ? 'bg-rose-100 text-rose-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {email.last_event || 'sent'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Domains Tab */}
        {activeTab === 'domains' && (
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900">Verified Domains</h2>
                <p className="text-slate-500 text-sm mt-1">Manage your sending domains in Resend dashboard</p>
              </div>
              <a
                href="https://resend.com/domains"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-indigo-600 transition-colors"
              >
                <GlobeAltIcon className="w-4 h-4" />
                Manage Domains
              </a>
            </div>

            <div className="space-y-4">
              {domains.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <GlobeAltIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No domains configured</p>
                  <p className="text-sm mt-2">Add a domain in the Resend dashboard to start sending</p>
                </div>
              ) : (
                domains.map(domain => (
                  <div
                    key={domain.id}
                    className="p-5 bg-white border border-slate-100 rounded-2xl"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <GlobeAltIcon className={`w-8 h-8 ${
                          domain.status === 'verified' ? 'text-emerald-500' : 'text-slate-300'
                        }`} />
                        <div>
                          <h3 className="font-bold text-slate-900">{domain.name}</h3>
                          <p className="text-sm text-slate-500">Region: {domain.region}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase ${
                        domain.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                        domain.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {domain.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResendPage;
