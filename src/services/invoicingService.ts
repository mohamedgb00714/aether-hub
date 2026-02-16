/**
 * Invoice Service Layer
 * Implements business logic for invoicing system
 * Following SOLID principles with separation of concerns
 */

import {
  Invoice,
  InvoiceItem,
  Client,
  Payment,
  Tax,
  RecurringInvoiceProfile,
  InvoiceSettings,
  CreateInvoiceInput,
  CreateClientInput,
  CreatePaymentInput,
  CreateTaxInput,
  CreateRecurringInvoiceInput,
  UpdateInvoiceSettingsInput,
  InvoiceDashboardStats,
  RevenueReport,
  TaxReport,
  ClientReport,
  InvoiceFilters,
  CreateInvoiceItemInput,
  DiscountType,
} from '../types/invoicing';

/**
 * Invoice Calculation Service
 * Single Responsibility: Handle all invoice calculations
 */
export class InvoiceCalculator {
  /**
   * Calculate line total for an invoice item
   */
  static calculateLineTotal(
    quantity: number,
    unitPrice: number,
    taxRate: number,
    discount: number,
    discountType: DiscountType
  ): number {
    const subtotal = quantity * unitPrice;
    const discountAmount = discountType === 'percentage' 
      ? (subtotal * discount) / 100 
      : discount;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * taxRate) / 100;
    return afterDiscount + taxAmount;
  }

  /**
   * Calculate invoice totals from items
   */
  static calculateInvoiceTotals(items: InvoiceItem[]): {
    subtotal: number;
    taxTotal: number;
    discountTotal: number;
    total: number;
  } {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    items.forEach(item => {
      const itemSubtotal = item.quantity * item.unitPrice;
      subtotal += itemSubtotal;

      const discountAmount = item.discountType === 'percentage'
        ? (itemSubtotal * item.discount) / 100
        : item.discount;
      discountTotal += discountAmount;

      const afterDiscount = itemSubtotal - discountAmount;
      const taxAmount = (afterDiscount * item.taxRate) / 100;
      taxTotal += taxAmount;
    });

    const total = subtotal - discountTotal + taxTotal;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      discountTotal: Math.round(discountTotal * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }

  /**
   * Determine payment status based on paid amount and total
   */
  static determinePaymentStatus(paidAmount: number, total: number): 'unpaid' | 'partial' | 'paid' {
    if (paidAmount === 0) return 'unpaid';
    if (paidAmount >= total) return 'paid';
    return 'partial';
  }

  /**
   * Check if invoice is overdue
   */
  static isOverdue(dueDate: string, paymentStatus: string): boolean {
    if (paymentStatus === 'paid') return false;
    return new Date(dueDate) < new Date();
  }

  /**
   * Calculate next recurring invoice date
   */
  static calculateNextIssueDate(currentDate: string, frequency: string): string {
    const date = new Date(currentDate);
    
    switch (frequency) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    
    return date.toISOString();
  }
}

/**
 * Invoice Service
 * Open/Closed Principle: Open for extension, closed for modification
 */
export class InvoiceService {
  /**
   * Create a new invoice with items
   */
  static async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const invoiceNumber = await window.electronAPI.invoicing.getNextInvoiceNumber();

    // Create invoice items with calculated totals
    const items: Omit<InvoiceItem, 'createdAt'>[] = input.items.map(item => {
      const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const lineTotal = InvoiceCalculator.calculateLineTotal(
        item.quantity,
        item.unitPrice,
        item.taxRate || 0,
        item.discount || 0,
        item.discountType || 'fixed'
      );

      return {
        id: itemId,
        invoiceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate || 0,
        discount: item.discount || 0,
        discountType: item.discountType || 'fixed',
        lineTotal,
      };
    });

    // Calculate invoice totals
    const totals = InvoiceCalculator.calculateInvoiceTotals(items as InvoiceItem[]);

    // Create invoice
    const invoice: Omit<Invoice, 'createdAt' | 'updatedAt'> = {
      id: invoiceId,
      invoiceNumber,
      clientId: input.clientId,
      status: 'draft',
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      currency: input.currency || 'USD',
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      discountTotal: totals.discountTotal,
      total: totals.total,
      notes: input.notes,
      terms: input.terms,
      paymentStatus: 'unpaid',
      paidAmount: 0,
    };

    // Save to database
    await window.electronAPI.invoicing.createInvoice(invoice);
    
    // Save items
    for (const item of items) {
      await window.electronAPI.invoicing.createInvoiceItem(item);
    }

    return invoice as Invoice;
  }

  /**
   * Get invoice with all related data
   */
  static async getInvoiceWithDetails(invoiceId: string): Promise<Invoice | null> {
    const invoice = await window.electronAPI.invoicing.getInvoice(invoiceId);
    if (!invoice) return null;

    const items = await window.electronAPI.invoicing.getInvoiceItems(invoiceId);
    const payments = await window.electronAPI.invoicing.getPaymentsByInvoice(invoiceId);
    const client = await window.electronAPI.invoicing.getClient(invoice.clientId);

    return {
      ...invoice,
      items,
      payments,
      client: client || undefined,
    };
  }

  /**
   * Update invoice status
   */
  static async updateStatus(invoiceId: string, status: string): Promise<void> {
    await window.electronAPI.invoicing.updateInvoiceStatus(invoiceId, status);
  }

  /**
   * Mark invoice as sent
   */
  static async markAsSent(invoiceId: string): Promise<void> {
    await this.updateStatus(invoiceId, 'sent');
  }

  /**
   * Mark invoice as paid with payment record
   */
  static async markAsPaid(invoiceId: string, payment: CreatePaymentInput): Promise<void> {
    const invoice = await window.electronAPI.invoicing.getInvoice(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    // Record payment
    await PaymentService.recordPayment(payment);

    // Update invoice status
    const totalPaid = await window.electronAPI.invoicing.getTotalPaymentsByInvoice(invoiceId);
    const paymentStatus = InvoiceCalculator.determinePaymentStatus(totalPaid, invoice.total);
    
    await window.electronAPI.invoicing.updateInvoicePayment(invoiceId, paymentStatus, totalPaid);
    
    if (paymentStatus === 'paid') {
      await this.updateStatus(invoiceId, 'paid');
    }
  }

  /**
   * Duplicate an existing invoice
   */
  static async duplicateInvoice(invoiceId: string): Promise<Invoice> {
    const original = await this.getInvoiceWithDetails(invoiceId);
    if (!original) throw new Error('Invoice not found');

    const newInvoice: CreateInvoiceInput = {
      clientId: original.clientId,
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      currency: original.currency,
      notes: original.notes,
      terms: original.terms,
      items: (original.items || []).map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        discount: item.discount,
        discountType: item.discountType,
      })),
    };

    return this.createInvoice(newInvoice);
  }

  /**
   * Get filtered invoices
   */
  static async getFilteredInvoices(filters: InvoiceFilters): Promise<Invoice[]> {
    let invoices = await window.electronAPI.invoicing.getAllInvoices();

    // Apply filters
    if (filters.status && filters.status.length > 0) {
      invoices = invoices.filter(inv => filters.status!.includes(inv.status as any));
    }

    if (filters.paymentStatus && filters.paymentStatus.length > 0) {
      invoices = invoices.filter(inv => filters.paymentStatus!.includes(inv.paymentStatus as any));
    }

    if (filters.clientId) {
      invoices = invoices.filter(inv => inv.clientId === filters.clientId);
    }

    if (filters.dateFrom) {
      invoices = invoices.filter(inv => inv.issueDate >= filters.dateFrom!);
    }

    if (filters.dateTo) {
      invoices = invoices.filter(inv => inv.issueDate <= filters.dateTo!);
    }

    if (filters.minAmount !== undefined) {
      invoices = invoices.filter(inv => inv.total >= filters.minAmount!);
    }

    if (filters.maxAmount !== undefined) {
      invoices = invoices.filter(inv => inv.total <= filters.maxAmount!);
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      invoices = invoices.filter(inv =>
        inv.invoiceNumber.toLowerCase().includes(query) ||
        inv.notes?.toLowerCase().includes(query)
      );
    }

    return invoices;
  }
}

/**
 * Client Service
 */
export class ClientService {
  static async createClient(input: CreateClientInput): Promise<Client> {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const client: Omit<Client, 'createdAt' | 'updatedAt'> = {
      id: clientId,
      name: input.name,
      companyName: input.companyName,
      email: input.email,
      phone: input.phone,
      address: input.address,
      city: input.city,
      country: input.country,
      postalCode: input.postalCode,
      taxId: input.taxId,
      notes: input.notes,
    };

    await window.electronAPI.invoicing.createClient(client);
    return client as Client;
  }

  static async searchClients(query: string): Promise<Client[]> {
    return window.electronAPI.invoicing.searchClients(query);
  }
}

/**
 * Payment Service
 */
export class PaymentService {
  static async recordPayment(payment: CreatePaymentInput): Promise<void> {
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const paymentData: Omit<Payment, 'createdAt'> = {
      id: paymentId,
      invoiceId: payment.invoiceId,
      paymentDate: payment.paymentDate,
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference,
      notes: payment.notes,
    };

    await window.electronAPI.invoicing.createPayment(paymentData);
  }

  static async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    return window.electronAPI.invoicing.getPaymentsByInvoice(invoiceId);
  }
}

/**
 * Recurring Invoice Service
 */
export class RecurringInvoiceService {
  static async processRecurringInvoices(): Promise<void> {
    const dueProfiles = await window.electronAPI.invoicing.getRecurringInvoicesDueToday();
    
    for (const profile of dueProfiles) {
      try {
        const template = JSON.parse(profile.templateData);
        
        // Create invoice from template
        const invoiceInput: CreateInvoiceInput = {
          clientId: profile.clientId,
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          currency: template.currency,
          terms: template.terms,
          notes: template.notes,
          items: template.items,
        };

        const invoice = await InvoiceService.createInvoice(invoiceInput);

        // Auto-send if enabled
        if (profile.autoSend) {
          await InvoiceService.markAsSent(invoice.id);
        }

        // Update next issue date
        const nextDate = InvoiceCalculator.calculateNextIssueDate(
          profile.nextIssueDate,
          profile.frequency
        );
        await window.electronAPI.invoicing.updateRecurringInvoiceNextDate(profile.id, nextDate);

      } catch (error) {
        console.error(`Failed to process recurring invoice profile ${profile.id}:`, error);
      }
    }
  }
}

/**
 * Report Service
 */
export class ReportService {
  static async getDashboardStats(): Promise<InvoiceDashboardStats> {
    const allInvoices = await window.electronAPI.invoicing.getAllInvoices();
    const allClients = await window.electronAPI.invoicing.getAllClients();

    // Calculate stats
    const totalRevenue = allInvoices
      .filter(inv => inv.paymentStatus === 'paid')
      .reduce((sum, inv) => sum + inv.total, 0);

    const unpaidAmount = allInvoices
      .filter(inv => inv.paymentStatus !== 'paid')
      .reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0);

    const overdueInvoices = allInvoices.filter(inv =>
      InvoiceCalculator.isOverdue(inv.dueDate, inv.paymentStatus)
    );
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0);

    // This month's revenue
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const paidThisMonth = allInvoices
      .filter(inv => {
        const issueDate = new Date(inv.issueDate);
        return inv.paymentStatus === 'paid' && issueDate >= thisMonth;
      })
      .reduce((sum, inv) => sum + inv.total, 0);

    // Invoice counts
    const invoiceCount = {
      total: allInvoices.length,
      draft: allInvoices.filter(inv => inv.status === 'draft').length,
      sent: allInvoices.filter(inv => inv.status === 'sent').length,
      paid: allInvoices.filter(inv => inv.status === 'paid').length,
      overdue: overdueInvoices.length,
    };

    // Recent invoices
    const recentInvoices = allInvoices
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    // Top clients
    const clientRevenue = new Map<string, { client: Client; totalRevenue: number; invoiceCount: number }>();
    
    for (const invoice of allInvoices.filter(inv => inv.paymentStatus === 'paid')) {
      const client = allClients.find(c => c.id === invoice.clientId);
      if (!client) continue;

      const existing = clientRevenue.get(client.id);
      if (existing) {
        existing.totalRevenue += invoice.total;
        existing.invoiceCount += 1;
      } else {
        clientRevenue.set(client.id, {
          client,
          totalRevenue: invoice.total,
          invoiceCount: 1,
        });
      }
    }

    const topClients = Array.from(clientRevenue.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    return {
      totalRevenue,
      unpaidAmount,
      overdueAmount,
      paidThisMonth,
      invoiceCount,
      recentInvoices,
      topClients,
    };
  }

  static async getRevenueReport(startDate: string, endDate: string): Promise<RevenueReport[]> {
    const invoices = await window.electronAPI.invoicing.getInvoicesByDateRange(startDate, endDate);
    
    // Group by month
    const reportMap = new Map<string, RevenueReport>();
    
    invoices.forEach(invoice => {
      const monthKey = invoice.issueDate.substring(0, 7); // YYYY-MM
      
      const existing = reportMap.get(monthKey);
      if (existing) {
        existing.revenue += invoice.paymentStatus === 'paid' ? invoice.total : 0;
        existing.invoiceCount += 1;
        if (invoice.paymentStatus === 'paid') existing.paidCount += 1;
        else existing.unpaidCount += 1;
      } else {
        reportMap.set(monthKey, {
          period: monthKey,
          revenue: invoice.paymentStatus === 'paid' ? invoice.total : 0,
          invoiceCount: 1,
          paidCount: invoice.paymentStatus === 'paid' ? 1 : 0,
          unpaidCount: invoice.paymentStatus === 'paid' ? 0 : 1,
        });
      }
    });

    return Array.from(reportMap.values()).sort((a, b) => a.period.localeCompare(b.period));
  }
}

export default {
  InvoiceCalculator,
  InvoiceService,
  ClientService,
  PaymentService,
  RecurringInvoiceService,
  ReportService,
};
