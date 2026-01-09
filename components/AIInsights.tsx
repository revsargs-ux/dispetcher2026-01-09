
import React, { useState, useEffect } from 'react';
import { analyzeSystemHealth } from '../services/aiService';
import { dataService } from '../services/dataService';

export const AIInsights: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const [errorStatus, setErrorStatus] = useState<null | '403' | '500'>(null);
  const [report, setReport] = useState<any>(null);

  const checkKeyAndRun = async () => {
    const aistudio = (window as any).aistudio;
    if (!aistudio) return runAudit(); // Fallback if not in environment
    
    const hasKey = await aistudio.hasSelectedApiKey();
    if (!hasKey) {
      setNeedsKey(true);
      return;
    }
    setNeedsKey(false);
    runAudit();
  };

  const handleSelectKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      setNeedsKey(false);
      setErrorStatus(null);
      // Proceed immediately as per race condition rule
      runAudit();
    }
  };

  const runAudit = async () => {
    setLoading(true);
    setErrorStatus(null);
    try {
      const [emps, orders] = await Promise.all([
        dataService.getEmployees(),
        dataService.getOrders()
      ]);

      const stats = {
        total_workers: emps.length,
        avg_rating: emps.length > 0 ? emps.reduce((acc, e) => acc + e.rating, 0) / emps.length : 5,
        orders_count: orders.length,
      };
      
      const result = await analyzeSystemHealth({ stats, orders });
      setReport(result);
    } catch (e: any) {
      console.error("AI Insights Error:", e);
      if (e.message?.includes('403') || e.message?.includes('PERMISSION_DENIED')) {
        setErrorStatus('403');
        setNeedsKey(true);
      } else {
        setErrorStatus('500');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkKeyAndRun();
  }, []);

  if (needsKey) return (
    <div className="fixed inset-0 bg-slate-900/90 z-[500] flex items-center justify-center p-6 backdrop-blur-xl">
      <div className="bg-white rounded-[3rem] p-12 max-w-md text-center shadow-2xl border border-slate-200">
        <div className="text-6xl mb-6">{errorStatus === '403' ? '🚫' : '🔑'}</div>
        <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-4 text-slate-900">
          {errorStatus === '403' ? 'Доступ ограничен' : 'Авторизация ИИ'}
        </h2>
        <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">
          {errorStatus === '403' 
            ? "Ваш текущий API-ключ не позволяет использовать Google Search. Пожалуйста, убедитесь, что вы выбрали ключ от платного проекта с активным биллингом."
            : "Для глубокого аудита рынка (Google Search + Gemini 3) необходимо выбрать ваш персональный API ключ."}
        </p>
        <div className="space-y-4">
          <button 
            onClick={handleSelectKey}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
          >
            {errorStatus === '403' ? 'Сменить ключ' : 'Выбрать ключ'}
          </button>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline"
          >
            Подробнее о биллинге
          </a>
          <button onClick={onClose} className="w-full py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Закрыть</button>
        </div>
      </div>
    </div>
  );

  if (errorStatus === '500') return (
    <div className="fixed inset-0 bg-slate-900/90 z-[500] flex items-center justify-center p-6 backdrop-blur-xl">
      <div className="bg-white rounded-[3rem] p-12 max-w-md text-center shadow-2xl border border-slate-200">
        <div className="text-6xl mb-6">⚙️</div>
        <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-4 text-slate-900">Ошибка сервера</h2>
        <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">
          Произошла внутренняя ошибка ИИ (Internal Error). Это может быть связано с временным сбоем preview-модели.
        </p>
        <div className="space-y-4">
          <button 
            onClick={runAudit}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all"
          >
            Попробовать еще раз
          </button>
          <button 
            onClick={onClose}
            className="w-full py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <div className={onClose ? "fixed inset-0 bg-slate-900/90 z-[400] flex items-center justify-center p-4 backdrop-blur-md" : "h-full w-full flex items-center justify-center bg-slate-100"}>
      <div className="text-center animate-pulse">
        <div className="w-24 h-24 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
        <div className="text-slate-900 font-black uppercase tracking-[0.4em] text-xs">Анализируем рынок...</div>
        <div className="text-slate-400 text-[10px] mt-2 font-bold italic">Gemini 3 + Google Search</div>
      </div>
    </div>
  );

  return (
    <div className={onClose ? "fixed inset-0 bg-slate-950/95 z-[300] flex items-center justify-center p-4 lg:p-10 backdrop-blur-xl overflow-hidden" : "h-full w-full bg-slate-100 flex flex-col overflow-hidden"}>
      <div className={onClose ? "w-full max-w-7xl h-full bg-slate-100 rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/10" : "flex-1 flex flex-col overflow-hidden"}>
        
        <div className="p-8 border-b bg-white flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-3xl font-black italic text-slate-900 uppercase tracking-tighter leading-tight">Бизнес-аналитик AI</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Сравнение с рынком и KPI</p>
          </div>
          <div className="flex gap-4">
             <button onClick={runAudit} className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all">Обновить</button>
             {onClose && (
                <button onClick={onClose} className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center font-black">✕</button>
             )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] flex flex-col items-center justify-center text-center">
                    <div className="text-6xl font-black italic text-cyan-400 mb-2">{report?.score || 0}%</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Рейтинг здоровья бизнеса</div>
                </div>

                <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Рыночный анализ</div>
                    <div className="text-sm font-bold text-slate-700 leading-relaxed italic">
                        "{report?.market_analysis || 'Данные собираются...'}"
                    </div>
                    {report?.citations && report.citations.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                            {report.citations.map((cite: any, i: number) => (
                                <a key={i} href={cite.uri} target="_blank" rel="noopener noreferrer" className="text-[8px] bg-slate-100 text-blue-600 px-2 py-1 rounded-md font-bold truncate max-w-[150px]">
                                    {cite.title || 'Источник'}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-[3rem]">
                    <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-6 italic">Стратегии клиентов</h3>
                    <div className="space-y-4">
                        {report?.client_strategies?.map((cs: any, i: number) => (
                            <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-200/50">
                                <div className="text-xs font-black text-slate-900 uppercase italic mb-1">{cs.client_name}</div>
                                <div className="text-xs font-bold text-slate-600">{cs.strategy}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[3rem]">
                    <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-6 italic">Удержание персонала</h3>
                    <div className="space-y-4">
                        {report?.worker_incentives?.map((wi: any, i: number) => (
                            <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-200/50">
                                <div className="text-xs font-black text-emerald-600 uppercase mb-1">{wi.group}</div>
                                <div className="text-xs font-bold text-slate-600 italic">"{wi.action}"</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-10 rounded-[3rem] text-white shadow-2xl">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] mb-8 italic opacity-80">Рекомендованные KPI</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {report?.kpi_metrics?.map((m: any, i: number) => (
                        <div key={i} className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10 flex justify-between items-center">
                            <div className="text-[10px] font-black uppercase tracking-widest">{m.label}</div>
                            <div className="text-lg font-black italic">{m.value}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
