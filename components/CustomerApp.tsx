
import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderServiceItem, Employee, Dispatcher, OrderAssignment } from '../types';
import { dataService } from '../services/dataService';
import { CustomDatePicker } from './Shared';
import { MIN_HOURLY_RATE_CLIENT, HOURLY_RATE_WORKER } from '../constants';

export const CustomerApp: React.FC<{ onLogout: () => void, userEmail: string, isAdminView?: boolean }> = ({ onLogout, userEmail, isAdminView }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [systemStats, setSystemStats] = useState({ workersAtSiteCount: 0, onlineFreeWorkers: 0, onlineDispatchers: 0 });
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    
    // Form state
    const [orderAddress, setOrderAddress] = useState('');
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [orderHour, setOrderHour] = useState('09');
    const [orderMinute, setOrderMinute] = useState('00');
    const [orderServices, setOrderServices] = useState<OrderServiceItem[]>([
        { id: Math.random().toString(36).substr(2, 9), name: 'Разнорабочий', quantity: 1, price_worker: HOURLY_RATE_WORKER, price_client: MIN_HOURLY_RATE_CLIENT }
    ]);

    const specialistTypes = ['Разнорабочий', 'Грузчик', 'Экспедитор', 'Строитель', 'Монтажник', 'Уборщик'];
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutes = ['00', '15', '30', '45'];

    const clientName = useMemo(() => {
        if (userEmail.includes('shamsa')) return 'ТЦ Шамса';
        if (userEmail.includes('fish')) return 'Рыбхоз Камчатка';
        return 'ТЦ Шамса';
    }, [userEmail]);

    // ЛОГИКА ШАБЛОНОВ: Самые популярные из последних
    const orderTemplates = useMemo(() => {
        const counts: Record<string, { order: Order, frequency: number }> = {};
        
        orders.forEach(o => {
            const key = `${o.address}-${JSON.stringify(o.order_services.map(s => s.name + s.quantity))}`;
            if (!counts[key]) {
                counts[key] = { order: o, frequency: 0 };
            }
            counts[key].frequency += 1;
        });

        return Object.values(counts)
            .sort((a, b) => b.frequency - a.frequency || b.order.datetime.localeCompare(a.order.datetime))
            .slice(0, 4)
            .map(item => item.order);
    }, [orders]);

    useEffect(() => {
        loadData();
        const int = setInterval(loadData, 5000);
        return () => clearInterval(int);
    }, [clientName]);

    const loadData = async () => {
        const [allOrders, stats] = await Promise.all([
            dataService.getOrders(),
            dataService.getSystemStats()
        ]);
        setOrders(allOrders.filter(o => o.client_name === clientName));
        setSystemStats(stats);
    };

    const applyTemplate = (template: Order) => {
        setOrderAddress(template.address);
        setOrderServices(template.order_services.map(s => ({
            ...s,
            id: Math.random().toString(36).substr(2, 9)
        })));
    };

    const updateService = (id: string, field: keyof OrderServiceItem, value: any) => {
        setOrderServices(orderServices.map(s => {
            if (s.id === id) {
                return { ...s, [field]: value };
            }
            return s;
        }));
    };

    const handleCreateOrder = async () => {
        if (!orderAddress) return alert('Укажите адрес объекта');
        const totalWorkers = orderServices.reduce((sum, s) => sum + s.quantity, 0);
        const combinedDateTime = `${orderDate}T${orderHour}:${orderMinute}:00`;

        await dataService.createOrder({
            address: orderAddress,
            datetime: combinedDateTime,
            required_workers: totalWorkers,
            order_services: orderServices,
            client_name: clientName,
            status: 'active'
        });

        setIsOrderModalOpen(false);
        loadData();
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans flex flex-col overflow-x-hidden">
            {/* Header */}
            <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-lg sticky top-0 z-[100]">
                <div className="flex items-center space-x-3">
                    <div className="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl italic shadow-lg shadow-blue-500/20 tracking-tighter">К.ПРО</div>
                    <div>
                        <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-70">КАБИНЕТ ЗАКАЗЧИКА</h1>
                        <p className="text-sm font-black truncate">{clientName}</p>
                    </div>
                </div>
                <button onClick={onLogout} className="bg-slate-800 hover:bg-red-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95">Выйти</button>
            </header>

            <main className="flex-1 p-6 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="В РАБОТЕ" value={systemStats.workersAtSiteCount} color="text-blue-600" />
                    <StatCard label="СВОБОДНО" value={systemStats.onlineFreeWorkers} color="text-green-600" />
                    <button onClick={() => setIsOrderModalOpen(true)} className="col-span-2 bg-blue-600 text-white rounded-[2rem] p-6 flex items-center justify-between shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 group">
                        <div className="text-left">
                            <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Новое поручение</div>
                            <div className="text-xl font-black italic uppercase tracking-tighter">ОФОРМИТЬ ЗАЯВКУ</div>
                        </div>
                        <span className="text-3xl group-hover:translate-x-1 transition-transform">➕</span>
                    </button>
                </div>

                {/* Active Shifts List */}
                <div className="space-y-4">
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic ml-1">Активные объекты</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {orders.filter(o => o.status === 'active').map(order => (
                            <div key={order.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-black text-slate-900 truncate uppercase italic tracking-tighter">{order.address}</h3>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Тариф: {order.order_services[0]?.price_client} ₽/час</p>
                                    </div>
                                    <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl border border-blue-100 font-mono font-black text-xs italic">
                                        {order.confirmed_workers_count}/{order.required_workers}
                                    </div>
                                </div>
                                <button className="w-full bg-slate-50 text-slate-400 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-50 hover:text-blue-600 transition-all">Детали смены</button>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* MODAL: NEW ORDER (Refined to match screenshot) */}
            {isOrderModalOpen && (
                <div className="fixed inset-0 bg-slate-950/80 z-[500] flex items-center justify-center p-4 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl flex flex-col overflow-hidden animate-in zoom-in duration-300 border border-white/20">
                        {/* Header */}
                        <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight">НОВАЯ ЗАЯВКА</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">АВТОМАТИЧЕСКОЕ ЗАПОЛНЕНИЕ ПО ШАБЛОНУ</p>
                            </div>
                            <button onClick={() => setIsOrderModalOpen(false)} className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-all font-black text-xl flex items-center justify-center">✕</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            {/* Templates / Popular Orders */}
                            {orderTemplates.length > 0 && (
                                <div className="space-y-3">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1 italic">БЫСТРЫЙ ВЫБОР ИЗ ПОПУЛЯРНЫХ</label>
                                    <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
                                        {orderTemplates.map(t => (
                                            <button 
                                                key={t.id} 
                                                onClick={() => applyTemplate(t)}
                                                className="shrink-0 bg-blue-50 border-2 border-blue-100/50 p-4 rounded-3xl text-left hover:border-blue-500 hover:bg-blue-100/50 transition-all active:scale-95 w-44"
                                            >
                                                <div className="text-[10px] font-black text-blue-700 truncate uppercase italic mb-1">{t.address}</div>
                                                <div className="text-[8px] font-bold text-slate-500 truncate uppercase tracking-tighter">
                                                    {t.order_services.map(s => `${s.quantity} ${s.name}`).join(' + ')}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Main Form Fields */}
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">АДРЕС ОБЪЕКТА</label>
                                    <input 
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-6 py-5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner" 
                                        placeholder="Укажите точный адрес..." 
                                        value={orderAddress} 
                                        onChange={e => setOrderAddress(e.target.value)} 
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">ДАТА НАЧАЛА</label>
                                        <div className="bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] p-1.5 shadow-inner">
                                            <CustomDatePicker value={orderDate} onChange={setOrderDate} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">ВРЕМЯ НАЧАЛА</label>
                                        <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-[1.5rem] shadow-inner">
                                            <select className="flex-1 bg-white border-none rounded-xl py-3 text-sm font-black text-slate-800 outline-none shadow-sm text-center" value={orderHour} onChange={e => setOrderHour(e.target.value)}>
                                                {hours.map(h => <option key={h} value={h}>{h} ч.</option>)}
                                            </select>
                                            <select className="flex-1 bg-white border-none rounded-xl py-3 text-sm font-black text-slate-800 outline-none shadow-sm text-center" value={orderMinute} onChange={e => setOrderMinute(e.target.value)}>
                                                {minutes.map(m => <option key={m} value={m}>{m} мин.</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Personnel Type Section */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ТИП ПЕРСОНАЛА</label>
                                    <button onClick={() => setOrderServices([...orderServices, { id: Math.random().toString(36).substr(2, 9), name: 'Разнорабочий', quantity: 1, price_worker: HOURLY_RATE_WORKER, price_client: MIN_HOURLY_RATE_CLIENT }])} className="text-blue-600 text-[10px] font-black uppercase tracking-[0.2em] hover:underline">+ ДОБАВИТЬ ТИП</button>
                                </div>
                                {orderServices.map((service) => (
                                    <div key={service.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 space-y-5 relative shadow-sm">
                                        <div className="relative">
                                            <select className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-black text-slate-800 outline-none appearance-none italic" value={service.name} onChange={e => updateService(service.id, 'name', e.target.value)}>
                                                {specialistTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[8px] font-black text-slate-400 uppercase block ml-1 tracking-widest">КОЛ-ВО ЧЕЛ.</label>
                                                <div className="flex items-center bg-slate-50 rounded-2xl p-1 gap-1 shadow-inner">
                                                    <button onClick={() => updateService(service.id, 'quantity', Math.max(1, service.quantity - 1))} className="w-12 h-12 bg-white rounded-xl font-black text-blue-600 shadow-sm hover:bg-blue-50 active:scale-90 transition-all">-</button>
                                                    <div className="flex-1 text-center font-black text-xl italic text-blue-700">{service.quantity}</div>
                                                    <button onClick={() => updateService(service.id, 'quantity', service.quantity + 1)} className="w-12 h-12 bg-white rounded-xl font-black text-blue-600 shadow-sm hover:bg-blue-50 active:scale-90 transition-all">+</button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[8px] font-black text-slate-400 uppercase block ml-1 tracking-widest">СТАВКА ЧАС (+50₽)</label>
                                                <div className="flex items-center bg-slate-50 rounded-2xl p-1 gap-1 shadow-inner">
                                                    <button onClick={() => updateService(service.id, 'price_client', Math.max(MIN_HOURLY_RATE_CLIENT, service.price_client - 50))} className="w-12 h-12 bg-white rounded-xl font-black text-blue-600 shadow-sm hover:bg-blue-50 active:scale-90 transition-all">-</button>
                                                    <div className="flex-1 text-center font-black text-sm text-slate-900">{service.price_client} ₽</div>
                                                    <button onClick={() => updateService(service.id, 'price_client', service.price_client + 50)} className="w-12 h-12 bg-white rounded-xl font-black text-blue-600 shadow-sm hover:bg-blue-50 active:scale-90 transition-all">+</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Footer Actions */}
                        <div className="p-8 border-t bg-white flex justify-between items-center shrink-0 rounded-b-[3rem] shadow-[0_-15px_30px_rgba(0,0,0,0.03)]">
                            <div>
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">ИТОГОВОЕ КОЛИЧЕСТВО</div>
                                <div className="text-2xl font-black text-slate-950 italic tracking-tighter leading-none">
                                    {orderServices.reduce((sum, s) => sum + s.quantity, 0)} сотрудников
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setIsOrderModalOpen(false)} className="px-8 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">ОТМЕНА</button>
                                <button onClick={handleCreateOrder} className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-blue-600/20 active:scale-95 hover:bg-blue-700 transition-all">ОФОРМИТЬ ЗАЯВКУ</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ label, value, color }: { label: string, value: number, color: string }) => (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-center">
        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
        <div className={`text-3xl font-black italic tracking-tighter ${color}`}>{value}</div>
    </div>
);
