
export type UserRole = 'admin' | 'dispatcher' | 'worker' | 'customer';

export type ViewState = 'dashboard' | 'employees' | 'active_workers' | 'finance' | 'chat' | 'help' | 'ai_audit' | 'customers' | 'admin_dashboard';

export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  text: string;
  timestamp: string;
  is_read: boolean;
  status: MessageStatus;
  metadata?: {
    order_id?: string;
    type?: 'broadcast_invite';
  };
}

export interface ClientProfile {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  total_debt: number;
}

export interface Dispatcher {
  id: string;
  name: string;
  phone: string;
  status: 'active' | 'break' | 'offline';
  geo_allowed: boolean;
  total_margin_generated: number;
}

export interface EmployeeReview {
  id: string;
  author_name: string;
  rating: number;
  comment: string;
  timestamp: string;
}

export interface Employee {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  messengers: string[];
  is_self_employed: boolean;
  total_hours: number;
  rating: number;
  status: 'new' | 'experienced';
  balance_paid: number;
  balance_owed: number;
  balance_today: number;
  balance_month: number;
  avatar_color?: string;
  last_message_time?: string;
  unread_count?: number;
  is_online?: boolean;
  last_viewed_order_id?: string;
  lat?: number;
  lng?: number;
  last_location_update?: string;
  is_at_site?: boolean;
  reviews?: EmployeeReview[];
  emergency_status?: {
    active: boolean;
    timestamp: string;
    lat?: number;
    lng?: number;
  };
}

export interface Order {
  id: string;
  client_name: string;
  address: string;
  datetime: string;
  required_workers: number;
  confirmed_workers_count: number;
  description?: string;
  status: 'active' | 'completed' | 'cancelled';
  assigned_employee_ids: string[];
  order_services: OrderServiceItem[];
  assignments_detail: Record<string, OrderAssignment>;
  paid_amount: number;
  total_client_cost: number;
  lat?: number; 
  lng?: number;
  radius?: number;
  payment_status?: 'paid' | 'unpaid';
  claimed_by?: string;
  geo_required: boolean;
  payment_type?: 'cash' | 'non-cash';
  created_at?: string;
}

export interface OrderAssignment {
  start_time: string;
  end_time: string;
  hours: number;
  payout: number;
  actual_start?: string;
  actual_end?: string;
  calculated_duration?: string;
  arrival_time?: string;
  is_confirmed?: boolean;
}

export interface LogEntry {
  id: string;
  order_id?: string;
  entity_id: string;
  entity_name: string;
  action: string;
  timestamp: string;
  app_context: 'dispatcher' | 'worker' | 'customer' | 'admin';
}

export interface OrderServiceItem {
  id: string;
  name: string;
  quantity: number;
  price_worker: number;
  price_client: number;
}
