
import React, { useState, useEffect } from 'react';
import { Employee, EmployeeReview } from '../types';
import { dataService } from '../services/dataService';

type SortField = 'rating' | 'total_hours' | null;
type SortDirection = 'asc' | 'desc';

export const Employees: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [editingEmp, setEditingEmp] = useState<Partial<Employee>>({});

    const [sortField, setSortField] = useState<SortField>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const [invitePhone, setInvitePhone] = useState('');
    const [generatedLink, setGeneratedLink] = useState('');
    const [inviteMethod, setInviteMethod] = useState<'Telegram' | 'WhatsApp' | 'SMS'>('Telegram');

    // Review form state
    const [newReviewRating, setNewReviewRating] = useState(5);
    const [newReviewComment, setNewReviewComment] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    useEffect(() => {
        loadEmployees();
        const int = setInterval(loadEmployees, 5000);
        return () => clearInterval(int);
    }, []);

    const loadEmployees = async () => {
        const data = await dataService.getEmployees();
        setEmployees(data);
    };

    const handleSave = async () => {
        if (!editingEmp.full_name || !editingEmp.phone) {
            alert("ФИО и телефон обязательны");
            return;
        }
        try {
            if (editingEmp.id) {
                await dataService.updateEmployee(editingEmp.id, editingEmp);
            } else {
                await dataService.createEmployee(editingEmp);
            }
            setIsModalOpen(false);
            loadEmployees();
        } catch (e) {
            alert('Ошибка сохранения');
        }
    };

    const handleSubmitReview = async () => {
        if (!editingEmp.id || !newReviewComment.trim()) return;
        
        setIsSubmittingReview(true);
        try {
            await dataService.addEmployeeReview(editingEmp.id, {
                author_name: 'Администратор',
                rating: newReviewRating,
                comment: newReviewComment
            });
            setNewReviewComment('');
            setNewReviewRating(5);
            // Reload the local editingEmp to show new review
            const updatedEmps = await dataService.getEmployees();
            setEmployees(updatedEmps);
            const current = updatedEmps.find(e => e.id === editingEmp.id);
            if (current) setEditingEmp(current);
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const generateInvite = () => {
        if (!invitePhone.match(/^\+?[1-9]\d{1,14}$/)) {
            alert('Введите корректный номер телефона');
            return;
        }
        const code = Math.random().toString(36).substr(2, 6).toUpperCase();
        const link = `${window.location.origin}/login?role=worker&id=${code}`;
        setGeneratedLink(link);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Ссылка скопирована!');
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            if (sortDirection === 'desc') setSortDirection('asc');
            else { setSortField(null); setSortDirection('desc'); }
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const getSortedEmployees = () => {
        let sorted = [...employees];
        sorted.sort((a, b) => {
            const isAActive = a.is_at_site ? 1 : 0;
            const isBActive = b.is_at_site ? 1 : 0;
            if (isAActive !== isBActive) return isBActive - isAActive;
            if (sortField) {
                const valA = a[sortField] || 0;
                const valB = b[sortField] || 0;
                if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            }
            return 0;
        });
        return sorted;
    };

    const getCabinetLink = (id: string) => `${window.location.origin}/login?role=worker&id=${id}`;

    return (
        <div className="p-10 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-end mb-10">
                <div>
                    <h2 className="text-4xl font-black italic text-slate-900 uppercase tracking-tighter leading-none">БАЗА ПЕРСОНАЛА</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Реестр проверенных исполнителей</p>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setIsInviteModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center gap-3"
                    >
                        <span>📢</span> ПРИГЛАСИТЬ
                    </button>
                    <button 
                        onClick={() => { setEditingEmp({}); setIsModalOpen(true); }}
                        className="bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95"
                    >
                        + ДОБАВИТЬ В РЕЕСТР
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                        <tr>
                            <th className="px-8 py-5 text-left">ФИО / Контакты</th>
                            <th className="px-8 py-5 text-center cursor-pointer hover:text-blue-600" onClick={() => handleSort('rating')}>Рейтинг {sortField === 'rating' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                            <th className="px-8 py-5 text-center cursor-pointer hover:text-blue-600" onClick={() => handleSort('total_hours')}>Часы {sortField === 'total_hours' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                            <th className="px-8 py-5 text-center">Выплаты</th>
                            <th className="px-8 py-5 text-right">Управление</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                        {getSortedEmployees().map(emp => (
                            <tr key={emp.id} className={`hover:bg-slate-50 transition-colors group ${emp.is_at_site ? 'bg-blue-50/20' : ''}`}>
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-xs shadow-inner" style={{ backgroundColor: emp.avatar_color || '#cbd5e1' }}>{emp.full_name.charAt(0)}</div>
                                        <div>
                                            <div className="font-black text-slate-800 uppercase italic tracking-tighter flex items-center gap-2">
                                                {emp.full_name}
                                                {emp.is_at_site && <span className="bg-green-500 text-white text-[7px] px-2 py-0.5 rounded-full animate-pulse">В СМЕНЕ</span>}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{emp.phone}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-center font-black text-blue-600 italic">{(emp.rating || 0).toFixed(1)} ★</td>
                                <td className="px-8 py-6 text-center font-black text-slate-400 italic">{(emp.total_hours || 0)} ч.</td>
                                <td className="px-8 py-6 text-center">
                                    <div className="text-xs font-black text-slate-800 tracking-tighter">{(emp.balance_owed || 0).toLocaleString()} ₽</div>
                                    <div className="text-[8px] font-black text-slate-400 uppercase">К выплате</div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <button onClick={() => { setEditingEmp(emp); setIsModalOpen(true); }} className="text-slate-400 hover:text-blue-600 text-[10px] font-black uppercase tracking-widest transition-colors">Правка</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isInviteModalOpen && (
                <div className="fixed inset-0 bg-slate-900/95 z-[700] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300 border border-white/20">
                        <div className="p-10 border-b bg-emerald-600 text-white relative">
                             <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl font-black italic select-none">JOIN</div>
                             <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-tight relative">Пригласить сотрудника</h3>
                             <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-2 opacity-80">Генерация ссылки для входа</p>
                        </div>
                        <div className="p-10 space-y-8">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Номер телефона сотрудника</label>
                                <input 
                                    type="tel" 
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 outline-none focus:border-emerald-500/30 shadow-inner" 
                                    placeholder="+7 (___) ___-__-__" 
                                    value={invitePhone} 
                                    onChange={e => setInvitePhone(e.target.value)} 
                                />
                            </div>
                            
                            {!generatedLink ? (
                                <button onClick={generateInvite} className="w-full bg-emerald-600 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all">СФОРМИРОВАТЬ ССЫЛКУ</button>
                            ) : (
                                <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
                                    <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[1.5rem]">
                                        <div className="text-[9px] font-black text-slate-400 uppercase mb-2">Готовая ссылка:</div>
                                        <div className="text-xs font-bold text-slate-700 break-all select-all mb-4">{generatedLink}</div>
                                        <button onClick={() => copyToClipboard(generatedLink)} className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline">Копировать в буфер</button>
                                    </div>
                                    <div className="flex gap-3">
                                        {['Telegram', 'WhatsApp', 'SMS'].map(m => (
                                            <button 
                                                key={m} 
                                                onClick={() => setInviteMethod(m as any)}
                                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${inviteMethod === m ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                    <button className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">ОТПРАВИТЬ ЧЕРЕЗ {inviteMethod.toUpperCase()}</button>
                                </div>
                            )}
                        </div>
                        <div className="p-8 bg-slate-50 border-t flex justify-center">
                            <button onClick={() => { setIsInviteModalOpen(false); setGeneratedLink(''); }} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">ЗАКРЫТЬ ОКНО</button>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
              <div className="fixed inset-0 bg-slate-900/95 z-[700] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
                <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="p-8 bg-blue-600 text-white flex justify-between items-center shrink-0">
                    <div>
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none">{editingEmp.id ? 'РЕДАКТИРОВАТЬ' : 'НОВЫЙ СОТРУДНИК'}</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-2 opacity-80">Управление личными данными и рейтингом</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center font-black transition-colors">✕</button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col lg:flex-row p-8 gap-10">
                    {/* Left Side: General Info */}
                    <div className="flex-1 space-y-8">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">ФИО полностью</label>
                          <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 outline-none focus:border-blue-600/30 transition-all" value={editingEmp.full_name || ''} onChange={e => setEditingEmp({...editingEmp, full_name: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Номер телефона</label>
                          <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 outline-none focus:border-blue-600/30 transition-all" value={editingEmp.phone || ''} onChange={e => setEditingEmp({...editingEmp, phone: e.target.value})} />
                        </div>

                        {editingEmp.id && (
                          <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                            <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2 block italic">Ссылка на личный кабинет</label>
                            <div className="text-[11px] font-bold text-slate-600 break-all mb-4 bg-white p-3 rounded-xl border border-blue-100/50">
                               {getCabinetLink(editingEmp.id)}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => copyToClipboard(getCabinetLink(editingEmp.id!))} className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline">Копировать</button>
                              <span className="text-slate-300">|</span>
                              <a href={`https://wa.me/${editingEmp.phone?.replace(/\D/g, '')}?text=${encodeURIComponent('Ваш доступ в Д.ПРО: ' + getCabinetLink(editingEmp.id!))}`} target="_blank" className="text-[9px] font-black text-green-600 uppercase tracking-widest hover:underline">WhatsApp</a>
                            </div>
                          </div>
                        )}
                        
                        <div className="pt-4 flex gap-4">
                           <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">СОХРАНИТЬ ИЗМЕНЕНИЯ</button>
                        </div>
                    </div>

                    {/* Right Side: Reviews System */}
                    <div className="flex-1 flex flex-col">
                        <div className="bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col h-full overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                                <h4 className="text-[11px] font-black uppercase italic tracking-tighter text-slate-900">ИСТОРИЯ ОТЗЫВОВ И РЕЙТИНГ</h4>
                                <div className="text-xl font-black text-blue-600 italic">{(editingEmp.rating || 0).toFixed(1)} ★</div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50">
                                {editingEmp.id ? (
                                    <>
                                        {/* Add Review Form */}
                                        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4 mb-6">
                                            <div className="flex justify-between items-center">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Добавить отзыв</div>
                                                <div className="flex gap-1">
                                                    {[1,2,3,4,5].map(star => (
                                                        <button 
                                                            key={star} 
                                                            onClick={() => setNewReviewRating(star)}
                                                            className={`text-lg transition-all ${newReviewRating >= star ? 'text-yellow-400 scale-110' : 'text-slate-200'}`}
                                                        >★</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <textarea 
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500/20 transition-all resize-none h-20"
                                                placeholder="Напишите замечание или похвалу..."
                                                value={newReviewComment}
                                                onChange={e => setNewReviewComment(e.target.value)}
                                            />
                                            <button 
                                                onClick={handleSubmitReview}
                                                disabled={isSubmittingReview || !newReviewComment.trim()}
                                                className="w-full bg-slate-900 text-white py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50"
                                            >
                                                {isSubmittingReview ? 'ОТПРАВКА...' : 'ОПУБЛИКОВАТЬ ОТЗЫВ'}
                                            </button>
                                        </div>

                                        {/* Reviews List */}
                                        <div className="space-y-4">
                                            {editingEmp.reviews && editingEmp.reviews.length > 0 ? (
                                                editingEmp.reviews.map(review => (
                                                    <div key={review.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div>
                                                                <div className="text-[9px] font-black text-slate-900 uppercase italic tracking-tighter">{review.author_name}</div>
                                                                <div className="text-[8px] font-bold text-slate-400 uppercase">{new Date(review.timestamp).toLocaleDateString()}</div>
                                                            </div>
                                                            <div className="text-yellow-400 font-black text-xs">{review.rating} ★</div>
                                                        </div>
                                                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic">"{review.comment}"</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="py-10 text-center text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] opacity-50 italic">Отзывов пока нет</div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-20 text-center text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] opacity-50 italic">Сохраните сотрудника, чтобы оставить отзыв</div>
                                )}
                            </div>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>
    );
};
