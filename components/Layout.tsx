
import React, { useState } from 'react';
import { ViewState } from '../types';

interface LayoutProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
  userEmail?: string;
  isAdminView?: boolean;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, onChangeView, onLogout, userEmail, isAdminView, children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleNavClick = (view: ViewState) => {
      if (view === 'dashboard') {
          window.dispatchEvent(new CustomEvent('ensure-orders-visible'));
      }
      onChangeView(view);
      setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-200 overflow-hidden font-sans relative">
      
      <div 
        onClick={() => setIsSidebarCollapsed(false)}
        className={`
          fixed left-0 top-0 bottom-0 z-[150] cursor-pointer transition-all duration-500 group flex flex-col items-center justify-center border-r border-slate-300
          ${isSidebarCollapsed ? 'w-10 bg-slate-950 opacity-100' : 'w-0 opacity-0 pointer-events-none'}
        `}
      >
        <div className="w-1 h-20 bg-blue-600 rounded-full mb-4 group-hover:h-32 transition-all"></div>
        <div className="text-[8px] font-black text-blue-500 rotate-180 [writing-mode:vertical-lr] uppercase tracking-[0.5em] group-hover:text-white transition-colors">
          РАЗВЕРНУТЬ МЕНЮ
        </div>
      </div>

      {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-950/70 z-[110] lg:hidden backdrop-blur-md animate-in fade-in duration-500"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
      )}

      <aside 
        className={`
            fixed lg:relative inset-y-0 left-0 z-[120] 
            bg-slate-950 text-white flex flex-col shadow-2xl flex-shrink-0 
            transition-all duration-500 ease-in-out overflow-hidden
            ${isMobileMenuOpen ? 'translate-x-0 w-72' : (isSidebarCollapsed ? '-translate-x-full w-0' : 'translate-x-0 w-72')}
        `}
      >
        <div className="p-8 border-b border-white/5 flex justify-between items-center relative min-w-[18rem]">
            <div className="absolute top-0 right-0 p-8 opacity-5 text-8xl font-black italic select-none pointer-events-none">PRO</div>
            <div className="overflow-hidden relative">
              <h1 className="text-4xl font-black tracking-tighter text-blue-500 italic leading-none">Д.ПРО</h1>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-3 truncate opacity-60">Dispatcher.System</p>
            </div>
            <button 
              onClick={() => setIsSidebarCollapsed(true)}
              className="p-2 rounded-xl bg-white/5 text-slate-500 hover:text-white hover:bg-blue-600 transition-all shrink-0 shadow-lg active:scale-90"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
        </div>
        
        <nav className="flex-1 p-6 space-y-2 mt-6 overflow-y-auto custom-scrollbar min-w-[18rem]">
          {isAdminView && (
            <SidebarItem 
              active={currentView === 'admin_dashboard'} 
              onClick={() => handleNavClick('admin_dashboard')} 
              icon={<path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />}
              label="Глобальный дашборд" 
            />
          )}
          <SidebarItem 
            active={currentView === 'dashboard'} 
            onClick={() => handleNavClick('dashboard')} 
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-13.5 18v-2.25z" />}
            label="Активные объекты" 
          />
          <SidebarItem 
            active={currentView === 'customers'} 
            onClick={() => handleNavClick('customers')} 
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 .414-.336.75-.75.75H4.5a.75.75 0 01-.75-.75V14.15c0-.414.336-.75.75-.75h15c.414 0 .75.336.75.75zM12 11.25V3.75m0 0l-3.75 3.75M12 3.75l3.75 3.75" />}
            label="Заказчики" 
          />
          <SidebarItem 
            active={currentView === 'employees'} 
            onClick={() => handleNavClick('employees')} 
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v-.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />}
            label="База персонала" 
          />
          <SidebarItem 
            active={currentView === 'ai_audit'} 
            onClick={() => handleNavClick('ai_audit')} 
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.456-2.455L18 2.25l.259 1.036a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />}
            label="ИИ Аналитика" 
          />
          <SidebarItem 
            active={currentView === 'finance'} 
            onClick={() => handleNavClick('finance')} 
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />}
            label="Бухгалтерия" 
          />
        </nav>

        <div className="p-8 border-t border-white/5 bg-slate-900/40 min-w-[18rem]">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-white shadow-xl">О</div>
                <div className="min-w-0">
                    <div className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Оператор:</div>
                    <div className="text-xs font-black text-slate-200 truncate">{userEmail || 'Диспетчер-1'}</div>
                </div>
            </div>
            <button 
                onClick={onLogout}
                className={`w-full flex items-center justify-center px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white rounded-[1.5rem] transition-all shadow-xl active:scale-95 border ${currentView === 'admin_dashboard' ? 'bg-slate-700 border-slate-600' : 'bg-red-600/10 hover:bg-red-600 border-red-600/20'}`}
            >
                {isAdminView && currentView !== 'admin_dashboard' ? 'Выйти из режима' : 'Завершить сессию'}
            </button>
        </div>
      </aside>

      <main className={`flex-1 overflow-auto relative bg-slate-100 transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'pl-10' : ''}`}>
        {children}
      </main>
    </div>
  );
};

const SidebarItem = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-5 px-6 py-4 rounded-[1.5rem] transition-all duration-300 group ${
      active 
        ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/40 translate-x-1' 
        : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
    }`}
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-600 group-hover:text-blue-500 transition-colors'}`}>
      {icon}
    </svg>
    <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${active ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>{label}</span>
  </button>
);
