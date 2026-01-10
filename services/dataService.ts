
import { Employee, Order, ChatMessage, LogEntry, Dispatcher, OrderAssignment, EmployeeReview } from '../types';
import { USE_MOCK_DATA, HOURLY_RATE_WORKER, HOURLY_RATE_CLIENT } from '../constants';
import { supabase } from './supabaseClient';
import { notificationService } from './notificationService';

const STORAGE_KEYS = {
    EMPLOYEES: 'dp_employees',
    ORDERS: 'dp_orders',
    CHATS: 'dp_chats',
    LOGS: 'dp_logs',
    DISPATCHERS: 'dp_dispatchers',
    CUSTOMERS: 'dp_customers',
    OFFLINE_LOCATIONS: 'dp_offline_locations'
};

const INITIAL_DISPATCHERS: Dispatcher[] = [
    { id: 'd1', name: 'Алексей (Старший)', phone: '+79001112233', status: 'active', geo_allowed: true, total_margin_generated: 150000 },
    { id: 'd3', name: 'Алексей2 (Старший)', phone: '+79001112236', status: 'active', geo_allowed: true, total_margin_generated: 150000 },
    { id: 'd4', name: 'Алексей4 (Старший)', phone: '+79001112234', status: 'active', geo_allowed: true, total_margin_generated: 15000 },
    { id: 'd2', name: 'Мария', phone: '+79004445566', status: 'active', geo_allowed: true, total_margin_generated: 85000 }
];

const load = <T>(key: string, fallback: T): T => {
    try {
        const data = localStorage.getItem(key);
        if (!data && USE_MOCK_DATA) {
            if (key === STORAGE_KEYS.DISPATCHERS) return INITIAL_DISPATCHERS as any;
        }
        return data ? JSON.parse(data) : fallback;
    } catch (e) {
        console.error(`[DataService] Load error for ${key}:`, e);
        return fallback;
    }
};

const save = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('[DataService] Storage quota exceeded or save error', e);
    }
};

const safeRequest = async <T>(promise: Promise<{data: T | null, error: any}>, context: string): Promise<T | null> => {
    try {
        const { data, error } = await promise;
        if (error) {
            console.log(`[DataService] Supabase fallback (${context}): ${error.message}`);
            return null;
        }
        return data;
    } catch (e) {
        return null;
    }
};

export const dataService = {
    // --- EMERGENCY LOGIC ---
    async triggerEmergency(workerId: string, lat?: number, lng?: number) {
        await this.updateEmployee(workerId, {
            emergency_status: {
                active: true,
                timestamp: new Date().toISOString(),
                lat,
                lng
            }
        });
        await this.addLog(workerId, 'СИСТЕМА', '🚨 ТРЕВОГА! Нажата тревожная кнопка!', 'worker');
    },

    async resolveEmergency(workerId: string) {
        await this.updateEmployee(workerId, {
            emergency_status: {
                active: false,
                timestamp: ''
            }
        });
        await this.addLog(workerId, 'Диспетчер', '✅ Тревога снята', 'dispatcher');
    },

    // --- OFFLINE GPS LOGIC ---
    async bufferLocation(workerId: string, lat: number, lng: number) {
        const locations = load<any[]>(STORAGE_KEYS.OFFLINE_LOCATIONS, []);
        locations.push({ workerId, lat, lng, timestamp: new Date().toISOString() });
        save(STORAGE_KEYS.OFFLINE_LOCATIONS, locations);
    },

    async syncOfflineLocations() {
        const locations = load<any[]>(STORAGE_KEYS.OFFLINE_LOCATIONS, []);
        if (locations.length === 0) return;
        const lastLoc = locations[locations.length - 1];
        await this.updateLocation(lastLoc.workerId, lastLoc.lat, lastLoc.lng);
        save(STORAGE_KEYS.OFFLINE_LOCATIONS, []);
    },

    async getEmployees(): Promise<Employee[]> {
        let local = load<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
        if (USE_MOCK_DATA) return local;
        const data = await safeRequest<Employee[]>(supabase.from('employees').select('*'), 'getEmployees');
        return data || local;
    },

    async getOrders(): Promise<Order[]> {
        let local = load<Order[]>(STORAGE_KEYS.ORDERS, []);
        if (USE_MOCK_DATA) return local;
        const data = await safeRequest<Order[]>(supabase.from('orders').select('*'), 'getOrders');
        if (!data) return local;
        return data.map(o => ({
            ...o,
            datetime: o.datetime || o.created_at || new Date().toISOString(),
            paid_amount: o.paid_amount || 0,
            total_client_cost: o.total_client_cost || 0,
            assigned_employee_ids: o.assigned_employee_ids || [],
            assignments_detail: o.assignments_detail || {}
        })).sort((a, b) => b.datetime.localeCompare(a.datetime));
    },

    async getCustomersList(): Promise<any[]> {
        let local = load<any[]>(STORAGE_KEYS.CUSTOMERS, []);
        if (USE_MOCK_DATA) return local;
        const data = await safeRequest<any[]>(supabase.from('customers').select('*'), 'getCustomersList');
        return data || local;
    },

    async createCustomer(name: string, phone: string, id?: string) {
        const newCustomer = { 
            id: id || Math.random().toString(36).substr(2, 9), 
            name, 
            phone, 
            created_at: new Date().toISOString() 
        };
        const list = load<any[]>(STORAGE_KEYS.CUSTOMERS, []);
        if (!list.find(c => c.name === name)) {
            list.push(newCustomer);
            save(STORAGE_KEYS.CUSTOMERS, list);
        }
        return newCustomer;
    },

    async updateCustomer(id: string, data: Partial<any>) {
        let list = load<any[]>(STORAGE_KEYS.CUSTOMERS, []);
        const idx = list.findIndex(c => c.id === id);
        if (idx !== -1) {
            list[idx] = { ...list[idx], ...data };
            save(STORAGE_KEYS.CUSTOMERS, list);
        }
    },

    async getDispatchers(): Promise<Dispatcher[]> {
        return load<Dispatcher[]>(STORAGE_KEYS.DISPATCHERS, INITIAL_DISPATCHERS);
    },

    async getSystemStats() {
        const emps = await this.getEmployees();
        const disps = await this.getDispatchers();
        const ords = await this.getOrders();
        const totalClientDebt = ords.reduce((acc, o) => {
            if (o.status !== 'completed' || o.payment_status === 'paid') return acc;
            return acc + ((o.total_client_cost || 0) - (o.paid_amount || 0));
        }, 0);
        return { 
            workersAtSiteCount: emps.filter(e => e.is_at_site).length, 
            onlineFreeWorkers: emps.filter(e => e.is_online && !e.is_at_site).length, 
            onlineDispatchers: disps.filter(d => d.status === 'active').length, 
            totalClientDebt 
        };
    },

    async addLog(entityId: string, entityName: string, action: string, context: LogEntry['app_context'], orderId?: string) {
        const log: LogEntry = { 
            id: Math.random().toString(36).substr(2, 9), 
            order_id: orderId, 
            entity_id: entityId, 
            entity_name: entityName, 
            action, 
            timestamp: new Date().toISOString(), 
            app_context: context 
        };
        let logs = load<LogEntry[]>(STORAGE_KEYS.LOGS, []);
        logs.unshift(log);
        save(STORAGE_KEYS.LOGS, logs.slice(0, 500));
    },

    async updateOrderAssignmentDetail(orderId: string, workerId: string, detail: Partial<OrderAssignment>) {
        let orders = load<Order[]>(STORAGE_KEYS.ORDERS, []);
        const oIdx = orders.findIndex(o => o.id === orderId);
        if (oIdx !== -1) {
            orders[oIdx].assignments_detail[workerId] = { ...orders[oIdx].assignments_detail[workerId], ...detail };
            save(STORAGE_KEYS.ORDERS, orders);
        }
    },

    async workerStartWork(workerId: string, orderId: string) {
        await this.updateOrderAssignmentDetail(orderId, workerId, { actual_start: new Date().toISOString() });
        await this.updateEmployee(workerId, { is_at_site: true });
    },

    async workerFinishWork(workerId: string, orderId: string) {
        const orders = await this.getOrders();
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        const detail = order.assignments_detail[workerId];
        if (!detail || !detail.actual_start) return;
        
        const actualEnd = new Date().toISOString();
        const start = new Date(detail.actual_start);
        const end = new Date(actualEnd);
        const hours = Math.round((end.getTime() - start.getTime()) / (3600000) * 10) / 10;
        const rate = order.order_services?.[0]?.price_worker || HOURLY_RATE_WORKER;
        const payout = hours * rate;

        await this.updateOrderAssignmentDetail(orderId, workerId, { actual_end: actualEnd, hours, payout, is_confirmed: true });
        
        const emps = await this.getEmployees();
        const emp = emps.find(e => e.id === workerId);
        if (emp) {
            await this.updateEmployee(workerId, { 
                is_at_site: false, 
                total_hours: (emp.total_hours || 0) + hours, 
                balance_owed: (emp.balance_owed || 0) + payout, 
                balance_today: (emp.balance_today || 0) + payout, 
                balance_month: (emp.balance_month || 0) + payout 
            });
        }
    },

    async createOrder(order: Partial<Order>) {
        const newOrder: Order = {
            id: Math.random().toString(36).substr(2, 9),
            client_name: order.client_name || '?',
            address: order.address || '?',
            datetime: order.datetime || new Date().toISOString(),
            required_workers: order.required_workers || 1,
            confirmed_workers_count: 0,
            status: 'active',
            assigned_employee_ids: [],
            order_services: order.order_services || [{ id: 's1', name: 'Разнорабочие', quantity: 1, price_worker: HOURLY_RATE_WORKER, price_client: HOURLY_RATE_CLIENT }],
            assignments_detail: {},
            paid_amount: 0,
            total_client_cost: 0,
            payment_status: 'unpaid',
            geo_required: false,
            payment_type: 'non-cash',
            claimed_by: null 
        };
        let orders = load<Order[]>(STORAGE_KEYS.ORDERS, []);
        orders.unshift(newOrder); 
        save(STORAGE_KEYS.ORDERS, orders);
    },

    async distributeClientPayment(clientName: string, amount: number) {
        let orders = await this.getOrders();
        let remainingPayment = amount;
        const unpaidOrders = orders.filter(o => o.client_name === clientName && o.status === 'completed' && o.payment_status === 'unpaid').sort((a, b) => a.datetime.localeCompare(b.datetime));
        
        for (let order of unpaidOrders) {
            if (remainingPayment <= 0) break;
            const debt = (order.total_client_cost || 0) - (order.paid_amount || 0);
            const paymentToApply = Math.min(debt, remainingPayment);
            order.paid_amount = (order.paid_amount || 0) + paymentToApply; 
            remainingPayment -= paymentToApply;
            if (order.paid_amount >= order.total_client_cost) order.payment_status = 'paid';
        }
        save(STORAGE_KEYS.ORDERS, orders);
    },

    async getWorkerFinance(workerId: string) {
        const emps = await this.getEmployees();
        const emp = emps.find(e => e.id === workerId);
        return { 
            today: emp?.balance_today || 0, 
            month: emp?.balance_month || 0, 
            total: emp?.balance_owed || 0 
        };
    },

    async claimOrder(orderId: string, dispatcherId: string) {
        let orders = load<Order[]>(STORAGE_KEYS.ORDERS, []);
        const idx = orders.findIndex(o => o.id === orderId);
        if (idx !== -1) { 
            orders[idx].claimed_by = dispatcherId; 
            save(STORAGE_KEYS.ORDERS, orders); 
        }
    },

    async getLogs(): Promise<LogEntry[]> { 
        return load<LogEntry[]>(STORAGE_KEYS.LOGS, []);
    },

    async confirmAssignment(orderId: string, workerId: string) {
        let orders = load<Order[]>(STORAGE_KEYS.ORDERS, []);
        const idx = orders.findIndex(o => o.id === orderId);
        if (idx !== -1) {
            const order = orders[idx];
            if (order.assignments_detail[workerId]) {
                order.assignments_detail[workerId].is_confirmed = true;
                // Пересчитываем только подтвержденных
                order.confirmed_workers_count = Object.values(order.assignments_detail).filter(a => a.is_confirmed).length;
                save(STORAGE_KEYS.ORDERS, orders);
                await this.addLog(workerId, 'Исполнитель', `Подтвердил участие на объекте: ${order.address}`, 'worker', orderId);
            }
        }
    },

    async rejectAssignment(orderId: string, workerId: string) {
        let orders = load<Order[]>(STORAGE_KEYS.ORDERS, []);
        const idx = orders.findIndex(o => o.id === orderId);
        if (idx !== -1) {
            const order = orders[idx];
            order.assigned_employee_ids = order.assigned_employee_ids.filter(id => id !== workerId);
            delete order.assignments_detail[workerId];
            order.confirmed_workers_count = Object.values(order.assignments_detail).filter(a => a.is_confirmed).length;
            save(STORAGE_KEYS.ORDERS, orders);
            await this.addLog(workerId, 'Исполнитель', `ОТКЛОНИЛ назначение на объект: ${order.address}`, 'worker', orderId);
        }
    },

    async claimOrderWorker(orderId: string, workerId: string) {
        const orders = await this.getOrders();
        const targetOrder = orders.find(o => o.id === orderId);
        if (!targetOrder || (targetOrder.assigned_employee_ids || []).includes(workerId)) return;
        
        // --- ПРОВЕРКА НА ПЕРЕСЕЧЕНИЕ ВРЕМЕНИ ---
        const targetDate = new Date(targetOrder.datetime).toDateString();
        const targetTime = new Date(targetOrder.datetime).getTime();
        
        const hasConflict = orders.some(o => 
            o.id !== orderId && 
            o.assigned_employee_ids.includes(workerId) && 
            new Date(o.datetime).toDateString() === targetDate &&
            Math.abs(new Date(o.datetime).getTime() - targetTime) < (4 * 3600000) 
        );

        if (hasConflict) {
            throw new Error('CONFLICT_TIME');
        }

        const newAssigned = [...(targetOrder.assigned_employee_ids || []), workerId];
        // Изначально is_confirmed: false. Подтверждение только вручную.
        const newAssignments = { ...(targetOrder.assignments_detail || {}), [workerId]: { start_time: '08:00', end_time: '17:00', hours: 0, payout: 0, is_confirmed: false } };
        
        let all = load<Order[]>(STORAGE_KEYS.ORDERS, []);
        const idx = all.findIndex(o => o.id === orderId);
        if (idx !== -1) {
            all[idx] = { 
                ...all[idx], 
                assigned_employee_ids: newAssigned, 
                assignments_detail: newAssignments, 
                // confirmed_workers_count НЕ обновляем здесь, ждем confirmAssignment
            };
            save(STORAGE_KEYS.ORDERS, all);
        }
    },

    async updateOrderGeoRequirement(orderId: string, required: boolean) {
        let orders = load<Order[]>(STORAGE_KEYS.ORDERS, []);
        const idx = orders.findIndex(o => o.id === orderId);
        if (idx !== -1) { orders[idx].geo_required = required; save(STORAGE_KEYS.ORDERS, orders); }
    },

    async assignWorkerToOrder(orderId: string, employeeId: string) { 
        await this.claimOrderWorker(orderId, employeeId).catch(() => {});
        // Принудительная отправка PUSH через локальные уведомления
        const order = (await this.getOrders()).find(o => o.id === orderId);
        if (order) {
            notificationService.sendLocalNotification(
                'НОВОЕ НАЗНАЧЕНИЕ! 👷',
                `Вас назначили на объект: ${order.address}. Требуется подтверждение!`,
                '/'
            );
        }
    },
    
    async sendChatMessage(msg: any) {
        const newMsg: ChatMessage = { id: Math.random().toString(36).substr(2, 9), ...msg, timestamp: new Date().toISOString(), is_read: false, status: 'sent' };
        let chats = load<ChatMessage[]>(STORAGE_KEYS.CHATS, []);
        chats.push(newMsg); save(STORAGE_KEYS.CHATS, chats);
    },

    async getChats(workerId: string): Promise<ChatMessage[]> {
        let local = load<ChatMessage[]>(STORAGE_KEYS.CHATS, []);
        if (workerId === 'all') return local;
        return local.filter(c => c.sender_id === workerId || c.recipient_id === workerId);
    },

    async markMessagesAsRead(workerId: string, dispatcherId: string) {
        let chats = load<ChatMessage[]>(STORAGE_KEYS.CHATS, []);
        chats.forEach(c => { if (c.sender_id === workerId && c.recipient_id === dispatcherId) c.is_read = true; });
        save(STORAGE_KEYS.CHATS, chats);
    },

    async updateLocation(workerId: string, lat: number, lng: number) {
        await this.updateEmployee(workerId, { lat, lng, last_location_update: new Date().toISOString() });
    },

    async toggleDispatcherGeoAccess(id: string) {
        const disps = await this.getDispatchers();
        const d = disps.find(disp => disp.id === id);
        if (d) await this.updateDispatcher(id, { geo_allowed: !d.geo_allowed });
    },

    async updateEmployee(id: string, data: Partial<Employee>) {
        let emps = load<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
        const idx = emps.findIndex(e => e.id === id);
        if (idx !== -1) { 
            emps[idx] = { ...emps[idx], ...data }; 
            save(STORAGE_KEYS.EMPLOYEES, emps); 
        }
    },

    async addEmployeeReview(workerId: string, review: Omit<EmployeeReview, 'id' | 'timestamp'>) {
        let emps = load<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
        const idx = emps.findIndex(e => e.id === workerId);
        if (idx !== -1) {
            const newReview: EmployeeReview = {
                id: Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toISOString(),
                ...review
            };
            const currentReviews = emps[idx].reviews || [];
            const updatedReviews = [newReview, ...currentReviews];
            
            // Calculate new average rating
            const sum = updatedReviews.reduce((acc, r) => acc + r.rating, 0);
            const avgRating = sum / updatedReviews.length;
            
            emps[idx] = { 
                ...emps[idx], 
                reviews: updatedReviews,
                rating: avgRating
            }; 
            save(STORAGE_KEYS.EMPLOYEES, emps);
            await this.addLog(workerId, 'Админ', `Оставлен отзыв на сотрудника: ${review.rating} звезд.`, 'admin');
        }
    },

    async updateDispatcher(id: string, data: Partial<Dispatcher>) {
        let disps = await this.getDispatchers();
        const idx = disps.findIndex(d => d.id === id);
        if (idx !== -1) { 
            disps[idx] = { ...disps[idx], ...data }; 
            save(STORAGE_KEYS.DISPATCHERS, disps); 
        }
    },

    async createEmployee(data: Partial<Employee>) {
        const newEmp = { 
            id: data.id || `w_${Math.random().toString(36).substr(2, 5)}`, 
            full_name: data.full_name || '?', 
            phone: data.phone || '?', 
            messengers: [], 
            is_self_employed: false, 
            total_hours: 0, 
            rating: 5, 
            status: 'new', 
            balance_paid: 0, 
            balance_owed: 0, 
            balance_today: 0, 
            balance_month: 0, 
            is_online: false, 
            is_at_site: false, 
            avatar_color: '#' + Math.floor(Math.random()*16777215).toString(16),
            reviews: []
        };
        let emps = load<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
        if (!emps.find(e => e.id === newEmp.id)) {
            emps.push(newEmp as Employee);
            save(STORAGE_KEYS.EMPLOYEES, emps);
        }
        return newEmp;
    }
};
