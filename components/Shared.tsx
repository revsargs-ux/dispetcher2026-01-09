
import React, { useState, useEffect, useRef } from 'react';

// --- CUSTOM DATE PICKER ---
export const CustomDatePicker: React.FC<{
    value: string;
    onChange: (date: string) => void;
    placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay(); // 0 = Sun
    const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Mon = 0

    const handleDayClick = (day: number) => {
        const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        // Correct timezone offset issue by formatting manually
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        onChange(`${yyyy}-${mm}-${dd}`);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={ref}>
            <input 
                type="text" 
                readOnly 
                value={value ? new Date(value).toLocaleDateString('ru-RU') : ''} 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm cursor-pointer bg-white"
                placeholder={placeholder || 'Выберите дату'}
            />
            {isOpen && (
                <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-gray-200 shadow-lg rounded-lg p-2 w-64">
                    <div className="flex justify-between items-center mb-2">
                        <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))} className="p-1 hover:bg-gray-100 rounded">←</button>
                        <span className="text-sm font-bold capitalize">{viewDate.toLocaleString('ru', { month: 'long', year: 'numeric' })}</span>
                        <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))} className="p-1 hover:bg-gray-100 rounded">→</button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center mb-1">
                        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <span key={d} className="text-[10px] text-gray-400">{d}</span>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const d = i + 1;
                            const isSelected = value && new Date(value).getDate() === d && new Date(value).getMonth() === viewDate.getMonth();
                            return (
                                <button 
                                    key={d} 
                                    onClick={() => handleDayClick(d)}
                                    className={`w-8 h-8 flex items-center justify-center rounded text-sm ${isSelected ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}
                                >
                                    {d}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- PERIOD SELECTOR ---
type PeriodPreset = 'today' | 'yesterday' | 'week_current' | 'week_last' | 'month_current' | 'month_last' | 'quarter' | 'year';

export const PeriodSelector: React.FC<{
    startDate: string;
    endDate: string;
    onRangeChange: (start: string, end: string) => void;
}> = ({ startDate, endDate, onRangeChange }) => {
    
    const applyPreset = (preset: PeriodPreset) => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        // Helper to format YYYY-MM-DD
        const fmt = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        switch (preset) {
            case 'today':
                break; // start/end = now
            case 'yesterday':
                start.setDate(now.getDate() - 1);
                end.setDate(now.getDate() - 1);
                break;
            case 'week_current':
                const day = now.getDay() || 7; // 1=Mon, 7=Sun
                if (day !== 1) start.setDate(now.getDate() - day + 1);
                break;
            case 'week_last':
                const curDay = now.getDay() || 7;
                start.setDate(now.getDate() - curDay + 1 - 7);
                end.setDate(now.getDate() - curDay);
                break;
            case 'month_current':
                start.setDate(1);
                break;
            case 'month_last':
                start.setMonth(now.getMonth() - 1);
                start.setDate(1);
                end.setDate(0); // Last day of prev month
                break;
            case 'quarter':
                const q = Math.floor(now.getMonth() / 3);
                start.setMonth(q * 3);
                start.setDate(1);
                break;
            case 'year':
                start.setMonth(0);
                start.setDate(1);
                break;
        }

        onRangeChange(fmt(start), fmt(end));
    };

    return (
        <div className="flex flex-col gap-2 mb-4 bg-white p-3 rounded border border-gray-200">
            <div className="flex flex-wrap gap-2">
                {[
                    { l: 'Сегодня', v: 'today' },
                    { l: 'Вчера', v: 'yesterday' },
                    { l: 'Тек. неделя', v: 'week_current' },
                    { l: 'Прош. неделя', v: 'week_last' },
                    { l: 'Тек. месяц', v: 'month_current' },
                    { l: 'Прош. месяц', v: 'month_last' },
                    { l: 'Квартал', v: 'quarter' },
                    { l: 'Год', v: 'year' },
                ].map((p) => (
                    <button 
                        key={p.v}
                        onClick={() => applyPreset(p.v as PeriodPreset)}
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-xs text-gray-700 rounded transition-colors"
                    >
                        {p.l}
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Период: с</span>
                <div className="w-32"><CustomDatePicker value={startDate} onChange={(d) => onRangeChange(d, endDate)} /></div>
                <span className="text-sm text-gray-500">по</span>
                <div className="w-32"><CustomDatePicker value={endDate} onChange={(d) => onRangeChange(startDate, d)} /></div>
            </div>
        </div>
    );
};

// --- EXCEL FILTER DROPDOWN ---
export interface FilterState {
    valueSearch: string;
    selectedValues: Set<string>; // If empty, all selected
    rangeMin: string;
    rangeMax: string;
}

export const ExcelFilter: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    columnType: 'text' | 'number' | 'date';
    uniqueValues: string[];
    filterState: FilterState;
    onFilterChange: (s: FilterState) => void;
    onSort: (dir: 'asc' | 'desc') => void;
}> = ({ isOpen, onClose, columnType, uniqueValues, filterState, onFilterChange, onSort }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClose();
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const filteredValues = uniqueValues.filter(v => 
        v.toLowerCase().includes(filterState.valueSearch.toLowerCase())
    );

    const toggleValue = (val: string) => {
        const newSet = new Set(filterState.selectedValues);
        if (newSet.has(val)) newSet.delete(val);
        else newSet.add(val);
        onFilterChange({ ...filterState, selectedValues: newSet });
    };

    const toggleAll = () => {
        if (filterState.selectedValues.size === uniqueValues.length) {
            onFilterChange({ ...filterState, selectedValues: new Set() });
        } else {
            onFilterChange({ ...filterState, selectedValues: new Set(uniqueValues) });
        }
    };

    return (
        <div ref={ref} className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-300 shadow-xl rounded-md z-50 text-sm font-normal text-gray-700">
            <div className="p-2 border-b flex gap-2">
                <button onClick={() => { onSort('asc'); onClose(); }} className="flex-1 bg-gray-100 hover:bg-gray-200 py-1 rounded">А-Я / 1-9</button>
                <button onClick={() => { onSort('desc'); onClose(); }} className="flex-1 bg-gray-100 hover:bg-gray-200 py-1 rounded">Я-А / 9-1</button>
            </div>
            
            {(columnType === 'number' || columnType === 'date') && (
                <div className="p-2 border-b bg-gray-50">
                    <div className="text-xs font-bold mb-1">Диапазон</div>
                    <div className="flex gap-1">
                        <input 
                            type={columnType === 'date' ? 'date' : 'number'}
                            className="w-full border rounded px-1 py-0.5"
                            placeholder="От"
                            value={filterState.rangeMin}
                            onChange={e => onFilterChange({...filterState, rangeMin: e.target.value})}
                        />
                        <input 
                            type={columnType === 'date' ? 'date' : 'number'}
                            className="w-full border rounded px-1 py-0.5"
                            placeholder="До"
                            value={filterState.rangeMax}
                            onChange={e => onFilterChange({...filterState, rangeMax: e.target.value})}
                        />
                    </div>
                </div>
            )}

            <div className="p-2">
                <input 
                    type="text" 
                    placeholder="Поиск..." 
                    className="w-full border rounded px-2 py-1 mb-2"
                    value={filterState.valueSearch}
                    onChange={e => onFilterChange({...filterState, valueSearch: e.target.value})}
                />
                <div className="max-h-40 overflow-y-auto custom-scrollbar border rounded">
                    <label className="flex items-center px-2 py-1 hover:bg-gray-50 cursor-pointer border-b">
                         <input 
                            type="checkbox" 
                            className="mr-2"
                            checked={filterState.selectedValues.size === uniqueValues.length}
                            onChange={toggleAll}
                         />
                         <span className="font-bold">(Выбрать все)</span>
                    </label>
                    {filteredValues.map(val => (
                        <label key={val} className="flex items-center px-2 py-1 hover:bg-gray-50 cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="mr-2"
                                checked={filterState.selectedValues.has(val)}
                                onChange={() => toggleValue(val)}
                            />
                            <span className="truncate">{val}</span>
                        </label>
                    ))}
                </div>
            </div>
            <div className="p-2 border-t flex justify-end">
                <button onClick={onClose} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">OK</button>
            </div>
        </div>
    );
};
