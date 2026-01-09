
import React, { useState, useEffect, useMemo } from 'react';
import { dataService } from '../services/dataService';
import { Order, Employee, OrderAssignment } from '../types';
import { PeriodSelector, ExcelFilter, FilterState } from './Shared';
import { HOURLY_RATE_WORKER } from '../constants';

interface ShiftRow {
    id: string; // unique key orderId_workerId
    orderId: string;
    workerId: string;
    clientName: string;
    address: string;
    employeeName: string;
    avatarColor: string;
    scheduledTime: string;
    actualStart?: string;
    actualEnd?: string;
    hours: number;
    rate: number;
    payout: number;
    paymentStatus: 'paid' | 'unpaid';
    isCurrentlyWorking: boolean;
    isFuture: boolean;
}

type FilterConfigs = Record<string, FilterState>;
type ExportFormat = 'pdf' | 'excel' | 'word';

export const ActiveWorkers: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    
    // Filter & Sort States
    const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);
    const [filters, setFilters] = useState<FilterConfigs>({});
    const [sort, setSort] = useState<{ col: string, dir: 'asc' | 'desc' } | null>(null);
    
    // Modal states
    const [showDebtsModal, setShowDebtsModal] = useState(false);
    const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
    const [isSaving, setIsSaving] = useState(false);

    const refreshData = async () => {
        const [oData, eData] = await Promise.all([
            dataService.getOrders(),
            dataService.getEmployees()
        ]);
        setOrders(oData);
        setEmployees(eData);
        setLoading(false);
    };

    useEffect(() => {
        refreshData();
        const int = setInterval(refreshData, 5000);
        return () => clearInterval(int);
    }, []);

    const allShifts: ShiftRow[] = useMemo(() => {
        const rows: ShiftRow[] = [];
        // Added explicit type for the map to fix unknown property errors for full_name and avatar_color
        const empMap = new Map<string, Employee>(employees.map(e => [e.id, e]));
        const now = new Date();

        orders.forEach(order => {
            const orderDateStr = order.datetime.split('T')[0];
            if (orderDateStr < startDate || orderDateStr > endDate) return;

            const orderDate = new Date(order.datetime);
            const workerRate = order.order_services[0]?.price_worker || HOURLY_RATE_WORKER;

            order.assigned_employee_ids.forEach(workerId => {
                const emp = empMap.get(workerId);
                const detail = order.assignments_detail[workerId];
                if (!emp || !detail) return;

                const isCurrentlyWorking = !!(detail.actual_start && !detail.actual_end);
                const isFuture = !detail.actual_start && orderDate > now;

                let displayHours = detail.hours || 0;
                let displayPayout = detail.payout || 0;

                if (isCurrentlyWorking && detail.actual_start) {
                    const startTs = new Date(detail.actual_start).getTime();
                    const nowTs = new Date().getTime();
                    displayHours = Math.max(0, (nowTs - startTs) / (1000 * 60 * 60));
                    displayPayout = displayHours * workerRate;
                }

                rows.push({
                    id: `${order.id}_${workerId}`,
                    orderId: order.id,
                    workerId: workerId,
                    clientName: order.client_name,
                    address: order.address,
                    employeeName: emp.full_name,
                    avatarColor: emp.avatar_color || '#cbd5e1',
                    scheduledTime: order.datetime,
                    actualStart: detail.actual_start,
                    actualEnd: detail.actual_end,
                    hours: displayHours,
                    rate: workerRate,
                    payout: displayPayout,
                    paymentStatus: order.payment_status || 'unpaid',
                    isCurrentlyWorking,
                    isFuture
                });
            });
        });
        return rows;
    }, [orders, employees, startDate, endDate]);

    const filteredAndSortedShifts = useMemo(() => {
        let result = [...allShifts];

        Object.keys(filters).forEach(col => {
            const f = filters[col];
            if (f.selectedValues.size > 0) {
                result = result.filter(row => {
                    const val = String((row as any)[col]);
                    return f.selectedValues.has(val);
                });
            }
            if (f.valueSearch) {
                result = result.filter(row => 
                    String((row as any)[col]).toLowerCase().includes(f.valueSearch.toLowerCase())
                );
            }
        });

        if (sort) {
            result.sort((a, b) => {
                const valA = (a as any)[sort.col];
                const valB = (b as any)[sort.col];
                if (valA < valB) return sort.dir === 'asc' ? -1 : 1;
                if (valA > valB) return sort.dir === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            result.sort((a, b) => {
                if (a.isCurrentlyWorking && !b.isCurrentlyWorking) return -1;
                if (!a.isCurrentlyWorking && b.isCurrentlyWorking) return 1;
                return b.scheduledTime.localeCompare(a.scheduledTime);
            });
        }

        return result;
    }, [allShifts, filters, sort]);

    const getUniqueValues = (col: keyof ShiftRow) => {
        return Array.from(new Set(allShifts.map(s => String(s[col])))).sort();
    };

    const handleFilterChange = (col: string, state: FilterState) => {
        setFilters(prev => ({ ...prev, [col]: state }));
    };

    const formatTime = (isoString?: string) => {
        if (!isoString) return '--:--';
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleOpenFilter = (e: React.MouseEvent, col: string) => {
        e.stopPropagation();
        setActiveFilterCol(activeFilterCol === col ? null : col);
    };

    const handleExport = () => {
        if (exportFormat === 'pdf') {
            window.print();
        } else {
            alert(`Экспорт в формате ${exportFormat.toUpperCase()} запущен...`);
        }
    };

    const handleSaveDebts = async () => {
        setIsSaving(true);
        // Simulate an API call to save or process payroll
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsSaving(false);
        alert('Ведомость успешно сохранена в архиве выплат.');
    };

    const debtEmployees = useMemo(() => {
        return employees.filter(e => e.balance_owed > 0).sort((a,b) => b.balance_owed - a.balance_owed);
    }, [employees]);

    const totalOwed = useMemo(() => {
        return debtEmployees.reduce((acc, e) => acc + e.balance_owed, 0);
    }, [debtEmployees]);

    return (
        <div className="h-full flex flex-col bg-slate-50 font-sans">
            {/* Control Panel */}
            <div className="p-6 bg-white border-b shrink-0 shadow-sm z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h2 className="text-3xl font-black italic text-slate-900 uppercase tracking-tighter leading-none">Учет смен</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Финансовый мониторинг и контроль выхода персонала</p>
                    </div>
                    <div className="flex flex-col gap-2 w-full md:w-auto">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Период выборки</div>
                        <PeriodSelector 
                            startDate={startDate} 
                            endDate={endDate} 
                            onRangeChange={(s, e) => { setStartDate(s); setEndDate(e); }} 
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                    <StatBox label="Всего выходов" value={allShifts.length} icon="👨‍🔧" />
                    <StatBox label="В процессе" value={allShifts.filter(s => s.isCurrentlyWorking).length} icon="🟢" color="text-green-600" />
                    <StatBox label="Отработано (ч)" value={allShifts.reduce((acc, s) => acc + s.hours, 0).toFixed(1)} icon="⏱️" />
                    <StatBox 
                        label="ФОТ за период" 
                        value={`${allShifts.reduce((acc, s) => acc + s.payout, 0).toLocaleString()} ₽`} 
                        icon="💰" 
                        color="text-blue-600" 
                        onClick={() => setShowDebtsModal(true)}
                        clickable
                    />
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-hidden p-4 lg:p-6">
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 h-full flex flex-col overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar flex-1">
                        <table className="w-full text-left border-collapse min-w-[1100px]">
                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b sticky top-0 z-20">
                                <tr>
                                    <HeaderCell 
                                        label="Клиент и Объект" 
                                        col="clientName" 
                                        activeFilter={activeFilterCol} 
                                        onFilterClick={handleOpenFilter} 
                                        uniqueValues={getUniqueValues('clientName')}
                                        filterState={filters['clientName'] || { valueSearch: '', selectedValues: new Set(), rangeMin: '', rangeMax: '' }}
                                        onFilterChange={(s) => handleFilterChange('clientName', s)}
                                        onSort={(dir) => setSort({ col: 'clientName', dir })}
                                        className="w-[25%]"
                                    />
                                    <HeaderCell 
                                        label="Сотрудник" 
                                        col="employeeName" 
                                        activeFilter={activeFilterCol} 
                                        onFilterClick={handleOpenFilter} 
                                        uniqueValues={getUniqueValues('employeeName')}
                                        filterState={filters['employeeName'] || { valueSearch: '', selectedValues: new Set(), rangeMin: '', rangeMax: '' }}
                                        onFilterChange={(s) => handleFilterChange('employeeName', s)}
                                        onSort={(dir) => setSort({ col: 'employeeName', dir })}
                                        className="w-[20%]"
                                    />
                                    <th className="p-5 text-center w-[10%]">Начало</th>
                                    <th className="p-5 text-center w-[10%]">Конец</th>
                                    <HeaderCell 
                                        label="Часы" 
                                        col="hours" 
                                        activeFilter={activeFilterCol} 
                                        onFilterClick={handleOpenFilter} 
                                        uniqueValues={getUniqueValues('hours')}
                                        filterState={filters['hours'] || { valueSearch: '', selectedValues: new Set(), rangeMin: '', rangeMax: '' }}
                                        onFilterChange={(s) => handleFilterChange('hours', s)}
                                        onSort={(dir) => setSort({ col: 'hours', dir })}
                                        className="w-[8%] text-center"
                                        type="number"
                                    />
                                    <HeaderCell 
                                        label="Выплата" 
                                        col="payout" 
                                        activeFilter={activeFilterCol} 
                                        onFilterClick={handleOpenFilter} 
                                        uniqueValues={getUniqueValues('payout')}
                                        filterState={filters['payout'] || { valueSearch: '', selectedValues: new Set(), rangeMin: '', rangeMax: '' }}
                                        onFilterChange={(s) => handleFilterChange('payout', s)}
                                        onSort={(dir) => setSort({ col: 'payout', dir })}
                                        className="w-[12%] text-right"
                                        type="number"
                                    />
                                    <HeaderCell 
                                        label="Статус" 
                                        col="paymentStatus" 
                                        activeFilter={activeFilterCol} 
                                        onFilterClick={handleOpenFilter} 
                                        uniqueValues={getUniqueValues('paymentStatus')}
                                        filterState={filters['paymentStatus'] || { valueSearch: '', selectedValues: new Set(), rangeMin: '', rangeMax: '' }}
                                        onFilterChange={(s) => handleFilterChange('paymentStatus', s)}
                                        onSort={(dir) => setSort({ col: 'paymentStatus', dir })}
                                        className="w-[15%] text-center"
                                    />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredAndSortedShifts.map((shift) => (
                                    <tr key={shift.id} className={`group transition-all hover:bg-slate-50/80 ${shift.isCurrentlyWorking ? 'bg-green-50/20' : ''}`}>
                                        <td className="p-5 pl-8">
                                            <div className="font-black text-slate-900 text-xs truncate group-hover:text-blue-600 transition-colors" title={shift.clientName}>{shift.clientName}</div>
                                            <div className="text-[10px] font-bold text-slate-400 truncate mt-1" title={shift.address}>{shift.address}</div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-3">
                                                <div 
                                                    className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black text-white shrink-0 shadow-lg border-2 border-white"
                                                    style={{ backgroundColor: shift.avatarColor }}
                                                >
                                                    {shift.employeeName.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-slate-700 text-xs truncate">{shift.employeeName}</div>
                                                    {shift.isCurrentlyWorking && (
                                                        <div className="flex items-center gap-1.5 mt-1">
                                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                                                            <span className="text-[9px] font-black text-green-600 uppercase tracking-tighter italic">Live Tracking</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5 text-center">
                                            <div className="font-mono text-[11px] font-black text-slate-600 bg-slate-100 px-2 py-1 rounded-lg inline-block">
                                                {shift.actualStart ? formatTime(shift.actualStart) : formatTime(shift.scheduledTime)}
                                            </div>
                                            <div className="text-[8px] text-slate-400 uppercase font-black tracking-tighter mt-1">
                                                {shift.actualStart ? 'Факт' : 'План'}
                                            </div>
                                        </td>
                                        <td className="p-5 text-center">
                                            {shift.isCurrentlyWorking ? (
                                                <span className="text-[9px] font-black text-blue-600 uppercase italic animate-pulse tracking-widest bg-blue-50 px-2 py-1 rounded-lg">Online</span>
                                            ) : (
                                                <div className="font-mono text-[11px] font-black text-slate-600">
                                                    {shift.actualEnd ? formatTime(shift.actualEnd) : '--:--'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-5 text-center">
                                            <div className={`font-black text-xs italic ${shift.isCurrentlyWorking ? 'text-green-600' : 'text-slate-800'}`}>
                                                {shift.hours.toFixed(1)}
                                            </div>
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="font-black text-blue-600 text-sm">
                                                {Math.round(shift.payout).toLocaleString()} ₽
                                            </div>
                                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                                {shift.rate} ₽ / ч
                                            </div>
                                        </td>
                                        <td className="p-5 pr-8 text-center">
                                            <div className={`text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-sm inline-block ${
                                                shift.paymentStatus === 'paid' 
                                                    ? 'bg-green-100 text-green-700 border border-green-200' 
                                                    : 'bg-red-50 text-red-500 border border-red-100'
                                            }`}>
                                                {shift.paymentStatus === 'paid' ? 'Оплачено' : 'Долг клиента'}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Debts Modal */}
            {showDebtsModal && (
                <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
                        {/* Header matching screenshot */}
                        <div className="p-8 border-b flex justify-between items-center bg-blue-600 text-white shrink-0">
                            <div>
                                <h3 className="text-xl font-black uppercase italic tracking-tighter leading-none">ВЕДОМОСТЬ ЗАДОЛЖЕННОСТЕЙ ПЕРЕД ПЕРСОНАЛОМ</h3>
                                <p className="text-[10px] font-bold opacity-80 uppercase mt-2">СПИСОК СОТРУДНИКОВ К ВЫПЛАТЕ (ВСЕГО: {debtEmployees.length})</p>
                            </div>
                            <button onClick={() => setShowDebtsModal(false)} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center font-black transition-colors">✕</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b sticky top-0 z-10">
                                    <tr>
                                        <th className="p-6 pl-10">Сотрудник</th>
                                        <th className="p-6 text-center">Рейтинг</th>
                                        <th className="p-6 text-center">Часы (всего)</th>
                                        <th className="p-6 text-right pr-10">Сумма к выплате</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {debtEmployees.map(emp => (
                                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-6 pl-10">
                                                <div className="font-black text-slate-900 text-sm">{emp.full_name}</div>
                                                <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{emp.phone}</div>
                                            </td>
                                            <td className="p-6 text-center">
                                                <div className="font-black text-blue-600 italic text-sm">{emp.rating.toFixed(1)} ★</div>
                                            </td>
                                            <td className="p-6 text-center">
                                                <div className="font-black text-slate-500 text-sm">{emp.total_hours} ч.</div>
                                            </td>
                                            <td className="p-6 text-right pr-10">
                                                <div className="font-black text-red-600 text-xl italic tracking-tight">{emp.balance_owed.toLocaleString()} ₽</div>
                                            </td>
                                        </tr>
                                    ))}
                                    {debtEmployees.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-24 text-center text-slate-300 font-black uppercase tracking-widest italic opacity-50 text-xl">Задолженностей нет 🎉</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Updated Modal Footer */}
                        <div className="p-8 bg-slate-50 border-t flex flex-col md:flex-row justify-between items-center shrink-0 gap-6">
                            <div className="flex flex-col gap-1 w-full md:w-auto">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ОБЩИЙ ФОТ К ВЫПЛАТЕ</div>
                                <div className="text-3xl font-black text-slate-950 italic tracking-tighter leading-none">
                                    {totalOwed.toLocaleString()} ₽
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                                <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                                    {(['pdf', 'excel', 'word'] as ExportFormat[]).map(fmt => (
                                        <button 
                                            key={fmt}
                                            onClick={() => setExportFormat(fmt)}
                                            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${exportFormat === fmt ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {fmt}
                                        </button>
                                    ))}
                                </div>

                                <button 
                                    onClick={handleSaveDebts}
                                    disabled={isSaving}
                                    className="bg-white border-2 border-slate-200 text-slate-600 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-2"
                                >
                                    {isSaving ? (
                                        <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></span>
                                    ) : (
                                        <span>Сохранить</span>
                                    )}
                                </button>

                                <button 
                                    onClick={handleExport}
                                    className="bg-slate-950 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-3 group"
                                >
                                    <span>ПЕЧАТЬ ВЕДОМОСТИ</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white/50 group-hover:text-white transition-colors">
                                        <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-3.96a.75.75 0 111.08 1.04l-5.25 5.25a.75.75 0 01-1.08 0l-5.25-5.25a.75.75 0 111.08-1.04l3.96 3.96V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const HeaderCell = ({ 
    label, 
    col, 
    activeFilter, 
    onFilterClick, 
    uniqueValues, 
    filterState, 
    onFilterChange, 
    onSort, 
    className = "",
    type = 'text'
}: any) => (
    <th className={`p-5 relative ${className}`}>
        <div className="flex items-center gap-1 group cursor-pointer" onClick={(e) => onFilterClick(e, col)}>
            <span>{label}</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3 h-3 transition-colors ${activeFilter === col ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-500'}`}>
                <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.972.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
            </svg>
        </div>
        {activeFilter === col && (
            <div className="absolute top-full left-0 mt-1 z-[100]" onClick={e => e.stopPropagation()}>
                <ExcelFilter 
                    isOpen={true}
                    onClose={() => onFilterClick({ stopPropagation: () => {} } as any, col)}
                    columnType={type}
                    uniqueValues={uniqueValues}
                    filterState={filterState}
                    onFilterChange={onFilterChange}
                    onSort={onSort}
                />
            </div>
        )}
    </th>
);

const StatBox = ({ label, value, icon, color = 'text-slate-800', onClick, clickable = false }: { label: string, value: string | number, icon: string, color?: string, onClick?: () => void, clickable?: boolean }) => (
    <div 
        onClick={onClick}
        className={`bg-white p-5 rounded-3xl border border-slate-100 shadow-sm transition-all flex items-center gap-5 ${clickable ? 'cursor-pointer hover:shadow-md hover:border-blue-200 active:scale-95' : ''}`}
    >
        <div className="text-2xl bg-slate-50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner border border-slate-100">{icon}</div>
        <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
            <div className={`text-xl font-black italic tracking-tight ${color}`}>{value}</div>
        </div>
        {clickable && (
            <div className="ml-auto text-blue-500 opacity-30 group-hover:opacity-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
            </div>
        )}
    </div>
);
