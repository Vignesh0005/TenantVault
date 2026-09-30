export type Role = 'admin' | 'staff' | 'viewer';

export interface User {
  id: string;
  email: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: User;
  tenants: Tenant[];
}

export interface MeResponse {
  user: User;
  tenants: Tenant[];
}

export interface RegisterPayload {
  email: string;
  password: string;
}

export interface SecurityContext {
  tenant: Tenant;
  role: Role;
  permissions: string[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  category: string | null;
  price: number;
  quantity: number;
  imageUrl: string | null;
  lowStockThreshold: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  sku: string;
  category?: string | null;
  price: number;
  quantity: number;
}

export interface ProductQuery {
  search: string;
  category: string;
  page: number;
  pageSize: number;
}

export type MovementType = 'in' | 'out' | 'adjustment';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: MovementType;
  quantity: number;
  note: string | null;
  actorEmail: string | null;
  createdAt: string;
  delta: number;
  reason: string;
  resultingQuantity: number;
}

export type AlertType = 'low_stock' | 'anomaly' | 'dead_stock';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  productId: string | null;
  productName: string | null;
  sku: string | null;
  createdAt: string;
}

export interface DashboardData {
  totalSkus: number;
  inventoryValue: number;
  lowStockCount: number;
  categoryCount: number;
  recentMovements: StockMovement[];
  alerts: Alert[];
}

export interface TrendPoint {
  date: string;
  inbound: number;
  outbound: number;
  value: number;
}

export interface DeadStockItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  value: number;
  daysSinceLastMovement: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  value: number;
  unitsSold: number;
  turnoverRatio: number;
}

export interface AnalyticsData {
  trends: TrendPoint[];
  deadStock: DeadStockItem[];
  categoryBreakdown: CategoryBreakdown[];
}

export type AuditStatus = 'success' | 'denied' | 'failure';

export interface AuditEntry {
  id: string;
  actorEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  status: AuditStatus;
  ip: string | null;
  reason: string | null;
  traceId: string | null;
  createdAt: string;
}

export interface AuditFilters {
  search: string;
  action: string;
  status: '' | AuditStatus;
  from: string;
  to: string;
  page: number;
  pageSize: number;
}

export interface LoginEvent {
  id: string;
  email: string;
  success: boolean;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface CrossTenantAttempt {
  id: string;
  actorEmail: string | null;
  method: string;
  path: string;
  targetTenant: string | null;
  status: number;
  reason: string;
  createdAt: string;
}

export interface SecurityDashboardData {
  stats: {
    loginsToday: number;
    failedLogins: number;
    crossTenantAttempts: number;
    blockedRequests: number;
  };
  recentLogins: LoginEvent[];
  crossTenantAttempts: CrossTenantAttempt[];
}

/** Attack names exactly as returned by POST /security/simulate-attack. */
export type AttackId =
  | 'missing_tenant_header'
  | 'header_spoof'
  | 'forged_jwt'
  | 'cross_tenant_read'
  | 'cross_tenant_write'
  | 'path_traversal'
  | 'cache_probe'
  | 'rls_bypass_raw_sql';

export interface AttackDefinition {
  id: AttackId;
  name: string;
  description: string;
  expected: string;
}

export interface SimulationResult {
  attack: AttackId;
  expected: string;
  actual: string;
  blocked: boolean;
  reason: string;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  tenantName: string | null;
  createdAt: string;
}

export interface AssistantResponse {
  id: string;
  reply: string;
  tenantName: string;
  createdAt: string;
}

export interface StockPrediction {
  productId: string;
  sku: string;
  name: string;
  currentQuantity: number;
  dailyUsage: number;
  daysUntilStockout: number | null;
  suggestedReorderQty: number;
}

export interface Anomaly {
  id: string;
  productId: string | null;
  sku: string | null;
  name: string | null;
  description: string;
  score: number;
  detectedAt: string;
}

export interface ReorderRecommendation {
  productId: string;
  sku: string;
  name: string;
  currentQuantity: number;
  recommendedQuantity: number;
  reason: string;
}

export interface ImageUrlResponse {
  url: string;
  expiresAt: string;
}

/** Every API error: `{ error, code }`, plus field `errors` for validation failures. */
export interface ApiErrorBody {
  error?: string;
  code?: string;
  errors?: Record<string, string[]>;
  traceId?: string;
}

export type ToastVariant = 'success' | 'error' | 'warning';

export interface ToastMessage {
  id: number;
  variant: ToastVariant;
  message: string;
}
