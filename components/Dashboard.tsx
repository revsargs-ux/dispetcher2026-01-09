
import React, { useState, useEffect, useMemo } from 'react';
import { Employee, Order, LogEntry, Dispatcher, OrderAssignment } from '../types';
import { dataService } from '../services/dataService';
import { CustomDatePicker } from './Shared';
import { HOURLY_RATE_WORKER, MIN_HOURLY_RATE_CLIENT } from '../constants';
import { MonitoringMap } from './MonitoringMap';

export const Dashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [isListVisible, setIsListVisible] = useState(true);
  const [dashboardView, setDashboardView] = useState<'list' | 'map'>('list');
  
  const [searchEmp, setSearchEmp] = useState('');
  const [minRating, setMinRating] = useState<number>(0);
  const [minHours, setMinHours] = useState<number>(0);
  
  const [modalSortField, setModalSortField] = useState<'rating' | 'hours'>('rating');
  const [modalSortDir, setModalSortDir] = useState<'asc' | 'desc'>('desc');

  const currentDispatcherId = localStorage.getItem('current_dispatcher_id') || 'd1';

  useEffect(() => {
    loadData();
    const int = setInterval(loadData, 5000);
    return () => clearInterval(int);
  }, []);

  const loadData = async () => {
    const [ordersData, employeesData] = await Promise.all([
      dataService.getOrders(),
      dataService.getEmployees()
    ]);
    setOrders(ordersData);
    setEmployees(employeesData);
  };

  const handleResolveSOS = async (workerId: string) => {
      if (confirm("Вы подтверждаете, что ситуация разрешена?")) {
          await dataService.resolveEmergency(workerId);
          loadData();
      }
  };

  const activeEmergencies = useMemo(() => {
      return employees.filter(e => e.emergency_status?.active);
  }, [employees]);

  const handleClaimOrder = async (orderId: string) => {
      await dataService.claimOrder(orderId, currentDispatcherId);
      loadData();
      setSelectedOrderId(orderId);
  };

  const handleAssignWorker = async (empId: string) => {
      if (selectedOrderId) {
          await dataService.assignWorkerToOrder(selectedOrderId, empId);
          loadData();
      }
  };

  const handleModalSortToggle = (field: 'rating' | 'hours') => {
    if (modalSortField === field) {
        setModalSortDir(modalSortDir === 'asc' ? 'desc' : 'asc');
    } else {
        setModalSortField(field);
        setModalSortDir('desc');
    }
  };

  const activeOrder = orders.find(o => o.id === selectedOrderId);
  const allDateOrders = orders.filter(o => o.datetime.startsWith(viewDate));
  const unassignedGlobalOrders = orders.filter(o => !o.claimed_by);
  const myOrders = allDateOrders.filter(o => o.claimed_by === currentDispatcherId);

  const filteredEmployees = useMemo(() => {
    return employees
      .filter(e => {
        const notAssigned = !activeOrder?.assigned_employee_ids.includes(e.id);
        const matchesSearch = e.full_name.toLowerCase().includes(searchEmp.toLowerCase()) || e.phone.includes(searchEmp);
        const matchesRating = e.rating >= minRating;
        const matchesHours = (e.total_hours || 0) >= minHours;
        return notAssigned && matchesSearch && matchesRating && matchesHours;
      })
      .sort((a, b) => {
        const valA = modalSortField === 'rating' ? a.rating : (a.total_hours || 0);
        const valB = modalSortField === 'rating' ? b.rating : (b.total_hours || 0);
        if (modalSortDir === 'asc') return valA - valB;
        return valB - valA;
      });
  }, [employees, activeOrder, searchEmp, minRating, minHours, modalSortField, modalSortDir]);

  return (
    <div className="flex h-full bg-slate-50 font-sans overflow-hidden relative">
      
      {activeEmergencies.length > 0 && (
          <div className="absolute top-0 left-0 right-0 z-[100] bg-red-600 text-white p-4 flex justify-between items-center animate-pulse shadow-2xl shadow-red-500/50">
              <div className="flex items-center gap-4">
                  <span className="text-2xl">🚨</span>
                  <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Критическая ситуация</div>
                      <div className="text-sm font-black uppercase italic">
                          SOS от {activeEmergencies.map(e => e.full_name).join(', ')}
                      </div>
                  </div>
              </div>
              <div className="flex gap-3">
                  {activeEmergencies.map(e => (
                      <button 
                        key={e.id}
                        onClick={() => handleResolveSOS(e.id)}
                        className="bg-white text-red-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                      >
                        СНЯТЬ ТРЕВОГУ ({e.full_name.split(' ')[0]})
                      </button>
                  ))}
              </div>
          </div>
      )}

      <div className={`relative h-full border-r border-slate-200 bg-white flex flex-col shrink-0 shadow-2xl transition-all duration-500 z-40 ${isListVisible ? 'w-80' : 'w-0 overflow-hidden opacity-0'}`}>
        <div className="p-4 border-b bg-slate-50/50 flex flex-col shrink-0">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Смена и Очередь</h2>
             <button onClick={() => setIsListVisible(false)} className="p-2 rounded-xl bg-slate-200 text-slate-600 hover:bg-slate-300 transition-all">✕</button>
          </div>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setShowCreateOrderModal(true)} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all">+ ЗАКАЗ</button>
            <button onClick={() => setShowAddCustomerModal(true)} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">+ ЗАКАЗЧИК</button>
          </div>
          <CustomDatePicker value={viewDate} onChange={setViewDate} />
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar">
            {unassignedGlobalOrders.length > 0 && (
              <div className="space-y-2">
                  <div className="text-[9px] font-black uppercase text-orange-500 tracking-[0.2em] px-1 italic flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping"></span> Глобальные заявки
                  </div>
                  {unassignedGlobalOrders.map(o => (
                      <div key={o.id} className={`p-4 bg-orange-50/40 border border-orange-100 rounded-2xl cursor-pointer hover:bg-orange-50 transition-all ${selectedOrderId === o.id ? 'ring-2 ring-orange-500' : ''}`} onClick={() => setSelectedOrderId(o.id)}>
                          <div className="font-black text-xs uppercase italic truncate" title={o.address}>{o.address}</div>
                          <div className="mt-3 flex justify-between items-center">
                            <span className="text-[8px] font-black text-slate-400 uppercase truncate max-w-[100px]">{o.client_name}</span>
                            <button onClick={(e) => { e.stopPropagation(); handleClaimOrder(o.id); }} className="bg-orange-500 text-white px-3 py-1.5 rounded-xl text-[8px] font-black uppercase shadow-sm active:scale-95 transition-all">Взять в работу</button>
                          </div>
                      </div>
                  ))}
              </div>
            )}

            <div className="space-y-2">
                <div className="text-[9px] font-black uppercase text-blue-500 tracking-[0.2em] px-1 italic">Мой план на {viewDate}</div>
                {myOrders.map(order => (
                    <div key={order.id} onClick={() => setSelectedOrderId(order.id)} className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedOrderId === order.id ? 'bg-blue-600 text-white border-blue-700 shadow-xl' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                        <div className="flex justify-between items-start">
                            <div className="font-black text-xs uppercase italic truncate max-w-[150px]">{order.address}</div>
                            {(Object.values(order.assignments_detail) as OrderAssignment[]).some(a => !!a.actual_start && !a.actual_end) && (
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                            )}
                        </div>
                        <div className={`text-[8px] font-black uppercase mt-2 ${selectedOrderId === order.id ? 'text-blue-100' : 'text-slate-400'} tracking-widest`}>{order.client_name}</div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {!isListVisible && (
        <button onClick={() => setIsListVisible(true)} className="absolute left-0 top-1/2 -translate-y-1/2 z-[100] bg-slate-900 text-white px-3 py-10 rounded-r-[2rem] shadow-2xl hover:bg-blue-600 transition-all italic font-black uppercase text-[10px] tracking-[0.4em] rotate-180 [writing-mode:vertical-lr]">ОТКРИТЬ СПИСОК</button>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        <div className="absolute top-8 right-8 z-50 flex bg-white/80 backdrop-blur-md p-1 rounded-2xl border border-slate-200 shadow-xl">
            <button 
                onClick={() => setDashboardView('list')} 
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dashboardView === 'list' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-blue-600'}`}
            >
                Список
            </button>
            <button 
                onClick={() => setDashboardView('map')} 
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dashboardView === 'map' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-blue-600'}`}
            >
                Карта
            </button>
        </div>

        {dashboardView === 'map' ? (
            <div className="flex-1 p-8">
                 <div className="w-full h-full bg-white rounded-[3.5rem] shadow-2xl border-8 border-white overflow-hidden relative">
                    <MonitoringMap employees={employees} orders={orders} />
                 </div>
            </div>
        ) : !activeOrder ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center p-10">
            <div className="text-9xl mb-6">🔍</div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Заявка не выбрана</h3>
            <p className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-400 mt-2">Выберите новую заявку из глобальной очереди или своего плана</p>
          </div>
        ) : (
          <>
            <div className="p-8 bg-white border-b shadow-sm shrink-0">
              <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 truncate leading-tight uppercase italic tracking-tighter mb-2">{activeOrder.address}</h2>
                    <div className="flex items-center gap-4">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] italic">{activeOrder.client_name}</div>
                        {!activeOrder.claimed_by && <span className="bg-orange-100 text-orange-600 text-[8px] font-black px-2 py-0.5 rounded-lg border border-orange-200">НОВАЯ ЗАЯВКА ОТ КЛИЕНТА</span>}
                    </div>
                </div>
                {!activeOrder.claimed_by ? (
                   <button onClick={() => handleClaimOrder(activeOrder.id)} className="bg-blue-600 text-white px-10 py-5 rounded-3xl text-sm font-black uppercase shadow-xl hover:bg-blue-700 transition-all active:scale-95">ПРИНЯТЬ ЗАЯВКУ</button>
                ) : (
                   <div className="flex gap-3">
                      <div className="bg-slate-100 px-6 py-4 rounded-2xl flex flex-col items-center justify-center">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Статус мест</span>
                          <span className="text-lg font-black text-blue-600 italic leading-none">{activeOrder.confirmed_workers_count}/{activeOrder.required_workers}</span>
                      </div>
                   </div>
                )}
              </div>
            </div>

            <div className="flex-1 p-8 overflow-hidden bg-slate-50 flex flex-col">
                <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col h-full relative">
                  {!activeOrder.claimed_by && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
                          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 text-center max-w-sm">
                              <div className="text-4xl mb-4">🔓</div>
                              <h4 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 mb-2">Заявка в общем доступе</h4>
                              <p className="text-xs text-slate-400 font-bold uppercase leading-relaxed mb-8">Для назначения людей сначала примите заявку в работу за собой</p>
                              <button onClick={() => handleClaimOrder(activeOrder.id)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">ВЗЯТЬ ЗАЯВКУ</button>
                          </div>
                      </div>
                  )}
                  <div className="flex-1 overflow-auto custom-scrollbar">
                      <table className="w-full text-left text-sm border-collapse">
                          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b sticky top-0 z-10">
                          <tr>
                              <th className="p-6 pl-12 w-[40%]">Сотрудник</th>
                              <th className="p-6 text-center">Статус</th>
                              <th className="p-6 text-center">Геолокация</th>
                              <th className="p-6 pr-12 text-right">Действие</th>
                          </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                          {employees.filter(e => activeOrder.assigned_employee_ids.includes(e.id)).map(emp => {
                              const detail = activeOrder.assignments_detail[emp.id];
                              const isConfirmed = detail?.is_confirmed;
                              const isWorking = detail?.actual_start && !detail?.actual_end;
                              const isSOS = emp.emergency_status?.active;
                              return (
                                <tr key={emp.id} className={`hover:bg-slate-50 transition-colors group ${isSOS ? 'bg-red-50' : ''}`}>
                                    <td className="p-6 pl-12">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-xs shadow-lg ${isSOS ? 'animate-pulse bg-red-600' : ''}`} style={{ backgroundColor: isSOS ? undefined : emp.avatar_color }}>
                                              {isSOS ? '!' : emp.full_name.charAt(0)}
                                            </div>
                                            <div>
                                              <div className="font-black text-slate-800 text-sm truncate uppercase italic">{emp.full_name}</div>
                                              {!isConfirmed && <div className="text-[8px] font-black text-orange-500 uppercase italic">ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ</div>}
                                              {isSOS && <div className="text-[8px] font-black text-red-600 uppercase">🚨 СИГНАЛ SOS</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6 text-center">
                                         <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border ${
                                             isSOS ? 'bg-red-600 text-white border-red-700' : 
                                             !isConfirmed ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                             isWorking ? 'bg-green-50 text-green-600 border-green-100' : 
                                             'bg-blue-50 text-blue-500 border-blue-100'}`}>
                                            {isSOS ? 'SOS' : !isConfirmed ? 'Новый' : isWorking ? 'На объекте' : 'Назначен'}
                                         </span>
                                    </td>
                                    <td className="p-6 text-center">
                                        {(emp.lat && emp.lng) ? (
                                            <div className="flex flex-col items-center">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`w-1.5 h-1.5 rounded-full animate-ping ${isSOS ? 'bg-red-600' : 'bg-green-500'}`}></span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">{isSOS ? 'CRITICAL POSITION' : 'Live Tracking'}</span>
                                                </div>
                                                <div className={`text-[8px] font-mono mt-1 ${isSOS ? 'text-red-600' : 'text-blue-500'}`}>{emp.lat?.toFixed(4)}, {emp.lng?.toFixed(4)}</div>
                                            </div>
                                        ) : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="p-6 pr-12 text-right">
                                        {isSOS ? (
                                          <button onClick={() => handleResolveSOS(emp.id)} className="bg-red-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-90">Снять SOS</button>
                                        ) : (
                                          <button onClick={() => dataService.rejectAssignment(activeOrder.id, emp.id).then(loadData)} className="text-red-500 text-[10px] font-black uppercase tracking-widest hover:underline active:scale-90 transition-all">Снять</button>
                                        )}
                                    </td>
                                </tr>
                              );
                          })}
                          </tbody>
                      </table>
                  </div>
                  <div className="p-6 bg-slate-50 border-t flex justify-center">
                      <button onClick={() => setShowAssignModal(true)} className="bg-blue-600 text-white px-12 py-4 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-500/20 active:scale-95 transition-all">+ Назначить сотрудника</button>
                  </div>
                </div>
            </div>
          </>
        )}
      </div>

      {showAssignModal && (
          <div className="fixed inset-0 bg-slate-900/90 z-[500] flex items-center justify-center backdrop-blur-md p-4">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
                  <div className="p-8 border-b bg-blue-600 text-white flex justify-between items-center shrink-0">
                      <h3 className="font-black uppercase text-xs tracking-[0.2em] italic">Выбор персонала для объекта</h3>
                      <button onClick={() => setShowAssignModal(false)} className="bg-white/10 hover:bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center font-black transition-colors">✕</button>
                  </div>
                  
                  <div className="p-6 border-b bg-slate-50 space-y-4 shrink-0">
                      <input 
                        className="w-full bg-white border-2 border-slate-100 rounded-2xl px-8 py-4 text-sm font-bold outline-none focus:border-blue-600 shadow-inner transition-all" 
                        placeholder="Поиск по ФИО или телефону..." 
                        value={searchEmp} 
                        onChange={e => setSearchEmp(e.target.value)} 
                      />
                      <div className="flex gap-4">
                          <div className="flex-1 relative">
                            <label className="absolute -top-2.5 left-4 bg-slate-50 px-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Мин. рейтинг ⭐</label>
                            <select 
                                className="w-full bg-white border-2 border-slate-100 rounded-xl px-6 py-2.5 text-xs font-black text-blue-600 outline-none focus:border-blue-600 shadow-sm"
                                value={minRating}
                                onChange={e => setMinRating(Number(e.target.value))}
                            >
                                <option value={0}>Любой рейтинг</option>
                                <option value={3}>От 3.0 ★</option>
                                <option value={4}>От 4.0 ★</option>
                                <option value={4.5}>От 4.5 ★</option>
                                <option value={4.8}>От 4.8 ★</option>
                            </select>
                          </div>
                          <div className="flex-1 relative">
                            <label className="absolute -top-2.5 left-4 bg-slate-50 px-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Мин. часов ⏱️</label>
                            <select 
                                className="w-full bg-white border-2 border-slate-100 rounded-xl px-6 py-2.5 text-xs font-black text-slate-600 outline-none focus:border-blue-600 shadow-sm"
                                value={minHours}
                                onChange={e => setMinHours(Number(e.target.value))}
                            >
                                <option value={0}>Любой опыт</option>
                                <option value={10}>От 10 ч.</option>
                                <option value={50}>От 50 ч.</option>
                                <option value={100}>От 100 ч.</option>
                                <option value={500}>От 500 ч.</option>
                            </select>
                          </div>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b sticky top-0 z-10">
                            <tr>
                                <th className="p-6 pl-10">Сотрудник</th>
                                <th 
                                    className={`p-6 text-center cursor-pointer transition-colors hover:bg-slate-100 ${modalSortField === 'rating' ? 'text-blue-600' : ''}`}
                                    onClick={() => handleModalSortToggle('rating')}
                                >
                                    Оценка {modalSortField === 'rating' ? (modalSortDir === 'asc' ? '↑' : '↓') : '↕'}
                                </th>
                                <th 
                                    className={`p-6 text-center cursor-pointer transition-colors hover:bg-slate-100 ${modalSortField === 'hours' ? 'text-blue-600' : ''}`}
                                    onClick={() => handleModalSortToggle('hours')}
                                >
                                    Часы {modalSortField === 'hours' ? (modalSortDir === 'asc' ? '↑' : '↓') : '↕'}
                                </th>
                                <th className="p-6 text-right pr-10">Действие</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredEmployees.map(emp => (
                                <tr key={emp.id} className="hover:bg-slate-50 transition-all group">
                                    <td className="p-6 pl-10">
                                        <div className="font-black text-slate-800 uppercase italic tracking-tighter">{emp.full_name}</div>
                                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{emp.phone}</div>
                                    </td>
                                    <td className={`p-6 text-center font-black text-sm italic ${modalSortField === 'rating' ? 'text-blue-600' : 'text-slate-400'}`}>{emp.rating.toFixed(1)} ★</td>
                                    <td className={`p-6 text-center font-black text-sm italic ${modalSortField === 'hours' ? 'text-blue-600' : 'text-slate-500'}`}>{emp.total_hours || 0} ч.</td>
                                    <td className="p-6 text-right pr-10">
                                        <button 
                                            onClick={() => handleAssignWorker(emp.id)} 
                                            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                                        >
                                            Назначить
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
