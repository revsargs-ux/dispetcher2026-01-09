
import { dataService } from './dataService';

export interface AppHealthReport {
    timestamp: string;
    metrics: {
        totalEmployees: number;
        totalOrders: number;
        delayedOrders: number;
        delayedPercentage: number;
        totalMessages: number;
        unreadMessages: number;
        storageUsage: string;
    };
    performance: {
        renderTime: number; // ms
        apiSimulationLatency: number; // ms
    };
    status: 'healthy' | 'warning' | 'critical';
}

export const reportService = {
    async generateReport(): Promise<AppHealthReport> {
        const start = performance.now();
        
        const emps = await dataService.getEmployees();
        const orders = await dataService.getOrders();
        const chats = await dataService.getChats('all'); // Simulated fetch
        
        const delayed = orders.filter(o => {
            const isDelayed = new Date(o.datetime) < new Date() && o.status !== 'completed';
            return isDelayed;
        }).length;

        const unread = emps.reduce((acc, curr) => acc + (curr.unread_count || 0), 0);
        
        // Расчет объема localStorage
        const storageSize = (JSON.stringify(localStorage).length / 1024).toFixed(2);

        const end = performance.now();

        return {
            timestamp: new Date().toISOString(),
            metrics: {
                totalEmployees: emps.length,
                totalOrders: orders.length,
                delayedOrders: delayed,
                delayedPercentage: orders.length > 0 ? (delayed / orders.length) * 100 : 0,
                totalMessages: chats.length,
                unreadMessages: unread,
                storageUsage: `${storageSize} KB`
            },
            performance: {
                renderTime: Math.round(end - start),
                apiSimulationLatency: 12 // Фиксированная задержка имитации
            },
            status: emps.length >= 50 && orders.length >= 100 ? 'healthy' : 'warning'
        };
    }
};
