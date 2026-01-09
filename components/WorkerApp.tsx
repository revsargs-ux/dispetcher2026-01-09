
import React, { useState, useEffect, useRef } from 'react';
import { Employee, Order, ChatMessage, Dispatcher } from '../types';
import { dataService } from '../services/dataService';
import { notificationService } from '../services/notificationService';
import { LiveSupport } from './LiveSupport';

type WorkerTab = 'cockpit' | 'chat' | 'reports';

export const WorkerApp: React.FC<{ 
    impersonatedWorkerId?: string, 
    onLogout?: () => void 
}> = ({ impersonatedWorkerId, onLogout }) => {
    const [currentWorker, setCurrentWorker] = useState<Employee | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isLiveSupportOpen, setIsLiveSupportOpen] = useState(false);
    
    const [activeTab, setActiveTab] = useState<WorkerTab>('cockpit');
    const [toast, setToast] = useState<{message: string, type: string} | null>(null);
    const [chatInput, setChatInput] = useState('');
    const [isEmergencyActive, setIsEmergencyActive] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const watchIdRef = useRef<number | null>(null);

    const initWorker = async () => {
        setIsLoading(true);
        const allEmps = await dataService.getEmployees();
        let target = allEmps.find(e => e.id === impersonatedWorkerId) || allEmps[0];
        if (target) {
            setCurrentWorker(target);
            notificationService.requestPermission().then(granted => {
                if (granted) notificationService.registerPush(target.id, 'worker');
            });
        }
        setIsLoading(false);
    };

    const refreshData = async () => {
        if (!currentWorker) return;
        const [ords, chats] = await Promise.all([
            dataService.getOrders(),
            dataService.getChats(currentWorker.id)
        ]);
        
        if (chats.length > chatMessages.length && chatMessages.length > 0) {
            const last = chats[chats.length-1];
            if (last.sender_id !== currentWorker.id) {
                setToast({ message: `Новое сообщение: ${last.text}`, type: 'info' });
            }
        }

        setOrders(ords);
        setChatMessages(chats);
        
        const emps = await dataService.getEmployees();
        const updated = emps.find(e => e.id === currentWorker.id);
        if (updated) {
            setCurrentWorker(updated);
            if (updated.emergency_status?.active && !isEmergencyActive) {
                setIsEmergencyActive(true);
            } else if (!updated.emergency_status?.active && isEmergencyActive) {
                setIsEmergencyActive(false);
            }
        }
    };

    useEffect(() => {
        const isTrackingNeeded = !!currentWorker;

        if (isTrackingNeeded && !watchIdRef.current) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    if (navigator.onLine) {
                        dataService.updateLocation(currentWorker!.id, latitude, longitude);
                    } else {
                        dataService.bufferLocation(currentWorker!.id, latitude, longitude);
                    }
                },
                (err) => console.warn('[GPS] Watch error:', err),
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        }

        return () => {
            if (watchIdRef.current) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };
    }, [currentWorker?.id]);

    useEffect(() => {
        initWorker();
        const handleToast = (e: any) => setToast(e.detail);
        window.addEventListener('app-notification', handleToast);
        return () => window.removeEventListener('app-notification', handleToast);
    }, [impersonatedWorkerId]);

    useEffect(() => {
        if (currentWorker) {
            refreshData();
            const interval = setInterval(refreshData, 8000);
            return () => clearInterval(interval);
        }
    }, [currentWorker?.id]);

    useEffect(() => {
        if (activeTab === 'chat') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [activeTab, chatMessages.length]);

    const handleAction = async (orderId: string, action: 'start' | 'finish') => {
        if (!currentWorker) return;
        if (action === 'start') {
            if (currentWorker.is_at_site) {
                setToast({ message: 'Сначала завершите текущую смену!', type: 'alert' });
                return;
            }
            await dataService.workerStartWork(currentWorker.id, orderId);
            setToast({ message: 'Смена запущена!', type: 'success' });
        } else {
            await dataService.workerFinishWork(currentWorker.id, orderId);
            setToast({ message: 'Смена завершена. Деньги зачислены.', type: 'success' });
            setSelectedOrder(null);
            setActiveTab('reports');
        }
        refreshData();
    };

    const handleConfirmAssignment = async (orderId: string) => {
        if (!currentWorker) return;
        await dataService.confirmAssignment(orderId, currentWorker.id);
        setToast({ message: 'Назначение подтверждено!', type: 'success' });
        refreshData();
    };

    const handleRejectAssignment = async (orderId: string) => {
        if (!currentWorker) return;
        if (confirm('Вы уверены, что хотите отклонить этот заказ?')) {
            await dataService.rejectAssignment(orderId, currentWorker.id);
            setToast({ message: 'Заказ отклонен', type: 'info' });
            refreshData();
        }
    };

    const handleClaimOrder = async (orderId: string) => {
        if (!currentWorker) return;
        try {
            await dataService.claimOrderWorker(orderId, currentWorker.id);
            setToast({ message: 'Заявка отправлена! Дождитесь подтверждения.', type: 'info' });
            setSelectedOrder(null);
            refreshData();
        } catch (e: any) {
            if (e.message === 'CONFLICT_TIME') {
                setToast({ message: 'Ошибка: У вас уже есть заказ на это время!', type: 'alert' });
            } else {
                setToast({ message: 'Не удалось взять заказ', type: 'alert' });
            }
        }
    };

    const handleSendChat = async () => {
        if (!currentWorker || !chatInput.trim()) return;
        await dataService.sendChatMessage({
            sender_id: currentWorker.id,
            recipient_id: 'd1',
            text: chatInput
        });
        setChatInput('');
        refreshData();
    };

    const handleTriggerSOS = async () => {
        if (!currentWorker) return;
        setIsEmergencyActive(true);
        navigator.geolocation.getCurrentPosition(async (pos) => {
            await dataService.triggerEmergency(currentWorker.id, pos.coords.latitude, pos.coords.longitude);
        }, () => {
            dataService.triggerEmergency(currentWorker.id);
        });
        setTimeout(() => {
            setToast({ message: 'СИГНАЛ SOS ОТПРАВЛЕН!', type: 'alert' });
        }, 500);
    };

    if (isLoading || !currentWorker) {
        return (
            <div className="min-h-screen bg-[#0a0f18] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const myUnconfirmedJobs = orders.filter(o => 
        o.assigned_employee_ids.includes(currentWorker.id) && 
        o.assignments_detail[currentWorker.id] &&
        !o.assignments_detail[currentWorker.id].is_confirmed
    );

    const myActiveJobs = orders.filter(o => 
        o.assigned_employee_ids.includes(currentWorker.id) && 
        o.assignments_detail[currentWorker.id]?.is_confirmed &&
        o.assignments_detail[currentWorker.id]?.actual_start && 
        !o.assignments_detail[currentWorker.id]?.actual_end
    );

    const myPlannedJobs = orders.filter(o => 
        o.assigned_employee_ids.includes(currentWorker.id) && 
        o.assignments_detail[currentWorker.id]?.is_confirmed &&
        !o.assignments_detail[currentWorker.id]?.actual_start
    );

    const marketJobs = orders.filter(o => 
        o.status === 'active' && 
        !o.assigned_employee_ids.includes(currentWorker.id) &&
        o.confirmed_workers_count < o.required_workers
    );

    const lastChatMessage = chatMessages[chatMessages.length - 1];

    return (
        <div className={`min-h-screen ${isEmergencyActive ? 'bg-red-600' : 'bg-[#0a0f18]'} font-sans text-slate-200 overflow-x-hidden flex flex-col transition-colors duration-500`}>
            
            {toast && (
                <div 
                    onClick={() => setToast(null)}
                    className="fixed top-12 left-4 right-4 z-[1000] bg-white text-slate-900 p-5 rounded-[2rem] shadow-2xl border-2 border-cyan-500 animate-in slide-in-from-top duration-500 flex items-center gap-4 cursor-pointer"
                >
                    <div className="text-2xl">{toast.type === 'alert' ? '🚨' : '🔔'}</div>
                    <div className="flex-1 font-black uppercase text-[11px] leading-tight">{toast.message}</div>
                    <div className="text-slate-300 font-black text-lg">✕</div>
                </div>
            )}

            <div className="p-6 bg-[#0f172a] border-b border-white/5 sticky top-0 z-[100] backdrop-blur-xl shrink-0">
                <div className="flex justify-between items-start mb-6">
                    <div onClick={() => setActiveTab('cockpit')} className="cursor-pointer">
                        <h1 className="text-3xl font-black italic text-cyan-400 tracking-tighter leading-none mb-1">Д.ПРО</h1>
                        <div className="text-[9px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            {currentWorker.full_name}
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                <span className="text-[7px] text-green-500 uppercase tracking-widest font-black">Tracking Active</span>
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleTriggerSOS} className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all active:scale-90 border-2 ${isEmergencyActive ? 'bg-white text-red-600 border-red-600 animate-ping' : 'bg-red-600 text-white border-red-500 animate-pulse'}`}>
                           <span className="text-2xl font-black">!</span>
                        </button>
                        <button onClick={() => setIsLiveSupportOpen(true)} className="w-14 h-14 bg-cyan-600 rounded-2xl flex items-center justify-center shadow-xl shadow-cyan-900/40 active:scale-90 border-2 border-cyan-500">
                           <span className="text-2xl">🎙️</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div onClick={() => setActiveTab('reports')} className="bg-white/5 p-4 rounded-3xl border border-white/5 flex flex-col justify-center cursor-pointer active:bg-white/10 transition-colors">
                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">К ВЫПЛАТЕ</div>
                        <div className="text-2xl font-black text-white italic">{(currentWorker.balance_owed || 0).toLocaleString()} ₽</div>
                    </div>
                    <div className="bg-white/5 p-4 rounded-3xl border border-white/5 flex flex-col justify-center">
                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">РЕЙТИНГ</div>
                        <div className="text-2xl font-black text-cyan-400 italic">{(currentWorker.rating || 0).toFixed(1)} ★</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-32">
                {activeTab === 'cockpit' && (
                    <div className="p-5 space-y-8 animate-in fade-in duration-500">
                        
                        {/* UNCONFIRMED ASSIGNMENTS SECTION */}
                        {myUnconfirmedJobs.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-2">
                                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                                    <h2 className="text-[10px] font-black text-orange-500 uppercase tracking-widest italic">ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ</h2>
                                </div>
                                {myUnconfirmedJobs.map(job => (
                                    <div key={job.id} className="bg-[#1e1b1a] p-6 rounded-[3rem] shadow-2xl border-2 border-orange-500/50 animate-pulse-slow">
                                        <div className="text-2xl font-black text-white italic mb-1 uppercase leading-tight">{job.address}</div>
                                        <div className="text-[9px] font-black text-orange-400 uppercase mb-6 tracking-widest italic">ВАС НАЗНАЧИЛ ДИСПЕТЧЕР</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button 
                                                onClick={() => handleConfirmAssignment(job.id)}
                                                className="bg-orange-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                                            >
                                                ПОДТВЕРДИТЬ
                                            </button>
                                            <button 
                                                onClick={() => handleRejectAssignment(job.id)}
                                                className="bg-white/5 text-slate-400 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
                                            >
                                                ОТКЛОНИТЬ
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {myActiveJobs.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                                    <h2 className="text-[10px] font-black text-green-500 uppercase tracking-widest">ТЕКУЩАЯ СМЕНА</h2>
                                </div>
                                {myActiveJobs.map(job => (
                                    <div key={job.id} className="bg-gradient-to-br from-green-600 to-green-800 p-6 rounded-[3rem] shadow-2xl border-2 border-green-400/30">
                                        <div className="text-2xl font-black text-white italic mb-2 uppercase leading-tight">{job.address}</div>
                                        <div className="text-[10px] font-black text-green-100 uppercase mb-6 tracking-widest">{job.client_name}</div>
                                        <button 
                                            onClick={() => handleAction(job.id, 'finish')}
                                            className="w-full bg-white text-green-700 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all"
                                        >
                                            ЗАВЕРШИТЬ РАБОТУ
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {lastChatMessage && (
                            <div 
                                onClick={() => setActiveTab('chat')}
                                className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden group active:bg-white/10 transition-all cursor-pointer"
                            >
                                <div className="absolute top-0 right-0 p-6 text-4xl opacity-5 grayscale">💬</div>
                                <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3">ПОСЛЕДНЕЕ ОТ ДИСПЕТЧЕРА</div>
                                <div className="text-sm font-bold text-slate-200 line-clamp-2 italic mb-4 leading-relaxed">
                                    "{lastChatMessage.text}"
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-[9px] font-black text-cyan-500 uppercase">{new Date(lastChatMessage.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                    <button className="text-white text-[9px] font-black uppercase tracking-widest bg-cyan-600/20 px-4 py-2 rounded-xl border border-cyan-500/30">ОТВЕТИТЬ</button>
                                </div>
                            </div>
                        )}

                        {myPlannedJobs.length > 0 && (
                            <div className="space-y-4">
                                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 italic">МОИ ЗАПЛАНИРОВАННЫЕ</h2>
                                {myPlannedJobs.map(job => (
                                    <div key={job.id} className="bg-[#0f172a] p-6 rounded-[2.5rem] border border-white/5 shadow-xl">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="text-lg font-black text-white italic uppercase">{job.address}</div>
                                            <div className="bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-xl text-[10px] font-black">ПЛАН</div>
                                        </div>
                                        <div className="text-[9px] font-black text-slate-500 uppercase mb-6">{new Date(job.datetime).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                                        <button 
                                            onClick={() => handleAction(job.id, 'start')}
                                            className="w-full bg-cyan-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"
                                        >
                                            НАЧАТЬ СМЕНУ
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-4">
                            <h2 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest ml-2 flex items-center gap-2 italic">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span> БИРЖА ЗАКАЗОВ
                            </h2>
                            {marketJobs.map(job => (
                                <div 
                                    key={job.id} 
                                    onClick={() => setSelectedOrder(job)}
                                    className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 shadow-lg active:scale-[0.98] transition-all"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-lg font-black text-white italic uppercase truncate w-2/3">{job.address}</div>
                                        <div className="text-lg font-black text-cyan-400 italic shrink-0">{(job.order_services[0]?.price_worker || 0)} ₽/ч</div>
                                    </div>
                                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-6">{job.client_name}</div>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-white/5 py-3 rounded-xl text-center text-[9px] font-black uppercase">
                                            {new Date(job.datetime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                        </div>
                                        <div className="flex-1 bg-white/5 py-3 rounded-xl text-center text-[9px] font-black uppercase">
                                            {job.required_workers - job.confirmed_workers_count} МЕСТ
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="flex flex-col h-[75vh] animate-in zoom-in duration-300">
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {chatMessages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 space-y-4">
                                    <div className="text-5xl">💬</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest">Нет сообщений</div>
                                </div>
                            )}
                            {chatMessages.map(msg => {
                                const isMe = msg.sender_id === currentWorker.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-4 rounded-[2rem] text-sm font-bold shadow-lg ${isMe ? 'bg-cyan-600 text-white rounded-br-none' : 'bg-white/10 text-slate-200 rounded-bl-none border border-white/5'}`}>
                                            {msg.text}
                                            <div className={`text-[8px] mt-2 font-black uppercase ${isMe ? 'text-cyan-200' : 'text-slate-500'}`}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="p-4 bg-[#0f172a] border-t border-white/5">
                            <div className="flex gap-2">
                                <input 
                                    className="flex-1 bg-white/5 border-none rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-cyan-500/30" 
                                    placeholder="Сообщение..." 
                                    value={chatInput} 
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                                />
                                <button onClick={handleSendChat} className="bg-cyan-600 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all">
                                    ✈️
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="p-8 space-y-10 animate-in slide-in-from-right duration-500">
                        <div className="bg-[#0f172a] p-10 rounded-[3rem] text-center border border-white/5 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10 opacity-5 text-9xl font-black italic pointer-events-none">BANK</div>
                            <div className="text-[10px] font-black text-cyan-400 uppercase mb-4 tracking-[0.4em] italic opacity-60">Доступно к выплате</div>
                            <div className="text-6xl font-black italic tracking-tighter text-white mb-2">{(currentWorker.balance_owed || 0).toLocaleString()} ₽</div>
                            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Обновлено только что</div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">ИСТОРИЯ ВЫПЛАТ</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                                    <div className="text-[8px] font-black text-slate-500 uppercase mb-1">Сегодня</div>
                                    <div className="text-xl font-black italic text-cyan-400">{(currentWorker.balance_today || 0).toLocaleString()} ₽</div>
                                </div>
                                <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                                    <div className="text-[8px] font-black text-slate-500 uppercase mb-1">За месяц</div>
                                    <div className="text-xl font-black italic text-white">{(currentWorker.balance_month || 0).toLocaleString()} ₽</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">ОБЩАЯ СТАТИСТИКА</h2>
                            <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 flex justify-between items-center">
                                <div>
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ОТРАБОТАНО ЧАСОВ</div>
                                    <div className="text-3xl font-black italic text-white">{(currentWorker.total_hours || 0)} ч.</div>
                                </div>
                                <div className="w-16 h-16 bg-cyan-600/10 rounded-2xl flex items-center justify-center text-3xl">⏱️</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="fixed bottom-6 left-6 right-6 z-[200]">
                <div className="bg-[#0f172a]/90 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-3 flex justify-around items-center shadow-2xl shadow-black/50">
                    <ActionButton icon="🏠" label="Главная" active={activeTab === 'cockpit'} onClick={() => setActiveTab('cockpit')} />
                    <ActionButton icon="💬" label="Чат" onClick={() => setActiveTab('chat')} active={activeTab === 'chat'} count={currentWorker.unread_count} />
                    <ActionButton icon="💰" label="Отчеты" onClick={() => setActiveTab('reports')} active={activeTab === 'reports'} />
                    <button 
                        onClick={onLogout}
                        className="w-12 h-12 flex items-center justify-center text-slate-500 text-xl hover:text-white transition-colors"
                    >🚪</button>
                </div>
            </div>

            {selectedOrder && (activeTab === 'cockpit') && (
                <div className="fixed inset-0 bg-black/95 z-[500] p-6 flex items-center justify-center animate-in fade-in duration-300">
                    <div className="bg-[#0f172a] rounded-[3.5rem] border border-white/10 w-full max-w-sm p-10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 text-9xl font-black text-white/5 italic select-none">JOB</div>
                        <h3 className="text-3xl font-black text-white italic uppercase leading-tight mb-2">{selectedOrder.address}</h3>
                        <p className="text-xs font-bold text-cyan-500 uppercase tracking-widest mb-10">{selectedOrder.client_name}</p>
                        
                        <div className="space-y-6 mb-12">
                            <div className="flex justify-between border-b border-white/5 pb-4">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ставка</span>
                                <span className="text-xl font-black text-white">{(selectedOrder.order_services[0]?.price_worker || 0)} ₽/час</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-4">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Старт</span>
                                <span className="text-sm font-bold text-slate-200">{new Date(selectedOrder.datetime).toLocaleString('ru-RU')}</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button 
                                onClick={() => handleClaimOrder(selectedOrder.id)}
                                className="w-full bg-cyan-600 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-all"
                            >
                                ОТКЛИКНУТЬСЯ
                            </button>
                            <button 
                                onClick={() => setSelectedOrder(null)}
                                className="w-full text-slate-500 py-4 font-black uppercase text-[10px] tracking-widest"
                            >
                                ЗАКРЫТЬ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isLiveSupportOpen && <LiveSupport workerName={currentWorker.full_name} onClose={() => setIsLiveSupportOpen(false)} />}
        </div>
    );
};

const ActionButton = ({ icon, label, active, onClick, count }: any) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-center gap-1 p-3 rounded-3xl transition-all relative ${active ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-500'}`}
    >
        <span className="text-2xl">{icon}</span>
        <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
        {count && count > 0 && (
            <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center animate-bounce">{count}</span>
        )}
    </button>
);
