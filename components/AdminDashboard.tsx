
import React, { useState, useEffect, useMemo } from 'react';
import { Employee, Order, LogEntry, Dispatcher, OrderAssignment } from '../types';
import { dataService } from '../services/dataService';
import { PeriodSelector } from './Shared';
import { AIInsights } from './AIInsights';
import { HOURLY_RATE_CLIENT, HOURLY_RATE_WORKER } from '../constants';

interface AdminDashboardProps {
    onImpersonate: (role: 'dispatcher' | 'worker' | 'customer', userId?: string) => void;
    onLogout: () => void;
    adminEmail: string;
}

type AdminCategory = 'dispatchers' | 'employees' | 'customers';

const getTodayStr = () => new Date().toISOString().split('T')[0];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onImpersonate, onLogout, adminEmail }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [dispatchers, setDispatchers] = useState<Dispatcher[]>([]);
    const [showAIAudit, setShowAIAudit] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<AdminCategory>('dispatchers');
    
    const [startDate, setStartDate] = useState(getTodayStr());
    const [endDate, setEndDate] = useState(getTodayStr());

    const refreshData = () => {
        dataService.getEmployees().then(setEmployees);
        dataService.getOrders().then(setOrders);
        dataService.getDispatchers().then(setDispatchers);
    }

    useEffect(() => {
        refreshData();
        const int = setInterval(refreshData, 10000);
        return () => clearInterval(int);
    }, []);

    const toggleGeoAccess = async (id: string) => {
        await dataService.toggleDispatcherGeoAccess(id);
        refreshData();
    };

    const uniqueClients = useMemo(() => Array.from(new Set(orders.map(o => o.client_name))), [orders]);

    // Financial calculations per period
    const statsData = useMemo(() => {
        const filteredOrders = orders.filter(o => 
            o.datetime.split('T')[0] >= startDate && 
            o.datetime.split('T')[0] <= endDate
        );

        const dispStats = dispatchers.map(d => {
            const revenue = filteredOrders.filter(o => o.claimed_by === d.id).reduce((acc, o) => {
                const clientRate = o.order_services[0]?.price_client || HOURLY_RATE_CLIENT;
                const workerRate = o.order_services[0]?.price_worker || HOURLY_RATE_WORKER;
                return acc + Object.values(o.assignments_detail).reduce((sum: number, detail: OrderAssignment) => 
                    sum + (detail.hours * (clientRate - workerRate)), 0);
            }, 0);
            return { ...d, periodRevenue: Math.round(revenue) };
        });

        const empStats = employees.map(e => {
            const earnings = filteredOrders.reduce((acc, o) => {
                const detail = o.assignments_detail[e.id];
                return acc + (detail ? detail.payout : 0);
            }, 0);
            return { ...e, periodEarnings: Math.round(earnings) };
        });

        const custStats = uniqueClients.map(clientName => {
            const totalInvoiced = filteredOrders.filter(o => o.client_name === clientName).reduce((acc, o) => {
                const clientRate = o.order_services[0]?.price_client || HOURLY_RATE_CLIENT;
                return acc + Object.values(o.assignments_detail).reduce((sum: number, detail: OrderAssignment) => 
                    sum + (detail.hours * clientRate), 0);
            }, 0);
            const activeCount = orders.filter(o => o.client_name === clientName && o.status === 'active').length;
            return { name: clientName, periodInvoiced: Math.round(totalInvoiced), activeCount };
        });

        const totalRevenue = dispStats.reduce((sum, s) => sum + s.periodRevenue, 0);

        return { dispStats, empStats, custStats, totalRevenue };
    }, [dispatchers, employees, orders, startDate, endDate, uniqueClients]);

    return (
        <div className="min-h-screen bg-slate-100 font-sans">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-lg sticky top-0 z-[100]">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center font-bold text-xl shadow-inner shadow-black/20 italic">A</div>
                    <div>
                        <h1 className="text-lg font-bold leading-none tracking-tight">Администратор</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{adminEmail}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <button 
                        onClick={() => setShowAIAudit(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-900/20 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span>🤖</span> ИИ Аудит
                    </button>
                    <button onClick={onLogout} className="text-xs font-black uppercase tracking-widest bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors border border-slate-700">
                        Выйти
                    </button>
                </div>
            </div>

            <div className="p-6 max-w-7xl mx-auto space-y-8">
                
                {/* Navigation Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <button 
                        onClick={() => setActiveCategory('employees')}
                        className={`text-left p-6 rounded-3xl shadow-sm border transition-all active:scale-95 hover:shadow-lg ${activeCategory === 'employees' ? 'bg-blue-600 text-white border-blue-700 ring-4 ring-blue-500/20' : 'bg-white border-slate-200 text-slate-800'}`}
                    >
                        <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${activeCategory === 'employees' ? 'text-blue-100' : 'text-slate-400'}`}>Рабочие</div>
                        <div className="text-4xl font-black italic">{employees.length}</div>
                        <div className={`text-[8px] font-bold uppercase mt-2 ${activeCategory === 'employees' ? 'text-blue-200' : 'text-slate-400'}`}>База персонала</div>
                    </button>

                    <button 
                        onClick={() => setActiveCategory('customers')}
                        className={`text-left p-6 rounded-3xl shadow-sm border transition-all active:scale-95 hover:shadow-lg ${activeCategory === 'customers' ? 'bg-blue-600 text-white border-blue-700 ring-4 ring-blue-500/20' : 'bg-white border-slate-200 text-slate-800'}`}
                    >
                        <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${activeCategory === 'customers' ? 'text-blue-100' : 'text-slate-400'}`}>Заказчики</div>
                        <div className="text-4xl font-black italic">{uniqueClients.length}</div>
                        <div className={`text-[8px] font-bold uppercase mt-2 ${activeCategory === 'customers' ? 'text-blue-200' : 'text-slate-400'}`}>Контрагенты</div>
                    </button>

                    <button 
                        onClick={() => setActiveCategory('dispatchers')}
                        className={`text-left p-6 rounded-3xl shadow-sm border transition-all active:scale-95 hover:shadow-lg ${activeCategory === 'dispatchers' ? 'bg-blue-600 text-white border-blue-700 ring-4 ring-blue-500/20' : 'bg-white border-slate-200 text-slate-800'}`}
                    >
                        <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${activeCategory === 'dispatchers' ? 'text-blue-100' : 'text-slate-400'}`}>Диспетчеры</div>
                        <div className="text-4xl font-black italic">{dispatchers.length}</div>
                        <div className={`text-[8px] font-bold uppercase mt-2 ${activeCategory === 'dispatchers' ? 'text-blue-200' : 'text-slate-400'}`}>Команда управления</div>
                    </button>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 bg-green-50/50 flex flex-col justify-center">
                        <div className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Общая маржа (Период)</div>
                        <div className="text-3xl font-black text-green-700 italic">
                            {statsData.totalRevenue.toLocaleString()} ₽
                        </div>
                        <div className="text-[8px] text-slate-400 font-bold uppercase mt-2">
                             {startDate} — {endDate}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex-1">
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em] mb-4 ml-1">
                                {activeCategory === 'dispatchers' && 'Управление диспетчерами'}
                                {activeCategory === 'employees' && 'Мониторинг персонала'}
                                {activeCategory === 'customers' && 'Аналитика по заказчикам'}
                            </h3>
                            <PeriodSelector 
                                startDate={startDate} 
                                endDate={endDate} 
                                onRangeChange={(s, e) => { setStartDate(s); setEndDate(e); }} 
                            />
                        </div>
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Поиск в таблице..." 
                                className="bg-white border border-slate-200 rounded-2xl px-6 py-3.5 text-xs font-bold w-72 outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest border-b">
                                <tr>
                                    <th className="p-6">Наименование / ФИО</th>
                                    <th className="p-6">{activeCategory === 'customers' ? 'Заявки' : 'GPS / Онлайн'}</th>
                                    <th className="p-6">Статус</th>
                                    <th className="p-6 text-blue-600">
                                        {activeCategory === 'employees' ? 'Выплаты (Период)' : activeCategory === 'customers' ? 'Счета (Период)' : 'Маржа (Период)'}
                                    </th>
                                    <th className="p-6 text-right">Управление</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {activeCategory === 'dispatchers' && statsData.dispStats
                                    .filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map(d => (
                                    <tr key={d.id} className="hover:bg-slate-50/50 group transition-colors">
                                        <td className="p-6">
                                            <div className="font-black text-slate-800">{d.name}</div>
                                            <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Phone: {d.phone}</div>
                                        </td>
                                        <td className="p-6">
                                            <button 
                                                onClick={() => toggleGeoAccess(d.id)}
                                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${
                                                    d.geo_allowed ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-200 text-slate-400'
                                                }`}
                                            >
                                                {d.geo_allowed ? 'Разрешен' : 'Запрещен'}
                                            </button>
                                        </td>
                                        <td className="p-6 text-xs font-bold">
                                            <div className="flex items-center space-x-2">
                                                <span className={`w-2 h-2 rounded-full ${d.status === 'active' ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                                                <span className={d.status === 'active' ? 'text-green-600 uppercase text-[10px]' : 'text-orange-500 uppercase text-[10px]'}>
                                                    {d.status === 'active' ? 'В сети' : 'Перерыв'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="font-black text-blue-600 text-lg">{d.periodRevenue.toLocaleString()} ₽</div>
                                            <div className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">Эффективность смен</div>
                                        </td>
                                        <td className="p-6 text-right">
                                            <button 
                                                onClick={() => onImpersonate('dispatcher', d.id)}
                                                className="bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-md"
                                            >
                                                Войти в кабинет
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {activeCategory === 'employees' && statsData.empStats
                                    .filter(e => e.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map(e => (
                                    <tr key={e.id} className="hover:bg-slate-50/50 group transition-colors">
                                        <td className="p-6">
                                            <div className="font-black text-slate-800">{e.full_name}</div>
                                            <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{e.phone}</div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center space-x-2">
                                                <span className={`w-2 h-2 rounded-full ${e.is_online ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase">{e.is_online ? 'Активен' : 'Оффлайн'}</span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg w-fit ${e.status === 'experienced' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                                {e.status === 'experienced' ? 'Опытный' : 'Новичок'}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="font-black text-blue-600 text-lg">{e.periodEarnings.toLocaleString()} ₽</div>
                                            <div className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">Заработок за период</div>
                                        </td>
                                        <td className="p-6 text-right">
                                            <button 
                                                onClick={() => onImpersonate('worker', e.id)}
                                                className="bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-md"
                                            >
                                                Войти в профиль
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {activeCategory === 'customers' && statsData.custStats
                                    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map(c => (
                                    <tr key={c.name} className="hover:bg-slate-50/50 group transition-colors">
                                        <td className="p-6">
                                            <div className="font-black text-slate-800">{c.name}</div>
                                            <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Юридическое лицо</div>
                                        </td>
                                        <td className="p-6">
                                            <div className="text-sm font-black text-slate-700">{c.activeCount} <span className="text-[10px] text-slate-400 font-bold uppercase">Активных</span></div>
                                        </td>
                                        <td className="p-6">
                                            <div className="bg-green-50 text-green-600 text-[10px] font-black uppercase px-2 py-1 rounded-lg w-fit">Лояльный</div>
                                        </td>
                                        <td className="p-6">
                                            <div className="font-black text-blue-600 text-lg">{c.periodInvoiced.toLocaleString()} ₽</div>
                                            <div className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">Объем заказов</div>
                                        </td>
                                        <td className="p-6 text-right">
                                            <button 
                                                onClick={() => onImpersonate('customer', c.name)}
                                                className="bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-md"
                                            >
                                                Войти в кабинет
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {(activeCategory === 'dispatchers' ? statsData.dispStats : activeCategory === 'employees' ? statsData.empStats : statsData.custStats).length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-24 text-center text-slate-300 italic font-bold uppercase tracking-widest">
                                            Нет данных для отображения
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showAIAudit && <AIInsights onClose={() => setShowAIAudit(false)} />}
        </div>
    );
};
