export {};

declare global {
  interface Window {
    desktopApp?: {
      platform: string;
      printReceipt?: (saleData: {
        /** Pour nom de fichier PDF (réimpression / export). */
        saleId?: number;
        companyName: string;
        companyPhone?: string | null;
        address: string;
        cashier: string;
        dateTime?: string;
        items: Array<{ name: string; qty: number; price: number }>;
        total: number;
        paymentMode: string;
        paperWidth?: 58 | 80;
        printerName?: string;
        receiptHeaderText?: string | null;
        receiptFooterText?: string | null;
        receiptClientName?: string | null;
        receiptLogoUrl?: string | null;
        showLogoOnReceipt?: boolean;
        autoCut?: boolean;
        isTest?: boolean;
        previewSampleBody?: string | null;
      }) => Promise<{ ok: boolean; mode: string; reason?: string; ticketText?: string }>;
      listPrinters?: () => Promise<Array<{ name: string }>>;
    };
  }
}
