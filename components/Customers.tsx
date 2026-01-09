
import React, { useState, useEffect, useMemo } from 'react';
import { Order } from '../types';
import { dataService } from '../services/dataService';
import { AddCustomerModal } from './AddCustomerModal';

export const Customers: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [registeredCustomers, setRegisteredCustomers] = useState<any[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [ordersData, customersData] = await Promise.all([
                dataService.getOrders(),
                dataService.getCustomersList()
            ]);
            setOrders(ordersData);
            setRegisteredCustomers(customersData);
        } finally {
            setIsLoading(false);
        }
    };

    // Объединяем заказчиков из заказов и явно зарегистрированных
    const customers = useMemo(() => {
        const map = new Map<string, { id?: string, count: number, total: number, lastOrder: string, phone?: string }>();
        
        // Сначала берем тех, кто в базе заказчиков
        registeredCustomers.forEach(rc => {
            map.set(rc.name, { id: rc.id, count: 0, total: 0, lastOrder: '-', phone: rc.phone });
        });

        // Добавляем статистику из заказов
        orders.forEach(o => {
            const data = map.get(o.client_name) || { count: 0, total: 0, lastOrder: o.datetime, phone: '-' };
            data.count += 1;
            data.total += (o.total_client_cost || 0);
            if (o.datetime !== '-' && o.datetime > data.lastOrder) data.lastOrder = o.datetime;
            map.set(o.client_name, data);
        });
        
        return Array.from(map.entries()).map(([name, stats]) => ({ name, ...stats }));
    }, [orders, registeredCustomers]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-100">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-10 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-end mb-10">
                <div>
                    <h2 className="text-4xl font-black italic text-slate-900 uppercase tracking-tighter">ЗАКАЗЧИКИ</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Реестр контрагентов и управление доступом</p>
                </div>
                <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95"
                >
                    + ДОБАВИТЬ ЗАКАЗЧИКА
                </button>
            </div>

            {customers.length === 0 ? (
                <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 p-20 text-center flex flex-col items-center">
                    <div className="text-8xl mb-8 grayscale opacity-20">🏢</div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Список пока пуст</h3>
                    <p className="text-sm text-slate-500 font-medium max-w-md mx-auto mt-4 leading-relaxed">
                        Зарегистрируйте вашего первого заказчика, чтобы отправлять приглашения в кабинет и отслеживать историю заказов.
                    </p>
                    <button 
                        onClick={() => setShowAddModal(true)}
                        className="mt-10 bg-slate-900 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all"
                    >
                        Создать первую карточку
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                            <tr>
                                <th className="px-8 py-5 text-left">Наименование / Контрагент</th>
                                <th className="px-8 py-5 text-center">Контакт</th>
                                <th className="px-8 py-5 text-center">Всего заказов</th>
                                <th className="px-8 py-5 text-center">Сумма оборота</th>
                                <th className="px-8 py-5 text-right">Управление</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                            {customers.map(c => (
                                <tr key={c.name} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="font-black text-slate-800 uppercase italic tracking-tighter">{c.name}</div>
                                        <div className="text-[8px] font-black text-slate-400 uppercase mt-1">
                                            {c.lastOrder === '-' ? 'Заказов нет' : `Последний: ${c.lastOrder.split('T')[0]}`}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center font-bold text-slate-500">{c.phone || '—'}</td>
                                    <td className="px-8 py-6 text-center font-bold text-slate-400 italic">{c.count}</td>
                                    <td className="px-8 py-6 text-center font-black text-blue-600">{c.total.toLocaleString()} ₽</td>
                                    <td className="px-8 py-6 text-right">
                                        <button onClick={() => setEditingCustomer(c)} className="text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors">Правка</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showAddModal && (
                <AddCustomerModal 
                    onClose={() => setShowAddModal(false)} 
                    onSuccess={loadData}
                />
            )}

            {editingCustomer && (
              <div className="fixed inset-0 bg-slate-900/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
                <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-10 overflow-hidden flex flex-col">
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-8 italic">Редактировать заказчика</h3>
                  <div className="space-y-6 overflow-y-auto custom-scrollbar flex-1 pr-2">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Наименование</label>
                      <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 outline-none focus:border-blue-600/30 transition-all" value={editingCustomer.name} readOnly />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Телефон</label>
                      <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 outline-none focus:border-blue-600/30 transition-all" value={editingCustomer.phone || ''} readOnly />
                    </div>
                    <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100">
                        <label className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2 block italic">Ссылка на кабинет заказчика</label>
                        <div className="text-[11px] font-bold text-slate-600 break-all mb-4 bg-white p-3 rounded-xl border border-indigo-100/50">
                           {`${window.location.origin}/login?role=customer&id=${encodeURIComponent(editingCustomer.name)}`}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/login?role=customer&id=${encodeURIComponent(editingCustomer.name)}`); alert('Копировано'); }} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Копировать</button>
                        </div>
                    </div>
                  </div>
                  <div className="mt-10 flex gap-4 shrink-0">
                    <button onClick={() => setEditingCustomer(null)} className="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Закрыть</button>
                  </div>
                </div>
              </div>
            )}
        </div>
    );
};
