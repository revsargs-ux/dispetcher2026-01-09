
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Employees } from './components/Employees';
import { Finance } from './components/Finance';
import { ActiveWorkers } from './components/ActiveWorkers';
import { DispatcherChat } from './components/DispatcherChat';
import { HelpCenter } from './components/HelpCenter';
import { AIInsights } from './components/AIInsights';
import { WorkerApp } from './components/WorkerApp';
import { CustomerApp } from './components/CustomerApp';
import { AdminDashboard } from './components/AdminDashboard';
import { Customers } from './components/Customers';
import { supabase } from './services/supabaseClient';
import { dataService } from './services/dataService';
import { ViewState, UserRole, Dispatcher } from './types';
import { USE_MOCK_DATA } from './constants';

const AuthScreen = ({ onLogin }: { onLogin: (email: string, role: UserRole, id?: string) => void }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState('');

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setStatusMessage('Авторизация...');

        try {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            
            if (signInError) {
                if (signInError.message.toLowerCase().includes('invalid login') || signInError.message.toLowerCase().includes('not found')) {
                    setStatusMessage('Создание профиля...');
                    let role: UserRole = 'dispatcher';
                    let extId = 'd1';
                    if (email.includes('admin')) { role = 'admin'; extId = 'admin_01'; }
                    else if (email.includes('worker')) { role = 'worker'; extId = 'w_test_exec'; } 
                    else if (email.includes('client')) { role = 'customer'; extId = 'тест клиент'; }
                    else if (email.includes('disp')) { role = 'dispatcher'; extId = 'd_test_disp'; }

                    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                        email, password, options: { data: { role, external_id: extId } }
                    });

                    if (signUpError) throw signUpError;
                    if (signUpData.user) {
                        onLogin(signUpData.user.email || email, role, extId);
                        return;
                    }
                } else {
                    throw signInError;
                }
            }
            
            if (signInData.user) {
                const metadata = signInData.user.user_metadata;
                let role = metadata?.role as UserRole;
                let extId = metadata?.external_id;

                if (!role) {
                    if (email.includes('admin')) { role = 'admin'; extId = 'admin_01'; }
                    else if (email.includes('worker')) { role = 'worker'; extId = 'w_test_exec'; }
                    else if (email.includes('client')) { role = 'customer'; extId = 'тест клиент'; }
                    else if (email.includes('disp')) { role = 'dispatcher'; extId = 'd_test_disp'; }
                    else { role = 'dispatcher'; extId = 'd1'; }
                }
                onLogin(signInData.user.email || email, role, extId);
            }
        } catch (err: any) {
            setError(err.message || 'Ошибка входа');
        } finally {
            setLoading(false);
        }
    };

    const setDemo = (e: string) => { setEmail(e); setPassword('1234qwer'); };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 font-sans p-4">
            <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-10 border border-slate-200">
                <div className="text-center mb-10">
                    <h1 className="text-5xl font-black text-blue-600 mb-2 italic tracking-tighter">Д.ПРО</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic opacity-60">Тестовый доступ (Пароль: 1234qwer)</p>
                </div>
                <form onSubmit={handleAuth} className="space-y-5">
                    <input type="email" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
                    <input type="password" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" />
                    {error && <div className="text-red-500 text-[10px] font-black text-center">{error}</div>}
                    <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase shadow-xl active:scale-95 transition-all">Войти</button>
                </form>
                <div className="mt-8 grid grid-cols-2 gap-2">
                    <button onClick={() => setDemo('admin@dpro.ru')} className="p-3 bg-red-50 text-red-600 rounded-xl text-[9px] font-black uppercase hover:bg-red-100">тестадмин</button>
                    <button onClick={() => setDemo('disp@dpro.ru')} className="p-3 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase hover:bg-blue-100">тестдиспетчер</button>
                    <button onClick={() => setDemo('worker@dpro.ru')} className="p-3 bg-green-50 text-green-600 rounded-xl text-[9px] font-black uppercase hover:bg-green-100">тестисполнитель</button>
                    <button onClick={() => setDemo('client@dpro.ru')} className="p-3 bg-amber-50 text-amber-600 rounded-xl text-[9px] font-black uppercase hover:bg-amber-100">тест клиент</button>
                </div>
            </div>
        </div>
    );
};

export default function App() {
  const [session, setSession] = useState<any>(null); 
  const [userRole, setUserRole] = useState<UserRole | null>(null); 
  const [originalAdminRole, setOriginalAdminRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [view, setView] = useState<ViewState>('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
          setSession(session);
          const metadata = session.user.user_metadata;
          let role = metadata?.role as UserRole || null;
          let extId = metadata?.external_id || session.user.id;

          // Фикс для первичного входа без метаданных
          if (!role && session.user.email) {
              if (session.user.email.includes('admin')) { role = 'admin'; extId = 'admin_01'; }
              else if (session.user.email.includes('worker')) { role = 'worker'; extId = 'w_test_exec'; }
              else if (session.user.email.includes('client')) { role = 'customer'; extId = 'тест клиент'; }
              else if (session.user.email.includes('disp')) { role = 'dispatcher'; extId = 'd_test_disp'; }
          }

          setUserRole(role);
          setOriginalAdminRole(role === 'admin' ? 'admin' : null);
          setCurrentUserId(extId);
          if (role === 'admin') setView('admin_dashboard');
      }
      setLoading(false);
    });
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); setUserRole(null); setOriginalAdminRole(null); };

  const handleImpersonate = (role: UserRole, userId?: string) => {
    setUserRole(role);
    setCurrentUserId(userId);
    setView('dashboard');
  };

  const handleResetImpersonation = () => {
    if (originalAdminRole) {
      setUserRole(originalAdminRole);
      setCurrentUserId('admin_01');
      setView('admin_dashboard');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-[10px] font-black uppercase tracking-widest opacity-50">Д.ПРО Инициализация...</div>
    </div>
  );
  
  if (!session || !userRole) return <AuthScreen onLogin={(e, r, id) => { setSession({user:{email:e}}); setUserRole(r); setOriginalAdminRole(r === 'admin' ? 'admin' : null); setCurrentUserId(id); if (r === 'admin') setView('admin_dashboard'); }} />;

  if (userRole === 'worker') return <WorkerApp impersonatedWorkerId={currentUserId} onLogout={originalAdminRole ? handleResetImpersonation : handleLogout} />;
  if (userRole === 'customer') return <CustomerApp onLogout={originalAdminRole ? handleResetImpersonation : handleLogout} userEmail={session?.user?.email || ''} />;

  if (userRole === 'dispatcher' || userRole === 'admin') {
      return (
        <Layout 
            currentView={view} 
            onChangeView={setView} 
            onLogout={originalAdminRole && userRole !== 'admin' ? handleResetImpersonation : handleLogout} 
            userEmail={session?.user?.email} 
            isAdminView={userRole === 'admin' || !!originalAdminRole}
        >
          {view === 'admin_dashboard' && userRole === 'admin' && (
              <AdminDashboard 
                adminEmail={session?.user?.email || 'admin@dpro.ru'} 
                onLogout={handleLogout} 
                onImpersonate={handleImpersonate} 
              />
          )}
          {view === 'dashboard' && <Dashboard />}
          {view === 'employees' && <Employees />}
          {view === 'customers' && <Customers />}
          {view === 'finance' && <Finance />}
          {view === 'ai_audit' && <AIInsights onClose={() => setView('dashboard')} />}
        </Layout>
      );
  }

  return <AuthScreen onLogin={() => {}} />;
}
