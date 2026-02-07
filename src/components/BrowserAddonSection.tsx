import React, { useState, useEffect } from 'react';
import { 
  LinkIcon, 
  ArrowPathIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowDownTrayIcon,
  GlobeAltIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/solid';

interface ConnectedClient {
  id: string;
  browser: string;
  connectedAt: string;
}

const BrowserIcon = ({ browser, className = "w-6 h-6" }: { browser: string; className?: string }) => {
  switch (browser.toLowerCase()) {
    case 'chrome':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="10" fill="#4285F4"/>
          <circle cx="12" cy="12" r="4" fill="white"/>
          <path d="M12 8L17.2 17.4" stroke="#EA4335" strokeWidth="3" fill="none"/>
          <path d="M12 8L6.8 17.4" stroke="#34A853" strokeWidth="3" fill="none"/>
          <path d="M7 12H17" stroke="#FBBC05" strokeWidth="3" fill="none"/>
          <circle cx="12" cy="12" r="4" fill="white"/>
        </svg>
      );
    case 'edge':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <defs>
            <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#0078D4' }} />
              <stop offset="100%" style={{ stopColor: '#00BCF2' }} />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="10" fill="url(#edgeGrad)"/>
          <path d="M7 12c0-3 2.5-5 5-5s5 2 5 5c0 2-1 3-2 3.5" stroke="white" strokeWidth="2" fill="none"/>
        </svg>
      );
    case 'firefox':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <defs>
            <linearGradient id="firefoxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#FF9500' }} />
              <stop offset="100%" style={{ stopColor: '#FF0039' }} />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="10" fill="url(#firefoxGrad)"/>
          <path d="M17 10c0-3-2-5-5-5s-5 3-5 6c0 4 3 6 6 6" stroke="white" strokeWidth="2" fill="none"/>
        </svg>
      );
    default:
      return <GlobeAltIcon className={className} />;
  }
};

export const BrowserAddonSection: React.FC = () => {
  const [secret, setSecret] = useState<string | null>(null);
  const [connectedClients, setConnectedClients] = useState<ConnectedClient[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadAddonInfo();
    
    // Set up event listeners for connection changes
    const cleanupConnected = window.electronAPI.addon.onConnected(() => {
      loadConnectedClients();
    });
    
    const cleanupDisconnected = window.electronAPI.addon.onDisconnected(() => {
      loadConnectedClients();
    });
    
    return () => {
      cleanupConnected?.();
      cleanupDisconnected?.();
    };
  }, []);

  async function loadAddonInfo() {
    try {
      const [currentSecret, clients] = await Promise.all([
        window.electronAPI.addon.getSecret(),
        window.electronAPI.addon.getConnectedClients()
      ]);
      setSecret(currentSecret);
      setConnectedClients(clients);
    } catch (error) {
      console.error('Failed to load addon info:', error);
    }
    setLoading(false);
  }

  async function loadConnectedClients() {
    try {
      const clients = await window.electronAPI.addon.getConnectedClients();
      setConnectedClients(clients);
    } catch (error) {
      console.error('Failed to load connected clients:', error);
    }
  }

  async function generateNewSecret() {
    setGenerating(true);
    try {
      const newSecret = await window.electronAPI.addon.generateSecret();
      setSecret(newSecret);
    } catch (error) {
      console.error('Failed to generate secret:', error);
    }
    setGenerating(false);
  }

  async function copySecret() {
    if (secret) {
      await window.electronAPI.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const [downloading, setDownloading] = useState<string | null>(null);

  async function downloadExtension(browser: 'chrome' | 'firefox') {
    setDownloading(browser);
    try {
      const result = await window.electronAPI.addon.downloadExtension(browser);
      if (!result.success) {
        if (result.error !== 'Save cancelled') {
          alert(`Failed to download: ${result.error}`);
        }
      }
    } catch (error: any) {
      console.error('Download failed:', error);
      alert('Failed to create extension ZIP. Please try again.');
    }
    setDownloading(null);
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-100 rounded-[2.5rem] p-10">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200">
          <ComputerDesktopIcon className="w-8 h-8 text-white" />
        </div>
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Browser Extension</h3>
          <p className="text-slate-500 text-sm">Connect your browser to access aethermsaid hub features from any webpage</p>
        </div>
      </div>

      {/* Connection Status */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-slate-700">Connected Browsers</h4>
          <button 
            onClick={loadConnectedClients}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>
        
        {loading ? (
          <div className="text-center py-4 text-slate-400 text-sm">Loading...</div>
        ) : connectedClients.length > 0 ? (
          <div className="space-y-3">
            {connectedClients.map(client => (
              <div key={client.id} className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <BrowserIcon browser={client.browser} className="w-8 h-8" />
                <div className="flex-1">
                  <p className="font-semibold text-slate-800 capitalize">{client.browser}</p>
                  <p className="text-xs text-slate-500">Connected at {formatTime(client.connectedAt)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-emerald-600">Active</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <GlobeAltIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No browsers connected</p>
            <p className="text-slate-300 text-xs mt-1">Install the extension and paste the secret below</p>
          </div>
        )}
      </div>

      {/* Connection Secret */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mb-6">
        <h4 className="font-bold text-slate-700 mb-3">Connection Secret</h4>
        <p className="text-slate-500 text-xs mb-4">
          Copy this secret and paste it in the browser extension to connect.
        </p>
        
        <div className="flex gap-2">
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono text-sm text-slate-600 overflow-x-auto whitespace-nowrap">
            {loading ? 'Loading...' : (secret || 'Click generate to create a secret')}
          </div>
          
          <button
            onClick={copySecret}
            disabled={!secret || loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2"
            title="Copy to clipboard"
          >
            {copied ? (
              <CheckIcon className="w-5 h-5 text-white" />
            ) : (
              <ClipboardDocumentIcon className="w-5 h-5 text-white" />
            )}
          </button>
          
          <button
            onClick={generateNewSecret}
            disabled={loading || generating}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-colors"
            title="Generate new secret"
          >
            <ArrowPathIcon className={`w-5 h-5 text-slate-600 ${generating ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {connectedClients.length > 0 && (
          <p className="text-amber-600 text-xs mt-3 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Generating a new secret will disconnect all connected browsers
          </p>
        )}
      </div>

      {/* Download Extensions */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <h4 className="font-bold text-slate-700 mb-4">Install Extension</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Chrome */}
          <button
            onClick={() => downloadExtension('chrome')}
            disabled={downloading === 'chrome'}
            className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-2xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              {downloading === 'chrome' ? (
                <ArrowPathIcon className="w-6 h-6 text-indigo-600 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-8 h-8">
                  <circle cx="12" cy="12" r="10" fill="#4285F4"/>
                  <circle cx="12" cy="12" r="4" fill="white"/>
                  <path d="M21.8 12c0-5.4-4.4-9.8-9.8-9.8v4.2c3.1 0 5.6 2.5 5.6 5.6h4.2z" fill="#EA4335"/>
                  <path d="M12 21.8c5.4 0 9.8-4.4 9.8-9.8h-4.2c0 3.1-2.5 5.6-5.6 5.6v4.2z" fill="#34A853"/>
                  <path d="M2.2 12c0 5.4 4.4 9.8 9.8 9.8v-4.2c-3.1 0-5.6-2.5-5.6-5.6H2.2z" fill="#FBBC05"/>
                  <circle cx="12" cy="12" r="4" fill="white"/>
                </svg>
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-slate-800">Chrome</p>
              <p className="text-xs text-slate-500">{downloading === 'chrome' ? 'Creating ZIP...' : 'Manifest V3'}</p>
            </div>
            <ArrowDownTrayIcon className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </button>

          {/* Edge */}
          <button
            onClick={() => downloadExtension('chrome')}
            disabled={downloading === 'chrome'}
            className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-2xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              {downloading === 'chrome' ? (
                <ArrowPathIcon className="w-6 h-6 text-indigo-600 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-8 h-8">
                  <defs>
                    <linearGradient id="edgeGradBtn" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#0078D4' }} />
                      <stop offset="100%" style={{ stopColor: '#00BCF2' }} />
                    </linearGradient>
                  </defs>
                  <circle cx="12" cy="12" r="10" fill="url(#edgeGradBtn)"/>
                  <path d="M7 13c0-4 3-7 7-7 3 0 5 2 5 4 0 2-1.5 3-3 3H9c-1 0-2 .5-2 2s1.5 3 4 3c2 0 4-1 5-2.5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
                </svg>
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-slate-800">Edge</p>
              <p className="text-xs text-slate-500">{downloading === 'chrome' ? 'Creating ZIP...' : 'Manifest V3'}</p>
            </div>
            <ArrowDownTrayIcon className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </button>

          {/* Firefox */}
          <button
            onClick={() => downloadExtension('firefox')}
            disabled={downloading === 'firefox'}
            className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-2xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              {downloading === 'firefox' ? (
                <ArrowPathIcon className="w-6 h-6 text-indigo-600 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-8 h-8">
                  <defs>
                    <linearGradient id="ffGradBtn" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#FF9500' }} />
                      <stop offset="100%" style={{ stopColor: '#FF0039' }} />
                    </linearGradient>
                  </defs>
                  <circle cx="12" cy="12" r="10" fill="url(#ffGradBtn)"/>
                  <path d="M17 9c0-2.5-2-4.5-5-4.5S7 7 7 10c0 4 3 6.5 6 6.5 2 0 3.5-1 4-2" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  <circle cx="15" cy="9" r="1.5" fill="white"/>
                </svg>
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-slate-800">Firefox</p>
              <p className="text-xs text-slate-500">{downloading === 'firefox' ? 'Creating ZIP...' : 'Manifest V2 Sidebar'}</p>
            </div>
            <ArrowDownTrayIcon className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </button>
        </div>

        {/* Installation Instructions */}
        <div className="mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
          <h5 className="font-bold text-indigo-800 text-sm mb-2">Quick Installation</h5>
          <ol className="text-sm text-indigo-700 space-y-1.5 list-decimal list-inside">
            <li>Click a browser button above to download the extension ZIP</li>
            <li>Extract the ZIP and load it in developer mode</li>
            <li>Click the extension icon to open the side panel</li>
            <li>Paste the connection secret and click Connect</li>
          </ol>
        </div>

        {/* Features */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            { icon: '💬', text: 'Chat with AI from any page' },
            { icon: '📧', text: 'View unread emails' },
            { icon: '📅', text: 'Check today\'s events' },
            { icon: '📝', text: 'Save pages to knowledge base' },
            { icon: '✂️', text: 'Save text selections' },
            { icon: '🔔', text: 'Get notifications' }
          ].map((feature, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
              <span>{feature.icon}</span>
              <span>{feature.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BrowserAddonSection;
