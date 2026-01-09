
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Employee, ChatMessage, MessageStatus, Order } from '../types';
import { dataService } from '../services/dataService';
import { generateAIDraft } from '../services/aiService';

export const DispatcherChat: React.FC<{ currentDispatcherId: string }> = ({ currentDispatcherId }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [showMobileChat, setShowMobileChat] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const refreshData = async () => {
        const [empData, ordData] = await Promise.all([
            dataService.getEmployees(),
            dataService.getOrders()
        ]);
        setEmployees(empData);
        setOrders(ordData);
    };

    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedEmpId) {
            const fetchMsg = async () => {
                const chats = await dataService.getChats(selectedEmpId);
                const relevantMessages = chats.filter(c => 
                    (c.sender_id === currentDispatcherId && c.recipient_id === selectedEmpId) ||
                    (c.sender_id === selectedEmpId && c.recipient_id === currentDispatcherId)
                );
                setMessages(relevantMessages);
                
                const unreadMessagesFromWorker = relevantMessages.filter(c => c.recipient_id === currentDispatcherId && !c.is_read);
                if (unreadMessagesFromWorker.length > 0) {
                    await dataService.markMessagesAsRead(selectedEmpId, currentDispatcherId);
                    refreshData();
                }
            };
            fetchMsg();
            const interval = setInterval(fetchMsg, 2000);
            return () => clearInterval(interval);
        }
    }, [selectedEmpId, currentDispatcherId]);

    const handleSendMessage = async () => {
        if (!inputText.trim() || !selectedEmpId) return;
        await dataService.sendChatMessage({
            sender_id: currentDispatcherId,
            recipient_id: selectedEmpId,
            text: inputText
        });
        setInputText('');
        refreshData();
    };

    const handleAIDraft = async () => {
        if (!selectedEmpId) return;
        const emp = employees.find(e => e.id === selectedEmpId);
        if (!emp) return;
        
        setIsAiLoading(true);
        const draft = await generateAIDraft({
            workerName: emp.full_name,
            balance: emp.balance_owed,
            lastMessages: messages,
            currentOrder: contextOrder?.order
        });
        setInputText(draft || '');
        setIsAiLoading(false);
    };

    const handleSelectEmployee = (id: string) => {
        setSelectedEmpId(id);
        setShowMobileChat(true);
    };

    const selectedEmp = employees.find(e => e.id === selectedEmpId);
    
    const contextOrder = useMemo(() => {
        if (!selectedEmp) return null;
        const assigned = orders.find(o => o.assigned_employee_ids.includes(selectedEmp.id) && o.status === 'active');
        if (assigned) return { order: assigned, type: 'assignment' as const };
        if (selectedEmp.last_viewed_order_id) {
            const interested = orders.find(o => o.id === selectedEmp.last_viewed_order_id);
            if (interested) return { order: interested, type: 'interest' as const };
        }
        return null;
    }, [selectedEmp, orders]);

    const sortedEmployees = useMemo(() => {
        return [...employees].sort((a, b) => {
            const unreadA = (a.unread_count || 0) > 0;
            const unreadB = (b.unread_count || 0) > 0;
            if (unreadA !== unreadB) return unreadA ? -1 : 1;
            const timeA = a.last_message_time || '0';
            const timeB = b.last_message_time || '0';
            return timeB.localeCompare(timeA);
        });
    }, [employees]);

    const MessageStatusIcon = ({ status }: { status: MessageStatus }) => {
        if (status === 'sent') return <span className="text-gray-400 ml-1 text-[11px] font-bold">✓</span>;
        if (status === 'delivered') return <span className="text-gray-400 ml-1 text-[11px] font-bold">✓✓</span>;
        if (status === 'read') return <span className="text-blue-500 ml-1 text-[11px] font-bold">✓✓</span>;
        return null;
    };

    return (
        <div className="flex h-full bg-white border-t border-gray-200 overflow-hidden font-sans">
            <div className={`w-full lg:w-80 border-r border-gray-200 flex flex-col ${showMobileChat ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 border-b bg-gray-50 font-black text-gray-700 uppercase text-[10px] tracking-widest flex justify-between items-center">
                    <span>Сотрудники</span>
                    <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">ЧАТ</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                    {sortedEmployees.map(emp => (
                        <div 
                            key={emp.id} 
                            onClick={() => handleSelectEmployee(emp.id)}
                            className={`p-4 border-b cursor-pointer hover:bg-slate-50 transition-all flex items-center relative ${selectedEmpId === emp.id ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'}`}
                        >
                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mr-3 shrink-0 shadow-sm relative" style={{backgroundColor: emp.avatar_color || '#ccc'}}>
                                {emp.full_name.charAt(0)}
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${emp.is_online ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                {emp.unread_count && emp.unread_count > 0 && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                    <div className={`text-sm truncate ${emp.unread_count && emp.unread_count > 0 ? 'font-black text-gray-900' : 'font-semibold text-gray-700'}`}>
                                        {emp.full_name}
                                    </div>
                                    {emp.last_message_time && (
                                        <div className={`text-[10px] whitespace-nowrap ${emp.unread_count && emp.unread_count > 0 ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                                            {new Date(emp.last_message_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs flex justify-between items-center mt-1">
                                    <span className="truncate text-gray-400 font-bold">{emp.phone}</span>
                                    {emp.unread_count && emp.unread_count > 0 ? (
                                        <span className="bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm ml-2 min-w-[18px] text-center">
                                            {emp.unread_count}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className={`flex-1 flex flex-col bg-[#f0f2f5] ${showMobileChat ? 'flex' : 'hidden lg:flex'}`}>
                {!selectedEmp ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300 opacity-50">
                        <div className="text-9xl mb-4">💬</div>
                        <p className="font-black uppercase tracking-[0.2em] text-xs">Выберите чат для начала общения</p>
                    </div>
                ) : (
                    <>
                        <div className="p-3 lg:p-4 bg-white border-b shadow-sm flex items-center gap-3 sticky top-0 z-20">
                            <button onClick={() => setShowMobileChat(false)} className="lg:hidden text-gray-600 hover:bg-gray-100 p-2 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                </svg>
                            </button>
                            <div className="flex items-center flex-1">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-3 shadow-md border-2 border-white" style={{backgroundColor: selectedEmp.avatar_color || '#ccc'}}>
                                    {selectedEmp.full_name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm lg:text-base text-gray-800 leading-tight">{selectedEmp.full_name}</h3>
                                    <div className="flex items-center space-x-2">
                                        <span className={`w-1.5 h-1.5 rounded-full ${selectedEmp.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></span>
                                        <span className={`text-[9px] font-black uppercase tracking-wide ${selectedEmp.is_online ? 'text-green-600' : 'text-gray-400'}`}>
                                            {selectedEmp.is_online ? 'В сети' : 'Не в сети'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={handleAIDraft}
                                disabled={isAiLoading}
                                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all disabled:opacity-50"
                            >
                                {isAiLoading ? '🤖 Думаю...' : '🤖 ИИ-Черновик'}
                            </button>
                        </div>

                        {contextOrder && (
                            <div className={`p-4 flex justify-between items-center shadow-md animate-in slide-in-from-top duration-300 ${contextOrder.type === 'assignment' ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'}`}>
                                <div className="flex items-center space-x-4 overflow-hidden">
                                    <div className="bg-white/20 p-2 rounded-xl text-xl">
                                        {contextOrder.type === 'assignment' ? '👷' : '👀'}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-black uppercase tracking-widest opacity-90">
                                            {contextOrder.type === 'assignment' ? 'В работе на заказе' : 'Интересуется заказом'}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-sm font-black truncate">{contextOrder.order.address}</div>
                                            <div className="text-[10px] opacity-70">Баланс: {selectedEmp.balance_owed} ₽</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar flex flex-col">
                            {messages.map((msg) => {
                                const isMe = msg.sender_id === currentDispatcherId;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] lg:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm relative ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'}`}>
                                            <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                                            <div className={`text-[9px] mt-1.5 flex justify-end items-center font-medium ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                {isMe && <MessageStatusIcon status={msg.status} />}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="p-3 lg:p-4 bg-white border-t sticky bottom-0 z-20">
                            <div className="flex gap-2 max-w-4xl mx-auto items-end">
                                <textarea className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2 text-sm focus:outline-none resize-none max-h-32 focus:bg-white transition-colors" placeholder="Напишите сообщение..." value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} />
                                <button onClick={handleSendMessage} disabled={!inputText.trim()} className="bg-blue-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-blue-700 shadow-lg active:scale-95 disabled:opacity-50 transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
