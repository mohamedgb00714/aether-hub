/**
 * Invoicing System Types
 * Following SOLID principles with clear separation of concerns
 */

// Client Types
export interface Client {
  id: string;
  name: string;
  companyName?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  taxId?: string; // VAT/NIF/Tax ID
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientInput {
  name: string;
  companyName?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  taxId?: string;
  notes?: string;
}

// Invoice Types
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  client?: Client; // Populated when fetched with join
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  notes?: string;
  terms?: string;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  recurringProfileId?: string;
  items?: InvoiceItem[]; // Populated when fetched with items
  payments?: Payment[]; // Populated when fetched with payments
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceInput {
  clientId: string;
  issueDate: string;
  dueDate: string;
  currency?: string;
  notes?: string;
  terms?: string;
  items: CreateInvoiceItemInput[];
}

// Invoice Item Types
export type DiscountType = 'percentage' | 'fixed';

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  discountType: DiscountType;
  lineTotal: number;
  createdAt: string;
}

export interface CreateInvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discount?: number;
  discountType?: DiscountType;
}

// Payment Types
export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'crypto' | 'paypal' | 'other';

export interface Payment {
  id: string;
  invoiceId: string;
  paymentDate: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export interface CreatePaymentInput {
  invoiceId: string;
  paymentDate: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

// Tax Types
export interface Tax {
  id: string;
  name: string; // VAT, TVA, GST, etc.
  rate: number;
  region?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaxInput {
  name: string;
  rate: number;
  region?: string;
  isDefault?: boolean;
}

// Recurring Invoice Types
export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringInvoiceProfile {
  id: string;
  clientId: string;
  client?: Client;
  frequency: RecurringFrequency;
  nextIssueDate: string;
  autoSend: boolean;
  templateData: InvoiceTemplate;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceTemplate {
  currency: string;
  terms?: string;
  notes?: string;
  items: CreateInvoiceItemInput[];
}

export interface CreateRecurringInvoiceInput {
  clientId: string;
  frequency: RecurringFrequency;
  nextIssueDate: string;
  autoSend?: boolean;
  templateData: InvoiceTemplate;
}

// Invoice Settings Types
export interface InvoiceSettings {
  id: string;
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  companyCity?: string;
  companyCountry?: string;
  companyPostalCode?: string;
  companyTaxId?: string;
  companyLogoUrl?: string;
  invoicePrefix: string;
  invoiceNumberStart: number;
  defaultCurrency: string;
  defaultTaxId?: string;
  defaultPaymentTerms?: string;
  defaultNotes?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankSwift?: string;
  bankIban?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateInvoiceSettingsInput {
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  companyCity?: string;
  companyCountry?: string;
  companyPostalCode?: string;
  companyTaxId?: string;
  companyLogoUrl?: string;
  invoicePrefix?: string;
  invoiceNumberStart?: number;
  defaultCurrency?: string;
  defaultTaxId?: string;
  defaultPaymentTerms?: string;
  defaultNotes?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankSwift?: string;
  bankIban?: string;
}

// Dashboard & Analytics Types
export interface InvoiceDashboardStats {
  totalRevenue: number;
  unpaidAmount: number;
  overdueAmount: number;
  paidThisMonth: number;
  invoiceCount: {
    total: number;
    draft: number;
    sent: number;
    paid: number;
    overdue: number;
  };
  recentInvoices: Invoice[];
  topClients: Array<{
    client: Client;
    totalRevenue: number;
    invoiceCount: number;
  }>;
}

export interface RevenueReport {
  period: string; // ISO date or month
  revenue: number;
  invoiceCount: number;
  paidCount: number;
  unpaidCount: number;
}

export interface TaxReport {
  taxName: string;
  taxRate: number;
  totalTaxCollected: number;
  invoiceCount: number;
}

export interface ClientReport {
  client: Client;
  totalRevenue: number;
  totalPaid: number;
  totalOutstanding: number;
  invoiceCount: number;
  averageInvoiceValue: number;
}

// Filter & Search Types
export interface InvoiceFilters {
  status?: InvoiceStatus[];
  paymentStatus?: PaymentStatus[];
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  searchQuery?: string;
}

// Service Layer Interfaces (Following Interface Segregation Principle)
export interface IInvoiceService {
  createInvoice(input: CreateInvoiceInput): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice | null>;
  updateInvoice(id: string, updates: Partial<Invoice>): Promise<void>;
  deleteInvoice(id: string): Promise<void>;
  calculateInvoiceTotals(items: InvoiceItem[]): { subtotal: number; taxTotal: number; total: number };
  markAsSent(id: string): Promise<void>;
  markAsPaid(id: string, payment: CreatePaymentInput): Promise<void>;
}

export interface IClientService {
  createClient(input: CreateClientInput): Promise<Client>;
  getClient(id: string): Promise<Client | null>;
  updateClient(id: string, updates: Partial<Client>): Promise<void>;
  deleteClient(id: string): Promise<void>;
  searchClients(query: string): Promise<Client[]>;
}

export interface IPaymentService {
  recordPayment(payment: CreatePaymentInput): Promise<void>;
  getPaymentsByInvoice(invoiceId: string): Promise<Payment[]>;
  deletePayment(id: string): Promise<void>;
}

export interface IReportService {
  getDashboardStats(): Promise<InvoiceDashboardStats>;
  getRevenueReport(startDate: string, endDate: string): Promise<RevenueReport[]>;
  getTaxReport(startDate: string, endDate: string): Promise<TaxReport[]>;
  getClientReport(clientId: string): Promise<ClientReport>;
}

// AI Agent Types
export interface InvoiceAICommand {
  action: 'create' | 'update' | 'send' | 'mark_paid' | 'search' | 'report';
  params: Record<string, any>;
}

export interface InvoiceAIResponse {
  success: boolean;
  message: string;
  data?: any;
}
