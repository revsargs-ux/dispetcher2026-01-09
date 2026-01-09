
import React, { useState, useEffect, useMemo } from 'react';
import { Employee, Order, Dispatcher } from '../types';
import { dataService } from '../services/dataService';
import { HOURLY_RATE_CLIENT, HOURLY_RATE_WORKER } from '../constants';
import { PeriodSelector } from './Shared';
import { Reports } from './Reports';

export const Finance: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [activeTab, setActiveTab] = useState<'summary' | 'debtors' | 'reports'>('summary');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [oData, eData] = await Promise.all([dataService.getOrders(), dataService.getEmployees()]);
        setOrders(oData);
        setAllEmployees(eData);
    }

    useEffect(() => {
        if (selectedOrderId) {
            const ord = orders.find(o => o.id === selectedOrderId);
            if (ord) setEditingOrder(JSON.parse(JSON.stringify(ord)));
        } else {
            setEditingOrder(null);
        }
    }, [selectedOrderId, orders]);

    const stats = useMemo(() => {
        const filtered = orders.filter(o => {
            const d = o.datetime.split('T')[0];
            return d >= startDate && d <= endDate;
        });

        let income = 0;
        let expense = 0;
        let hours = 0;
        
        filtered.forEach(o => {
             if (o.status !== 'completed' && o.status !== 'active') return;
             o.assigned_employee_ids.forEach(eid => {
                 const detail = o.assignments_detail[eid];
                 const h = detail ? detail.hours : 0;
                 const payout = detail ? detail.payout : 0;
                 const clientRate = o.order_services[0]?.price_client || HOURLY_RATE_CLIENT;
                 income += h * clientRate;
                 expense += payout;
                 hours += h;
             });
        });

        return { income, expense, profit: income - expense, count: filtered.length, hours };
    }, [orders, startDate, endDate]);

    const handleServiceRateChange = (type: 'worker' | 'client', newVal: string) => {
        if (!editingOrder) return;
        const val = parseFloat(newVal);
        if (isNaN(val)) return;
        const updatedServices = [...editingOrder.order_services];
        if (updatedServices.length > 0) {
            updatedServices[0] = { ...updatedServices[0], [type === 'worker' ? 'price_worker' : 'price_client']: val };
        }
        const updatedAssignments = { ...editingOrder.assignments_detail };
        if (type === 'worker') {
            editingOrder.assigned_employee_ids.forEach(eid => {
                const current = updatedAssignments[eid];
                updatedAssignments[eid] = { ...current, payout: current.hours * val };
            });
        }
        setEditingOrder({ ...editingOrder, order_services: updatedServices, assignments_detail: updatedAssignments });
    };

    const handleWorkerRowChange = (empId: string, field: 'hours' | 'rate' | 'payout', newVal: string) => {
        if (!editingOrder) return;
        const val = parseFloat(newVal);
        if (isNaN(val) && newVal !== '') return;
        const safeVal = isNaN(val) ? 0 : val;
        const currentDetail = editingOrder.assignments_detail[empId];
        const currentServiceRate = editingOrder.order_services[0]?.price_worker || HOURLY_RATE_WORKER;
        let newDetail = { ...currentDetail };
        if (field === 'hours') {
            newDetail.hours = safeVal;
            newDetail.payout = safeVal * currentServiceRate;
        } else if (field === 'rate') {
            newDetail.payout = newDetail.hours * safeVal;
        } else if (field === 'payout') {
            newDetail.payout = safeVal;
        }
        setEditingOrder({ ...editingOrder, assignments_detail: { ...editingOrder.assignments_detail, [empId]: newDetail } });
    };

    const handlePaymentChange = (val: string) => {
        if (!editingOrder) return;
        setEditingOrder({ ...editingOrder, paid_amount: parseFloat(val) || 0 });
    }

    const saveOrderChanges = async () => {
        if (!editingOrder) return;
        const promises = editingOrder.assigned_employee_ids.map(eid => 
            dataService.updateOrderAssignmentDetail(editingOrder.id, eid, editingOrder.assignments_detail[eid])
        );
        await Promise.all(promises);
        
        const clientRate = editingOrder.order_services[0].price_client;
        const totalClientCost = editingOrder.assigned_employee_ids.reduce((sum, eid) => {
             const h = editingOrder.assignments_detail[eid].hours;
             return sum + h * clientRate;
        }, 0);
        editingOrder.total_client_cost = totalClientCost;
        editingOrder.payment_status = editingOrder.paid_amount >= totalClientCost && totalClientCost > 0 ? 'paid' : 'unpaid';

        const idx = orders.findIndex(o => o.id === editingOrder.id);
        if (idx !== -1) {
            const newOrders = [...orders];
            newOrders[idx] = editingOrder;
            setOrders(newOrders); 
        }
        alert('Изменения сохранены');
    };

    const debtors = useMemo(() => {
        const dMap: Record<string, { totalDebt: number, orders: Order[] }> = {};
        orders.forEach(o => {
            if (o.status !== 'completed' || o.payment_status === 'paid') return;
            const debt = Math.max(0, o.total_client_cost - (o.paid_amount || 0));
            if (debt > 1) {
                if (!dMap[o.client_name]) dMap[o.client_name] = { totalDebt: 0, orders: [] };
                dMap[o.client_name].totalDebt += debt;
                dMap[o.client_name].orders.push(o);
            }
        });
        return Object.entries(dMap).sort((a,b) => b[1].totalDebt - a[1].totalDebt).map(([client, data]) => ({ client, ...data }));
    }, [orders]);

    const handlePayDebt = async (client: string) => {
        const amount = parseFloat(paymentAmounts[client] || '0');
        if (amount <= 0) return alert('Введите сумму');
        await dataService.distributeClientPayment(client, amount);
        setPaymentAmounts(prev => ({...prev, [client]: ''}));
        loadData();
        alert(`Оплата ${amount}₽ успешно распределена по старым долгам клиента.`);
    }

    const getOrderEmployees = () => {
        if (!editingOrder) return [];
        return allEmployees.filter(e => editingOrder.assigned_employee_ids.includes(e.id));
    }

    return (
        <div className="p-6 max-w-full mx-auto h-full flex flex-col bg-[#0a0f18] text-slate-200">
            <div className="flex justify-between items-center mb-10 shrink-0">
                <div>
                   <h2 className="text-3xl font-black italic uppercase tracking-tighter">Финансовый Пульт</h2>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">Контроль маржинальности и дебиторской задолженности</p>
                </div>
                <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
                    {['summary', 'debtors', 'reports'].map(t => (
                        <button key={t} onClick={() => setActiveTab(t as any)} className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === t ? 'bg-cyan-600 text-white shadow-xl shadow-cyan-900/40' : 'text-slate-500 hover:text-white'}`}>
                            {t === 'summary' ? 'Сводка' : t === 'debtors' ? 'Должники' : 'Отчеты'}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'summary' && (
                <div className="flex flex-col h-full overflow-hidden gap-6">
                    <div className="bg-[#0f172a] p-8 rounded-[2.5rem] shadow-2xl border border-white/5 shrink-0">
                        <PeriodSelector startDate={startDate} endDate={endDate} onRangeChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mt-8">
                            <StatCard label="Объекты" value={stats.count} />
                            <StatCard label="Отработано" value={`${stats.hours.toFixed(0)} ч`} />
                            <StatCard label="Выручка" value={`${stats.income.toLocaleString()} ₽`} color="text-cyan-400" />
                            <StatCard label="ФОТ" value={`${stats.expense.toLocaleString()} ₽`} color="text-orange-400" />
                            <StatCard label="Прибыль" value={`${stats.profit.toLocaleString()} ₽`} color={stats.profit > 0 ? 'text-green-400' : 'text-slate-300'} />
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-[#0f172a] rounded-[2.5rem] shadow-2xl border border-white/5 flex flex-col overflow-hidden">
                            <div className="p-6 border-b border-white/5 bg-white/5 font-black text-slate-500 text-[10px] uppercase tracking-widest">Журнал Смен</div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                                {orders.filter(o => o.datetime >= startDate && o.datetime <= endDate).sort((a,b) => b.datetime.localeCompare(a.datetime)).map(o => (
                                    <div key={o.id} onClick={() => setSelectedOrderId(o.id)} className={`p-4 rounded-3xl border transition-all cursor-pointer ${selectedOrderId === o.id ? 'bg-cyan-600 border-cyan-400 text-white shadow-xl shadow-cyan-900/40' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                                        <div className="flex justify-between font-black text-xs gap-2 leading-tight uppercase italic">
                                            <span className="truncate">{o.address}</span>
                                            <span className="shrink-0 font-mono text-[10px] bg-black/20 px-1.5 rounded-lg border border-white/10">{o.confirmed_workers_count}/{o.required_workers}</span>
                                        </div>
                                        <div className="flex justify-between items-center mt-3">
                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${o.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {o.payment_status === 'paid' ? 'Оплачено' : 'Долг'}
                                            </span>
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{o.client_name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-[#0f172a] rounded-[2.5rem] shadow-2xl border border-white/5 flex flex-col overflow-hidden">
                            {!editingOrder ? (
                                <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                                    <div className="text-8xl mb-6 grayscale">📉</div>
                                    <p className="font-black uppercase tracking-[0.4em] text-[10px] text-slate-400">Выберите смену для детализации</p>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full animate-in slide-in-from-right duration-500">
                                    <div className="p-8 border-b border-white/5 bg-white/5 flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-4">
                                                <h3 className="font-black text-xl text-white italic tracking-tighter uppercase">{editingOrder.address}</h3>
                                                <div className="bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-xl">
                                                    <span className="text-cyan-400 font-mono font-bold text-xs">{editingOrder.confirmed_workers_count}/{editingOrder.required_workers}</span>
                                                </div>
                                            </div>
                                            <div className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mt-2">{editingOrder.client_name}</div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="text-right">
                                                <div className="text-[8px] uppercase font-black text-slate-500 mb-1 tracking-widest">Рабочий (₽/ч)</div>
                                                <input type="number" className="w-24 text-right bg-black/20 text-white font-black text-xs border border-white/5 rounded-xl px-3 py-2 outline-none focus:border-cyan-500/50" value={editingOrder.order_services[0]?.price_worker} onChange={e => handleServiceRateChange('worker', e.target.value)} />
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[8px] uppercase font-black text-slate-500 mb-1 tracking-widest">Клиент (₽/ч)</div>
                                                <input type="number" className="w-24 text-right bg-black/20 text-white font-black text-xs border border-white/5 rounded-xl px-3 py-2 outline-none focus:border-cyan-500/50" value={editingOrder.order_services[0]?.price_client} onChange={e => handleServiceRateChange('client', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                        <table className="w-full text-xs text-left">
                                            <thead className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">
                                                <tr>
                                                    <th className="pb-4">Сотрудник</th>
                                                    <th className="pb-4 text-center">Часы</th>
                                                    <th className="pb-4 text-right">К выплате</th>
                                                    <th className="pb-4 text-right">Счет</th>
                                                    <th className="pb-4 text-right">Маржа</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {getOrderEmployees().map(emp => {
                                                    const detail = editingOrder.assignments_detail[emp.id];
                                                    const clientRate = editingOrder.order_services[0].price_client;
                                                    return (
                                                        <tr key={emp.id} className="group hover:bg-white/5">
                                                            <td className="py-5 font-black text-slate-300 uppercase italic">{emp.full_name}</td>
                                                            <td className="py-5 text-center">
                                                                <input type="number" className="w-16 bg-transparent text-center font-black text-slate-400 outline-none border-b border-white/5 focus:border-cyan-400" value={detail.hours} onChange={e => handleWorkerRowChange(emp.id, 'hours', e.target.value)} />
                                                            </td>
                                                            <td className="py-5 text-right font-black text-orange-400">{Math.round(detail.payout).toLocaleString()} ₽</td>
                                                            <td className="py-5 text-right font-black text-cyan-400">{Math.round(detail.hours * clientRate).toLocaleString()} ₽</td>
                                                            <td className="py-5 text-right font-black text-green-400">{Math.round((detail.hours * clientRate) - detail.payout).toLocaleString()} ₽</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="p-8 bg-white/5 border-t border-white/5 flex justify-between items-center">
                                        <div className="flex gap-8">
                                            <div>
                                                <div className="text-[9px] uppercase font-black text-slate-500 mb-2 tracking-widest">Внесенная оплата</div>
                                                <input type="number" className="w-32 bg-black/40 text-green-400 font-black text-lg border border-white/5 rounded-2xl px-4 py-3 outline-none focus:border-green-500/50" value={editingOrder.paid_amount} onChange={e => handlePaymentChange(e.target.value)} />
                                            </div>
                                            <div>
                                                <div className="text-[9px] uppercase font-black text-slate-500 mb-2 tracking-widest">Текущий долг</div>
                                                <div className="text-2xl font-black text-red-500 italic tracking-tighter">
                                                    {Math.max(0, editingOrder.total_client_cost - editingOrder.paid_amount).toLocaleString()} ₽
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={saveOrderChanges} className="bg-cyan-600 hover:bg-cyan-500 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-cyan-900/20 transition-all active:scale-95">Сохранить</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'debtors' && (
                <div className="bg-[#0f172a] rounded-[3rem] shadow-2xl border border-white/5 overflow-hidden flex-1 flex flex-col animate-in fade-in duration-500">
                    <div className="p-8 border-b border-white/5 bg-white/5 flex justify-between items-center">
                         <div className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Реестр задолженностей (FIFO)</div>
                         <div className="text-[10px] font-black text-red-400 bg-red-400/10 px-4 py-2 rounded-xl border border-red-400/20 uppercase tracking-widest">
                            Всего к получению: {debtors.reduce((s,d)=>s+d.totalDebt, 0).toLocaleString()} ₽
                         </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-xs">
                            <thead className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 sticky top-0 bg-[#0f172a] z-10">
                                <tr>
                                    <th className="p-8">Контрагент</th>
                                    <th className="p-8 text-right">Общий долг</th>
                                    <th className="p-8 text-center">Прием платежа</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {debtors.map(d => (
                                    <tr key={d.client} className="hover:bg-white/5 group transition-colors">
                                        <td className="p-8">
                                            <div className="font-black text-xl text-white italic tracking-tighter">{d.client}</div>
                                            <div className="text-[10px] font-black text-slate-500 mt-1 uppercase tracking-widest">{d.orders.length} неоплаченных объектов</div>
                                        </td>
                                        <td className="p-8 text-right font-black text-red-400 text-2xl italic tracking-tighter">{d.totalDebt.toLocaleString()} ₽</td>
                                        <td className="p-8">
                                            <div className="flex justify-center items-center gap-4">
                                                <input type="number" placeholder="Сумма (₽)" className="w-40 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-right font-black text-white outline-none focus:border-green-500/50" value={paymentAmounts[d.client] || ''} onChange={e => setPaymentAmounts({...paymentAmounts, [d.client]: e.target.value})} />
                                                <button onClick={() => handlePayDebt(d.client)} className="bg-green-600 hover:bg-green-500 text-white w-14 h-14 rounded-2xl flex items-center justify-center font-black transition-all shadow-xl active:scale-95 shadow-green-900/20">✓</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {debtors.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="p-32 text-center text-slate-700 font-black uppercase text-2xl italic tracking-[0.4em] opacity-30">Долгов нет</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'reports' && <Reports />}
        </div>
    );
};

const StatCard = ({ label, value, color = 'text-slate-300' }: any) => (
    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 shadow-inner">
        <div className="text-[8px] text-slate-500 font-black uppercase mb-2 tracking-widest">{label}</div>
        <div className={`text-2xl font-black italic tracking-tighter ${color}`}>{value}</div>
    </div>
);
