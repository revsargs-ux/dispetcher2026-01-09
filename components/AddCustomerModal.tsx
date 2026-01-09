
import React, { useState } from 'react';
import { dataService } from '../services/dataService';

interface AddCustomerModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<'input' | 'success'>('input');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const handleSave = async () => {
    if (!name || !phone) return alert('Заполните все поля');
    
    await dataService.createCustomer(name, phone);
    
    // Генерация ссылки (используем имя для имитации уникального ID кабинета)
    const link = `${window.location.origin}/login?role=customer&id=${encodeURIComponent(name)}`;
    setInviteLink(link);
    
    setStep('success');
    if (onSuccess) onSuccess();
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    alert('Ссылка скопирована!');
  };

  const share = (platform: 'wa' | 'tg' | 'sms') => {
    const text = `Здравствуйте! Ваш доступ в кабинет заказчика системы Д.ПРО: ${inviteLink}`;
    const encoded = encodeURIComponent(text);
    if (platform === 'wa') window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encoded}`);
    if (platform === 'tg') window.open(`https://t.me/share/url?url=${inviteLink}&text=${text}`);
    if (platform === 'sms') window.location.href = `sms:${phone}?body=${text}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300 border border-white/20">
        {step === 'input' ? (
          <div className="p-10">
            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-8 text-slate-900">Новый Заказчик</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Наименование организации</label>
                <input 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-800 outline-none focus:border-blue-500/30 transition-all" 
                  placeholder="Напр: ТЦ Шамса" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Телефон для уведомлений</label>
                <input 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-800 outline-none focus:border-blue-500/30 transition-all" 
                  placeholder="+7 (___) ___-__-__" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                />
              </div>
              <div className="pt-4 space-y-3">
                <button onClick={handleSave} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all">ЗАРЕГИСТРИРОВАТЬ</button>
                <button onClick={onClose} className="w-full text-slate-400 text-[10px] font-black uppercase tracking-widest py-2 hover:text-slate-600 transition-colors">Отмена</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-10 text-center">
            <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center text-3xl mx-auto mb-6 shadow-xl shadow-green-500/20">✓</div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2 text-slate-900">Заказчик добавлен!</h3>
            <p className="text-xs text-slate-500 font-medium mb-8 leading-relaxed">Личный кабинет создан. Отправьте ссылку для доступа.</p>
            
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 mb-8">
              <div className="text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">Ссылка на кабинет</div>
              <div className="text-[11px] font-bold text-slate-800 break-all mb-4 bg-white p-3 rounded-xl shadow-inner border border-slate-100">{inviteLink}</div>
              <button onClick={copyLink} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Копировать</button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-8">
              <ShareButton icon="💬" label="WhatsApp" onClick={() => share('wa')} />
              <ShareButton icon="✈️" label="Telegram" onClick={() => share('tg')} />
              <ShareButton icon="✉️" label="SMS" onClick={() => share('sms')} />
            </div>

            <button onClick={onClose} className="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Закрыть</button>
          </div>
        )}
      </div>
    </div>
  );
};

const ShareButton = ({ icon, label, onClick }: { icon: string, label: string, onClick: () => void }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-2 group">
    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-xl shadow-sm group-hover:bg-slate-200 group-active:scale-90 transition-all">{icon}</div>
    <span className="text-[8px] font-black uppercase text-slate-400">{label}</span>
  </button>
);
