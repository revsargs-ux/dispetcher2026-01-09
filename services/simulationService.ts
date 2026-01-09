
import { dataService } from './dataService';

const CLIENTS_DATA = [
    { id: 'c_test_client', name: 'тест клиент', phone: '+79001110000' },
    { name: 'ТЦ Шамса', phone: '+79001112233' },
    { name: 'Рыбхоз Камчатка', phone: '+79004445566' },
    { name: 'СтройМир', phone: '+79140001122' }
];

const INITIAL_WORKERS = [
    { id: 'w_test_exec', full_name: 'тестисполнитель', phone: '+79990000000' },
    { full_name: 'Иван Петров', phone: '+79991234567' },
    { full_name: 'Сергей Николаев', phone: '+79997654321' }
];

const ADDRESSES = [
    'ул. Ленина 15', 'пр-кт Победы 4', 'ул. Северо-Восточная 22', 'шоссе Индустриальное 1', 'ул. Морская 8'
];

const MESSAGES = [
    "Доброе утро, выезжаю на объект.",
    "Я на месте, где найти старшего?",
    "Подскажите номер телефона заказчика.",
    "Закончили разгрузку, ждем распоряжений."
];

let intervals: number[] = [];

export const simulationService = {
    async start() {
        this.stop(); // Clear previous before starting
        console.log("[Simulation] Starting operational background tasks...");
        
        // 0. Initial seed
        for (const w of INITIAL_WORKERS) await dataService.createEmployee(w);
        for (const c of CLIENTS_DATA) await dataService.createCustomer(c.name, c.phone, c.id);

        // 1. Orders creation (Every 30s)
        intervals.push(window.setInterval(async () => {
            const currentCustomers = await dataService.getCustomersList();
            const client = currentCustomers[Math.floor(Math.random() * currentCustomers.length)].name;
            const addr = ADDRESSES[Math.floor(Math.random() * ADDRESSES.length)];
            await dataService.createOrder({
                client_name: client,
                address: addr,
                required_workers: 2 + Math.floor(Math.random() * 3),
                datetime: new Date().toISOString()
            });
        }, 30000));

        // 2. Chat Simulation (Every 25s)
        intervals.push(window.setInterval(async () => {
            const emps = await dataService.getEmployees();
            const online = emps.filter(e => e.is_online);
            if (online.length === 0) return;
            const emp = online[Math.floor(Math.random() * online.length)];
            const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
            await dataService.sendChatMessage({ sender_id: emp.id, recipient_id: 'd1', text: msg });
        }, 25000));

        // 3. Status updates (Every 15s)
        intervals.push(window.setInterval(async () => {
            const emps = await dataService.getEmployees();
            if (emps.length === 0) return;
            const target = emps[Math.floor(Math.random() * emps.length)];
            await dataService.updateEmployee(target.id, { is_online: Math.random() > 0.3 });
        }, 15000));
    },

    stop() {
        console.log("[Simulation] Cleaning up intervals...");
        intervals.forEach(clearInterval);
        intervals = [];
    }
};
