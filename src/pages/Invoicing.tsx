import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  EyeIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  FunnelIcon,
  BanknotesIcon,
} from '@heroicons/react/24/solid';
import type {
  Client,
  Invoice,
  InvoiceItem,
  Payment,
  Tax,
  RecurringInvoiceProfile,
  InvoiceSettings,
  InvoiceStatus,
  PaymentStatus,
  PaymentMethod,
  DiscountType,
  RecurringFrequency,
} from '../types/invoicing';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const api = () => window.electronAPI!.invoicing;

const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-cyan-100 text-cyan-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-200 text-slate-500',
  unpaid: 'bg-amber-100 text-amber-700',
  partial: 'bg-orange-100 text-orange-700',
};

const uuid = () => crypto.randomUUID();

// ─── Tab Types ────────────────────────────────────────────────────────────────
type TabType = 'dashboard' | 'invoices' | 'clients' | 'payments' | 'taxes' | 'recurring' | 'settings';

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => (
  <div className={`fixed top-6 right-6 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
    {type === 'success' ? <CheckCircleIcon className="w-5 h-5" /> : <ExclamationCircleIcon className="w-5 h-5" />}
    {message}
    <button onClick={onClose} className="ml-2 hover:opacity-70"><XMarkIcon className="w-4 h-4" /></button>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const InvoicingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [recurring, setRecurring] = useState<RecurringInvoiceProfile[]>([]);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);

  // Dashboard stats
  const [stats, setStats] = useState({ totalRevenue: 0, outstanding: 0, overdue: 0, clientCount: 0, invoiceCount: 0, paidCount: 0 });

  const hasInit = useRef(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [c, inv, p, t, r, s] = await Promise.all([
        api().getAllClients(),
        api().getAllInvoices(),
        api().getAllPayments(),
        api().getAllTaxes(),
        api().getAllRecurringInvoices(),
        api().getInvoiceSettings(),
      ]);
      setClients(c || []);
      setInvoices(inv || []);
      setPayments(p || []);
      setTaxes(t || []);
      setRecurring(r || []);
      setSettings(s || null);

      // Build stats
      const paid = (inv || []).filter((i: Invoice) => i.paymentStatus === 'paid');
      const totalRev = paid.reduce((s: number, i: Invoice) => s + i.total, 0);
      const outstanding = (inv || []).filter((i: Invoice) => i.paymentStatus !== 'paid' && i.status !== 'cancelled')
        .reduce((s: number, i: Invoice) => s + (i.total - i.paidAmount), 0);
      const overdue = (inv || []).filter((i: Invoice) => i.status === 'overdue').length;
      setStats({
        totalRevenue: totalRev,
        outstanding,
        overdue,
        clientCount: (c || []).length,
        invoiceCount: (inv || []).length,
        paidCount: paid.length,
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;
    loadAll();
  }, [loadAll]);

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: ChartBarIcon },
    { id: 'invoices', label: 'Invoices', icon: DocumentTextIcon },
    { id: 'clients', label: 'Clients', icon: UserGroupIcon },
    { id: 'payments', label: 'Payments', icon: BanknotesIcon },
    { id: 'taxes', label: 'Taxes', icon: CurrencyDollarIcon },
    { id: 'recurring', label: 'Recurring', icon: ClockIcon },
    { id: 'settings', label: 'Settings', icon: Cog6ToothIcon },
  ];

  return (
    <div className="h-full overflow-y-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="px-10 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Invoicing</h1>
            <p className="text-slate-500 mt-1">Manage clients, invoices, payments & taxes</p>
          </div>
          <button onClick={loadAll} className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-6 bg-slate-100 p-1 rounded-xl w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-10 pb-10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <ArrowPathIcon className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <DashboardTab stats={stats} invoices={invoices} clients={clients} />}
            {activeTab === 'invoices' && <InvoicesTab invoices={invoices} clients={clients} taxes={taxes} onRefresh={loadAll} showToast={showToast} />}
            {activeTab === 'clients' && <ClientsTab clients={clients} invoices={invoices} onRefresh={loadAll} showToast={showToast} />}
            {activeTab === 'payments' && <PaymentsTab payments={payments} invoices={invoices} clients={clients} onRefresh={loadAll} showToast={showToast} />}
            {activeTab === 'taxes' && <TaxesTab taxes={taxes} onRefresh={loadAll} showToast={showToast} />}
            {activeTab === 'recurring' && <RecurringTab recurring={recurring} clients={clients} onRefresh={loadAll} showToast={showToast} />}
            {activeTab === 'settings' && <SettingsTab settings={settings} onRefresh={loadAll} showToast={showToast} />}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
const DashboardTab: React.FC<{ stats: any; invoices: Invoice[]; clients: Client[] }> = ({ stats, invoices, clients }) => {
  const recentInvoices = [...invoices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Outstanding', value: formatCurrency(stats.outstanding), color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Overdue', value: stats.overdue, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Clients', value: stats.clientCount, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Invoices', value: stats.invoiceCount, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Paid', value: stats.paidCount, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-5`}>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Recent Invoices</h3>
        </div>
        {recentInvoices.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <DocumentTextIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No invoices yet. Create your first invoice!</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Invoice #</th>
                <th className="px-6 py-3 text-left">Client</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-center">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentInvoices.map(inv => {
                const client = clients.find(c => c.id === inv.clientId);
                return (
                  <tr key={inv.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-mono text-sm font-medium text-indigo-600">{inv.invoiceNumber}</td>
                    <td className="px-6 py-3 text-sm text-slate-700">{client?.name || inv.clientId}</td>
                    <td className="px-6 py-3 text-sm text-slate-500">{formatDate(inv.issueDate)}</td>
                    <td className="px-6 py-3 text-sm text-right font-medium">{formatCurrency(inv.total, inv.currency)}</td>
                    <td className="px-6 py-3 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[inv.status] || 'bg-slate-100'}`}>{inv.status}</span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[inv.paymentStatus] || 'bg-slate-100'}`}>{inv.paymentStatus}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ─── Invoices Tab ─────────────────────────────────────────────────────────────
const InvoicesTab: React.FC<{
  invoices: Invoice[];
  clients: Client[];
  taxes: Tax[];
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}> = ({ invoices, clients, taxes, onRefresh, showToast }) => {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState<string | null>(null);

  // New invoice form state
  const [form, setForm] = useState({
    clientId: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    currency: 'USD',
    notes: '',
    terms: '',
    items: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, discount: 0, discountType: 'percentage' as DiscountType }],
  });

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    amount: 0,
    method: 'bank_transfer' as PaymentMethod,
    reference: '',
    notes: '',
  });

  const resetForm = () => {
    setForm({
      clientId: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      currency: 'USD',
      notes: '',
      terms: '',
      items: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, discount: 0, discountType: 'percentage' as DiscountType }],
    });
    setShowForm(false);
  };

  const addItem = () => {
    setForm(f => ({
      ...f,
      items: [...f.items, { description: '', quantity: 1, unitPrice: 0, taxRate: 0, discount: 0, discountType: 'percentage' as DiscountType }],
    }));
  };

  const removeItem = (idx: number) => {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setForm(f => ({
      ...f,
      items: f.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    }));
  };

  const calculateLineTotal = (item: typeof form.items[0]) => {
    const base = item.quantity * item.unitPrice;
    const discountAmt = item.discountType === 'percentage' ? base * (item.discount / 100) : item.discount;
    const afterDiscount = base - discountAmt;
    const taxAmt = afterDiscount * (item.taxRate / 100);
    return afterDiscount + taxAmt;
  };

  const calculateTotals = () => {
    let subtotal = 0, taxTotal = 0, discountTotal = 0;
    form.items.forEach(item => {
      const base = item.quantity * item.unitPrice;
      const discountAmt = item.discountType === 'percentage' ? base * (item.discount / 100) : item.discount;
      subtotal += base;
      discountTotal += discountAmt;
      taxTotal += (base - discountAmt) * (item.taxRate / 100);
    });
    return { subtotal, taxTotal, discountTotal, total: subtotal - discountTotal + taxTotal };
  };

  const handleCreate = async () => {
    if (!form.clientId) return showToast('Select a client', 'error');
    if (form.items.some(i => !i.description || i.unitPrice <= 0)) return showToast('Fill all item fields', 'error');

    try {
      const invoiceNumber = await api().getNextInvoiceNumber();
      const totals = calculateTotals();
      const invoiceId = uuid();
      await api().createInvoice({
        id: invoiceId,
        invoiceNumber,
        clientId: form.clientId,
        status: 'draft',
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        currency: form.currency,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        discountTotal: totals.discountTotal,
        total: totals.total,
        notes: form.notes,
        terms: form.terms,
        paymentStatus: 'unpaid',
        paidAmount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      for (const item of form.items) {
        await api().createInvoiceItem({
          id: uuid(),
          invoiceId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discount: item.discount,
          discountType: item.discountType,
          lineTotal: calculateLineTotal(item),
          createdAt: new Date().toISOString(),
        });
      }

      showToast(`Invoice ${invoiceNumber} created`);
      resetForm();
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to create invoice', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invoice?')) return;
    try {
      await api().deleteInvoiceItemsByInvoice(id);
      await api().deleteInvoice(id);
      showToast('Invoice deleted');
      onRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleStatusChange = async (id: string, status: InvoiceStatus) => {
    try {
      await api().updateInvoiceStatus(id, status);
      showToast(`Status updated to ${status}`);
      onRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRecordPayment = async (invoiceId: string) => {
    if (paymentForm.amount <= 0) return showToast('Enter a valid amount', 'error');
    try {
      await api().createPayment({
        id: uuid(),
        invoiceId,
        paymentDate: paymentForm.paymentDate,
        amount: paymentForm.amount,
        method: paymentForm.method,
        reference: paymentForm.reference,
        notes: paymentForm.notes,
        createdAt: new Date().toISOString(),
      });
      // Recalculate payment status
      const totalPaid = await api().getTotalPaymentsByInvoice(invoiceId);
      const invoice = invoices.find(i => i.id === invoiceId);
      const newPaid = totalPaid + paymentForm.amount;
      const status = newPaid >= (invoice?.total || 0) ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
      await api().updateInvoicePayment(invoiceId, status, newPaid);
      if (status === 'paid') await api().updateInvoiceStatus(invoiceId, 'paid');
      showToast('Payment recorded');
      setShowPaymentForm(null);
      setPaymentForm({ paymentDate: new Date().toISOString().split('T')[0], amount: 0, method: 'bank_transfer', reference: '', notes: '' });
      onRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const filtered = invoices.filter(inv => {
    const matchSearch = inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      clients.find(c => c.id === inv.clientId)?.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      {/* View Invoice Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewInvoice(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Invoice {viewInvoice.invoiceNumber}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Client: {clients.find(c => c.id === viewInvoice.clientId)?.name || '—'}
                </p>
              </div>
              <button onClick={() => setViewInvoice(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
              <div><span className="text-slate-400">Issue Date:</span> {formatDate(viewInvoice.issueDate)}</div>
              <div><span className="text-slate-400">Due Date:</span> {formatDate(viewInvoice.dueDate)}</div>
              <div><span className="text-slate-400">Status:</span> <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[viewInvoice.status]}`}>{viewInvoice.status}</span></div>
              <div><span className="text-slate-400">Payment:</span> <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[viewInvoice.paymentStatus]}`}>{viewInvoice.paymentStatus}</span></div>
            </div>
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-400">Subtotal</span><span>{formatCurrency(viewInvoice.subtotal, viewInvoice.currency)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Tax</span><span>{formatCurrency(viewInvoice.taxTotal, viewInvoice.currency)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Discount</span><span>-{formatCurrency(viewInvoice.discountTotal, viewInvoice.currency)}</span></div>
              <div className="flex justify-between text-base font-bold border-t pt-2"><span>Total</span><span>{formatCurrency(viewInvoice.total, viewInvoice.currency)}</span></div>
              <div className="flex justify-between text-sm text-emerald-600"><span>Paid</span><span>{formatCurrency(viewInvoice.paidAmount, viewInvoice.currency)}</span></div>
              <div className="flex justify-between text-sm font-semibold text-amber-600"><span>Balance Due</span><span>{formatCurrency(viewInvoice.total - viewInvoice.paidAmount, viewInvoice.currency)}</span></div>
            </div>
            {viewInvoice.notes && <div className="mt-4 text-sm text-slate-500"><strong>Notes:</strong> {viewInvoice.notes}</div>}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPaymentForm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Record Payment</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Date</label>
                <input type="date" value={paymentForm.paymentDate} onChange={e => setPaymentForm(p => ({ ...p, paymentDate: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Amount</label>
                <input type="number" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Method</label>
                <select value={paymentForm.method} onChange={e => setPaymentForm(p => ({ ...p, method: e.target.value as PaymentMethod }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="paypal">PayPal</option>
                  <option value="crypto">Crypto</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Reference</label>
                <input type="text" value={paymentForm.reference} onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Transaction ID..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => handleRecordPayment(showPaymentForm)} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">Save Payment</button>
                <button onClick={() => setShowPaymentForm(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input type="text" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          <PlusIcon className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Create Invoice</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500">Client</label>
              <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Issue Date</label>
              <input type="date" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Currency</label>
              <input type="text" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500 uppercase">Line Items</label>
              <button onClick={addItem} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"><PlusIcon className="w-3 h-3" />Add Item</button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 rounded-lg p-3">
                  <div className="col-span-4">
                    <label className="text-[10px] text-slate-400">Description</label>
                    <input type="text" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Service or product..." />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] text-slate-400">Qty</label>
                    <input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} className="w-full px-2 py-1.5 border rounded text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-400">Unit Price</label>
                    <input type="number" step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded text-sm" />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] text-slate-400">Tax %</label>
                    <input type="number" step="0.01" value={item.taxRate} onChange={e => updateItem(idx, 'taxRate', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded text-sm" />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] text-slate-400">Disc.</label>
                    <input type="number" step="0.01" value={item.discount} onChange={e => updateItem(idx, 'discount', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded text-sm" />
                  </div>
                  <div className="col-span-2 text-right">
                    <label className="text-[10px] text-slate-400">Line Total</label>
                    <p className="text-sm font-medium py-1.5">{formatCurrency(calculateLineTotal(item), form.currency)}</p>
                  </div>
                  <div className="col-span-1 text-right">
                    {form.items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><TrashIcon className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span>{formatCurrency(totals.subtotal, form.currency)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Tax</span><span>{formatCurrency(totals.taxTotal, form.currency)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Discount</span><span>-{formatCurrency(totals.discountTotal, form.currency)}</span></div>
              <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span>{formatCurrency(totals.total, form.currency)}</span></div>
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500">Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Notes for the client..." />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Payment Terms</label>
              <textarea rows={2} value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Net 30, etc..." />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Create Invoice</button>
            <button onClick={resetForm} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* Invoice List */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <DocumentTextIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No invoices found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Invoice #</th>
                <th className="px-6 py-3 text-left">Client</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Due</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-center">Payment</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(inv => {
                const client = clients.find(c => c.id === inv.clientId);
                return (
                  <tr key={inv.id} className="hover:bg-slate-50/50 group">
                    <td className="px-6 py-3 font-mono text-sm font-medium text-indigo-600">{inv.invoiceNumber}</td>
                    <td className="px-6 py-3 text-sm text-slate-700">{client?.name || '—'}</td>
                    <td className="px-6 py-3 text-sm text-slate-500">{formatDate(inv.issueDate)}</td>
                    <td className="px-6 py-3 text-sm text-slate-500">{formatDate(inv.dueDate)}</td>
                    <td className="px-6 py-3 text-sm text-right font-medium">{formatCurrency(inv.total, inv.currency)}</td>
                    <td className="px-6 py-3 text-center">
                      <select value={inv.status} onChange={e => handleStatusChange(inv.id, e.target.value as InvoiceStatus)} className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${statusColors[inv.status]}`}>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="viewed">Viewed</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[inv.paymentStatus]}`}>{inv.paymentStatus}</span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setViewInvoice(inv)} className="p-1.5 hover:bg-slate-100 rounded" title="View"><EyeIcon className="w-4 h-4 text-slate-400" /></button>
                        <button onClick={() => { setShowPaymentForm(inv.id); setPaymentForm(p => ({ ...p, amount: inv.total - inv.paidAmount })); }} className="p-1.5 hover:bg-emerald-50 rounded" title="Record Payment"><BanknotesIcon className="w-4 h-4 text-emerald-500" /></button>
                        <button onClick={() => handleDelete(inv.id)} className="p-1.5 hover:bg-red-50 rounded" title="Delete"><TrashIcon className="w-4 h-4 text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ─── Clients Tab ──────────────────────────────────────────────────────────────
const ClientsTab: React.FC<{
  clients: Client[];
  invoices: Invoice[];
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}> = ({ clients, invoices, onRefresh, showToast }) => {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', companyName: '', email: '', phone: '', address: '', city: '', country: '', postalCode: '', taxId: '', notes: '',
  });

  const resetForm = () => {
    setForm({ name: '', companyName: '', email: '', phone: '', address: '', city: '', country: '', postalCode: '', taxId: '', notes: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) return showToast('Name and email are required', 'error');
    try {
      const now = new Date().toISOString();
      if (editingId) {
        await api().updateClient(editingId, { ...form, updatedAt: now });
        showToast('Client updated');
      } else {
        await api().createClient({ id: uuid(), ...form, createdAt: now, updatedAt: now });
        showToast('Client created');
      }
      resetForm();
      onRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleEdit = (client: Client) => {
    setForm({
      name: client.name, companyName: client.companyName || '', email: client.email,
      phone: client.phone || '', address: client.address || '', city: client.city || '',
      country: client.country || '', postalCode: client.postalCode || '', taxId: client.taxId || '',
      notes: client.notes || '',
    });
    setEditingId(client.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const hasInvoices = invoices.some(i => i.clientId === id);
    if (hasInvoices) return showToast('Cannot delete client with invoices', 'error');
    if (!confirm('Delete this client?')) return;
    try {
      await api().deleteClient(id);
      showToast('Client deleted');
      onRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.companyName || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input type="text" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" />
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          <PlusIcon className="w-4 h-4" />
          New Client
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">{editingId ? 'Edit Client' : 'New Client'}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { key: 'name', label: 'Name *', placeholder: 'John Doe' },
              { key: 'companyName', label: 'Company', placeholder: 'Acme Inc.' },
              { key: 'email', label: 'Email *', placeholder: 'john@acme.com', type: 'email' },
              { key: 'phone', label: 'Phone', placeholder: '+1 555 0123' },
              { key: 'address', label: 'Address', placeholder: '123 Main St' },
              { key: 'city', label: 'City', placeholder: 'New York' },
              { key: 'country', label: 'Country', placeholder: 'US' },
              { key: 'postalCode', label: 'Postal Code', placeholder: '10001' },
              { key: 'taxId', label: 'Tax ID / VAT', placeholder: 'US123456789' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-slate-500">{f.label}</label>
                <input type={f.type || 'text'} value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder={f.placeholder} />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">{editingId ? 'Update' : 'Create'}</button>
            <button onClick={resetForm} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* Client Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400">
          <UserGroupIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No clients yet. Add your first client!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(client => {
            const clientInvoices = invoices.filter(i => i.clientId === client.id);
            const totalRevenue = clientInvoices.filter(i => i.paymentStatus === 'paid').reduce((s, i) => s + i.total, 0);
            return (
              <div key={client.id} className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-sm">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{client.name}</h4>
                      {client.companyName && <p className="text-xs text-slate-400">{client.companyName}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(client)} className="p-1.5 hover:bg-slate-100 rounded"><PencilIcon className="w-3.5 h-3.5 text-slate-400" /></button>
                    <button onClick={() => handleDelete(client.id)} className="p-1.5 hover:bg-red-50 rounded"><TrashIcon className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-500 space-y-0.5">
                  <p>{client.email}</p>
                  {client.phone && <p>{client.phone}</p>}
                  {client.city && client.country && <p>{client.city}, {client.country}</p>}
                </div>
                <div className="mt-3 flex items-center gap-3 pt-3 border-t border-slate-50 text-xs">
                  <span className="text-slate-400">{clientInvoices.length} invoices</span>
                  <span className="text-emerald-600 font-medium">{formatCurrency(totalRevenue)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Payments Tab ─────────────────────────────────────────────────────────────
const PaymentsTab: React.FC<{
  payments: Payment[];
  invoices: Invoice[];
  clients: Client[];
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}> = ({ payments, invoices, clients, onRefresh, showToast }) => {
  const sorted = [...payments].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this payment record?')) return;
    try {
      await api().deletePayment(id);
      showToast('Payment deleted');
      onRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const totalReceived = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="bg-emerald-50 rounded-2xl p-5 flex-1">
          <p className="text-xs font-medium text-emerald-600 uppercase">Total Received</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-5 flex-1">
          <p className="text-xs font-medium text-blue-600 uppercase">Total Payments</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{payments.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <BanknotesIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No payments recorded yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Invoice</th>
                <th className="px-6 py-3 text-left">Client</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-left">Method</th>
                <th className="px-6 py-3 text-left">Reference</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map(payment => {
                const invoice = invoices.find(i => i.id === payment.invoiceId);
                const client = invoice ? clients.find(c => c.id === invoice.clientId) : null;
                return (
                  <tr key={payment.id} className="hover:bg-slate-50/50 group">
                    <td className="px-6 py-3 text-sm text-slate-700">{formatDate(payment.paymentDate)}</td>
                    <td className="px-6 py-3 font-mono text-sm text-indigo-600">{invoice?.invoiceNumber || '—'}</td>
                    <td className="px-6 py-3 text-sm text-slate-500">{client?.name || '—'}</td>
                    <td className="px-6 py-3 text-sm text-right font-medium text-emerald-600">{formatCurrency(payment.amount)}</td>
                    <td className="px-6 py-3 text-sm text-slate-500 capitalize">{payment.method.replace('_', ' ')}</td>
                    <td className="px-6 py-3 text-sm text-slate-400 font-mono">{payment.reference || '—'}</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => handleDelete(payment.id)} className="p-1.5 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        <TrashIcon className="w-4 h-4 text-red-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ─── Taxes Tab ────────────────────────────────────────────────────────────────
const TaxesTab: React.FC<{
  taxes: Tax[];
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}> = ({ taxes, onRefresh, showToast }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', rate: 0, region: '', isDefault: false });
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setForm({ name: '', rate: 0, region: '', isDefault: false });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name || form.rate < 0) return showToast('Name and valid rate required', 'error');
    try {
      const now = new Date().toISOString();
      if (editingId) {
        await api().updateTax(editingId, { ...form, updatedAt: now });
        showToast('Tax updated');
      } else {
        await api().createTax({ id: uuid(), ...form, createdAt: now, updatedAt: now });
        showToast('Tax created');
      }
      resetForm();
      onRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this tax?')) return;
    try {
      await api().deleteTax(id);
      showToast('Tax deleted');
      onRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Define tax rates for your invoices</p>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          <PlusIcon className="w-4 h-4" />
          New Tax
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">{editingId ? 'Edit Tax' : 'New Tax'}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500">Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="VAT, GST..." />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Rate (%)</label>
              <input type="number" step="0.01" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: parseFloat(e.target.value) || 0 }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Region</label>
              <input type="text" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="US, EU, UK..." />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} className="rounded border-slate-300" />
                <span className="text-sm text-slate-600">Default</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">{editingId ? 'Update' : 'Create'}</button>
            <button onClick={resetForm} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {taxes.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400">
            <CurrencyDollarIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No tax rates defined</p>
          </div>
        ) : taxes.map(tax => (
          <div key={tax.id} className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-slate-900">{tax.name}</h4>
                  {tax.isDefault && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full font-medium">Default</span>}
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-1">{tax.rate}%</p>
                {tax.region && <p className="text-xs text-slate-400 mt-1">{tax.region}</p>}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingId(tax.id); setForm({ name: tax.name, rate: tax.rate, region: tax.region || '', isDefault: tax.isDefault }); setShowForm(true); }} className="p-1.5 hover:bg-slate-100 rounded">
                  <PencilIcon className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <button onClick={() => handleDelete(tax.id)} className="p-1.5 hover:bg-red-50 rounded">
                  <TrashIcon className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Recurring Tab ────────────────────────────────────────────────────────────
const RecurringTab: React.FC<{
  recurring: RecurringInvoiceProfile[];
  clients: Client[];
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}> = ({ recurring, clients, onRefresh, showToast }) => {
  const handleToggle = async (profile: RecurringInvoiceProfile) => {
    try {
      await api().updateRecurringInvoice(profile.id, { isActive: !profile.isActive, updatedAt: new Date().toISOString() });
      showToast(profile.isActive ? 'Paused' : 'Activated');
      onRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recurring profile?')) return;
    try {
      await api().deleteRecurringInvoice(id);
      showToast('Deleted');
      onRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Auto-generate invoices on a schedule</p>
      </div>

      {recurring.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400">
          <ClockIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No recurring invoices set up</p>
          <p className="text-xs mt-1">Create recurring profiles from the Invoices tab</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recurring.map(profile => {
            const client = clients.find(c => c.id === profile.clientId);
            return (
              <div key={profile.id} className="bg-white rounded-2xl border border-slate-100 p-5 group">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900">{client?.name || 'Unknown Client'}</h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${profile.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {profile.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 capitalize">{profile.frequency} &middot; Next: {formatDate(profile.nextIssueDate)}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleToggle(profile)} className={`p-1.5 rounded text-xs font-medium ${profile.isActive ? 'hover:bg-amber-50 text-amber-600' : 'hover:bg-emerald-50 text-emerald-600'}`}>
                      {profile.isActive ? 'Pause' : 'Activate'}
                    </button>
                    <button onClick={() => handleDelete(profile.id)} className="p-1.5 hover:bg-red-50 rounded">
                      <TrashIcon className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Settings Tab ─────────────────────────────────────────────────────────────
const SettingsTab: React.FC<{
  settings: InvoiceSettings | null;
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}> = ({ settings, onRefresh, showToast }) => {
  const [form, setForm] = useState({
    companyName: '', companyEmail: '', companyPhone: '', companyAddress: '', companyCity: '',
    companyCountry: '', companyPostalCode: '', companyTaxId: '', invoicePrefix: 'INV-',
    invoiceNumberStart: 1, defaultCurrency: 'USD', defaultPaymentTerms: 'Net 30',
    defaultNotes: '', bankName: '', bankAccountNumber: '', bankSwift: '', bankIban: '',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        companyName: settings.companyName || '', companyEmail: settings.companyEmail || '',
        companyPhone: settings.companyPhone || '', companyAddress: settings.companyAddress || '',
        companyCity: settings.companyCity || '', companyCountry: settings.companyCountry || '',
        companyPostalCode: settings.companyPostalCode || '', companyTaxId: settings.companyTaxId || '',
        invoicePrefix: settings.invoicePrefix || 'INV-', invoiceNumberStart: settings.invoiceNumberStart || 1,
        defaultCurrency: settings.defaultCurrency || 'USD', defaultPaymentTerms: settings.defaultPaymentTerms || 'Net 30',
        defaultNotes: settings.defaultNotes || '', bankName: settings.bankName || '',
        bankAccountNumber: settings.bankAccountNumber || '', bankSwift: settings.bankSwift || '',
        bankIban: settings.bankIban || '',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      const now = new Date().toISOString();
      await api().updateInvoiceSettings({
        id: settings?.id || uuid(),
        ...form,
        createdAt: settings?.createdAt || now,
        updatedAt: now,
      });
      showToast('Settings saved');
      onRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const fields = [
    { section: 'Company Information', items: [
      { key: 'companyName', label: 'Company Name', placeholder: 'Your Company' },
      { key: 'companyEmail', label: 'Email', placeholder: 'billing@company.com', type: 'email' },
      { key: 'companyPhone', label: 'Phone', placeholder: '+1 555 0123' },
      { key: 'companyAddress', label: 'Address', placeholder: '123 Business Ave' },
      { key: 'companyCity', label: 'City', placeholder: 'New York' },
      { key: 'companyCountry', label: 'Country', placeholder: 'US' },
      { key: 'companyPostalCode', label: 'Postal Code', placeholder: '10001' },
      { key: 'companyTaxId', label: 'Tax ID / VAT', placeholder: 'US123456789' },
    ]},
    { section: 'Invoice Defaults', items: [
      { key: 'invoicePrefix', label: 'Invoice Prefix', placeholder: 'INV-' },
      { key: 'invoiceNumberStart', label: 'Start Number', type: 'number' },
      { key: 'defaultCurrency', label: 'Currency', placeholder: 'USD' },
      { key: 'defaultPaymentTerms', label: 'Payment Terms', placeholder: 'Net 30' },
    ]},
    { section: 'Bank Details', items: [
      { key: 'bankName', label: 'Bank Name', placeholder: 'Bank of America' },
      { key: 'bankAccountNumber', label: 'Account Number', placeholder: '****1234' },
      { key: 'bankSwift', label: 'SWIFT / BIC', placeholder: 'BOFAUS3N' },
      { key: 'bankIban', label: 'IBAN', placeholder: 'US12 3456 7890 1234 5678 90' },
    ]},
  ];

  return (
    <div className="space-y-8 max-w-3xl">
      {fields.map(section => (
        <div key={section.section}>
          <h3 className="font-semibold text-slate-900 mb-4">{section.section}</h3>
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="grid grid-cols-2 gap-4">
              {section.items.map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-slate-500">{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: f.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div>
        <label className="text-xs font-medium text-slate-500">Default Notes</label>
        <textarea rows={3} value={form.defaultNotes} onChange={e => setForm(f => ({ ...f, defaultNotes: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Thank you for your business!" />
      </div>

      <button onClick={handleSave} className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
        Save Settings
      </button>
    </div>
  );
};

export default InvoicingPage;
