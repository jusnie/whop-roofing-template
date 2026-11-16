import type { PlanKey } from "../config/company.config";

export type WhopRuntimeEnvironment = "production" | "sandbox";
export type ExecutionMode = "production" | "sandbox" | "preview";

export interface RuntimeConfigResponse {
  accountId: string;
  productId: string;
  environment: WhopRuntimeEnvironment;
  mode: ExecutionMode;
  isLiveConfigured: boolean;
  plans: Record<PlanKey, string>;
  finalBalancePlanId: string;
  webhookConfigured: boolean;
  invoiceAuthRequired: boolean;
}

export interface SavedCardSummary {
  paymentMethodId: string;
  memberId: string;
  setupIntentId?: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  customerEmail: string;
  customerName: string;
  savedAt: string;
  mode: ExecutionMode;
}

export interface CheckoutPayRequest {
  confirmationToken: string;
  planKey: PlanKey;
  planId?: string;
  orderId: string;
  returnUrl: string;
  saveCard?: boolean;
  customerName?: string;
  customerEmail?: string;
  propertyAddress?: string;
}

export interface CheckoutPayResponse {
  id: string;
  status: string;
  clientSecret: string | null;
  orderId: string;
  planKey: PlanKey;
  amount: number;
  currency: string;
  memberId: string | null;
  paymentMethodId: string | null;
  savedCard: SavedCardSummary | null;
  mode: ExecutionMode;
  error?: string;
}

export interface SetupIntentRequest {
  confirmationToken: string;
  orderId: string;
  returnUrl: string;
  customerName?: string;
  customerEmail?: string;
  propertyAddress?: string;
}

export interface SetupIntentResponse {
  id: string;
  status: string;
  clientSecret: string | null;
  memberId: string | null;
  paymentMethodId: string | null;
  savedCard: SavedCardSummary | null;
  mode: ExecutionMode;
  error?: string;
}

export interface EstimateLeadRequest {
  name: string;
  email: string;
  phone: string;
  address: string;
  zip: string;
  serviceType: string;
  roofMaterial: string;
  urgency: string;
  insuranceClaim: boolean;
  notes: string;
  eventId: string;
  referrer: string;
}

export interface EstimateLeadResponse {
  id: string;
  memberId: string | null;
  userId: string | null;
  productId: string | null;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  serviceType: string;
  estimatedValue: number;
  metadata: Record<string, string>;
  mode: ExecutionMode;
  error?: string;
}

export type InvoiceCollectionMethod = "charge_automatically" | "send_invoice";

export interface InvoiceLineItemPayload {
  id: string;
  label: string;
  description?: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateFinalInvoiceRequest {
  collectionMethod: InvoiceCollectionMethod;
  jobNumber: string;
  projectTitle: string;
  customerName: string;
  customerEmail: string;
  memberId?: string;
  paymentMethodId?: string;
  billingAddress: {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  lineItems: InvoiceLineItemPayload[];
  depositCredit: number;
  inspectionCredit: number;
  dueInDays: number;
  memo: string;
}

export interface FinalInvoiceRecord {
  id: string;
  invoiceNumber: string;
  status: string;
  collectionMethod: InvoiceCollectionMethod;
  jobNumber: string;
  projectTitle: string;
  customerName: string;
  customerEmail: string;
  memberId: string | null;
  paymentMethodId: string | null;
  variantId: string | null;
  grossSubtotal: number;
  depositCredit: number;
  inspectionCredit: number;
  finalBalance: number;
  currency: "USD";
  checkoutLink: string | null;
  dueAt: string | null;
  createdAt: string;
  memo: string;
  lineItems: InvoiceLineItemPayload[];
  mode: ExecutionMode;
  error?: string;
}

export interface TrackedPixelEvent {
  id: string;
  name: string;
  payload: Record<string, unknown>;
  timestamp: string;
  deliveredToWhopPixel: boolean;
}
