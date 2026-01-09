
import React, { useState, useEffect, useMemo } from 'react';
import { Employee, Order } from '../types';
import { dataService } from '../services/dataService';
import { PeriodSelector } from './Shared';

export const Reports: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    
    // Filters
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Send Modal
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [sendMethod, setSendMethod] = useState<'email'|'messenger'>('email');
    const [emailInput, setEmailInput] = useState('');
    const [messengerInput, setMessengerInput] = useState('');

    useEffect(() => {
        Promise.all([dataService.getEmployees(), dataService.getOrders()]).then(([emps, ords]) => {
            setEmployees(emps);
            setOrders(ords);
        });
        // Set default range to current month
        const now = new Date();
        setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA'));
        setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA'));
    }, []);

    const reportData = useMemo(() => {
        if (selectedEmployeeIds.length === 0) return [];
        
        const start = new Date(startDate).getTime();
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        const endTs = end.getTime();

        const result: {
            emp: Employee,
            shifts: { date: string, client: string, hours: number, start: string, end: string, payout: number }[],
            totalPayout: number
        }[] = [];

        selectedEmployeeIds.forEach(empId => {
            const emp = employees.find(e => e.id === empId);
            if (!emp) return;
            
            const empShifts: any[] = [];
            let total = 0;

            orders.forEach(o => {
                const oDate = new Date(o.datetime).getTime();
                if (oDate >= start && oDate <= endTs && o.assigned_employee_ids.includes(empId)) {
                    const detail = o.assignments_detail[empId];
                    if (detail) {
                        empShifts.push({
                            date: o.datetime,
                            client: o.client_name,
                            hours: detail.hours,
                            start: detail.start_time,
                            end: detail.end_time,
                            payout: detail.payout
                        });
                        total += detail.payout;
                    }
                }
            });

            result.push({
                emp,
                shifts: empShifts,
                totalPayout: total
            });
        });
        return result;
    }, [orders, employees, selectedEmployeeIds, startDate, endDate]);

    const handlePrint = () => {
        window.print();
    };

    const handleSend = () => {
        alert(`Отчет отправлен через ${sendMethod === 'email' ? 'Email: ' + emailInput : 'Messenger: ' + messengerInput}`);
        setIsSendModalOpen(false);
    };

    const toggleEmpSelection = (id: string) => {
        if (selectedEmployeeIds.includes(id)) {
            setSelectedEmployeeIds(prev => prev.filter(x => x !== id));
        } else {
            setSelectedEmployeeIds(prev => [...prev, id]);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 print:hidden">
                <h2 className="text-xl font-bold text-gray-700">Фильтр отчетов</h2>
                <div className="space-x-2">
                    <button onClick={handlePrint} className="bg-gray-100 text-gray-700 px-4 py-2 rounded font-medium hover:bg-gray-200">Печать</button>
                    <button onClick={() => setIsSendModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700">Отправить</button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Период</label>
                        <PeriodSelector 
                            startDate={startDate}
                            endDate={endDate}
                            onRangeChange={(s, e) => { setStartDate(s); setEndDate(e); }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Сотрудники</label>
                        <div className="border rounded p-2 max-h-32 overflow-y-auto custom-scrollbar">
                             {employees.map(e => (
                                 <label key={e.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50 cursor-pointer">
                                     <input 
                                        type="checkbox" 
                                        checked={selectedEmployeeIds.includes(e.id)} 
                                        onChange={() => toggleEmpSelection(e.id)}
                                        className="rounded text-blue-600"
                                     />
                                     <span className="text-sm">{e.full_name}</span>
                                 </label>
                             ))}
                        </div>
                        <div className="text-right mt-1">
                            <button onClick={() => setSelectedEmployeeIds(employees.map(e => e.id))} className="text-xs text-blue-600 hover:underline mr-2">Выбрать всех</button>
                            <button onClick={() => setSelectedEmployeeIds([])} className="text-xs text-gray-500 hover:underline">Сбросить</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Report Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 overflow-y-auto custom-scrollbar print:shadow-none print:border-none">
                 {reportData.length === 0 ? (
                     <div className="flex items-center justify-center h-full text-gray-400">Выберите сотрудников и период для формирования отчета</div>
                 ) : (
                     <div className="p-8">
                         <h1 className="text-2xl font-bold mb-2 hidden print:block">Отчет по сотрудникам</h1>
                         <p className="text-sm text-gray-500 mb-8 hidden print:block">Период: {startDate} — {endDate}</p>

                         {reportData.map((data, idx) => (
                             <div key={data.emp.id} className={`mb-8 ${idx !== reportData.length - 1 ? 'border-b pb-8 print:break-after-auto' : ''}`}>
                                 <div className="flex justify-between items-end mb-4">
                                     <div>
                                         <h3 className="text-lg font-bold text-gray-900">{data.emp.full_name}</h3>
                                         <div className="text-sm text-gray-500">{data.emp.phone}</div>
                                     </div>
                                     <div className="text-right">
                                         <div className="text-xs text-gray-400 uppercase font-bold">Итого выплачено</div>
                                         <div className="text-xl font-bold text-green-600">{data.totalPayout} ₽</div>
                                     </div>
                                 </div>
                                 
                                 {data.shifts.length > 0 ? (
                                     <table className="w-full text-sm">
                                         <thead className="bg-gray-50 text-gray-500">
                                             <tr>
                                                 <th className="p-2 text-left">Дата</th>
                                                 <th className="p-2 text-left">Клиент</th>
                                                 <th className="p-2 text-center">Время</th>
                                                 <th className="p-2 text-right">Часы</th>
                                                 <th className="p-2 text-right">Сумма</th>
                                             </tr>
                                         </thead>
                                         <tbody className="divide-y divide-gray-100">
                                             {data.shifts.map((shift, i) => (
                                                 <tr key={i}>
                                                     <td className="p-2">{new Date(shift.date).toLocaleDateString()}</td>
                                                     <td className="p-2">{shift.client}</td>
                                                     <td className="p-2 text-center text-xs font-mono">{shift.start} - {shift.end}</td>
                                                     <td className="p-2 text-right">{shift.hours}</td>
                                                     <td className="p-2 text-right font-medium">{shift.payout} ₽</td>
                                                 </tr>
                                             ))}
                                         </tbody>
                                     </table>
                                 ) : (
                                     <div className="text-sm text-gray-400 italic">Нет смен за выбранный период</div>
                                 )}
                             </div>
                         ))}
                     </div>
                 )}
            </div>

            {/* Send Modal */}
            {isSendModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
                        <h3 className="text-lg font-bold mb-4">Отправить отчет</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Способ отправки</label>
                                <div className="flex space-x-4">
                                    <label className="flex items-center space-x-2">
                                        <input type="radio" checked={sendMethod === 'email'} onChange={() => setSendMethod('email')} />
                                        <span>Email</span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                        <input type="radio" checked={sendMethod === 'messenger'} onChange={() => setSendMethod('messenger')} />
                                        <span>Мессенджер</span>
                                    </label>
                                </div>
                            </div>
                            {sendMethod === 'email' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Email адрес</label>
                                    <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} className="w-full border rounded p-2 mt-1" placeholder="example@mail.com" />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Мессенджер</label>
                                    <select value={messengerInput} onChange={e => setMessengerInput(e.target.value)} className="w-full border rounded p-2 mt-1">
                                        <option value="">Выберите...</option>
                                        <option value="telegram">Telegram</option>
                                        <option value="whatsapp">WhatsApp</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button onClick={() => setIsSendModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Отмена</button>
                            <button onClick={handleSend} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Отправить</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
