
import React, { useEffect, useRef } from 'react';
import { Employee, Order } from '../types';

interface MonitoringMapProps {
    employees: Employee[];
    orders: Order[];
}

declare const L: any;

export const MonitoringMap: React.FC<MonitoringMapProps> = ({ employees, orders }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markersEmployeesRef = useRef<{ [key: string]: any }>({});
    const markersOrdersRef = useRef<{ [key: string]: any }>({});

    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;

        // Инициализация карты (центр - Петропавловск-Камчатский)
        mapInstance.current = L.map(mapRef.current, {
            zoomControl: false,
            attributionControl: false
        }).setView([53.0240, 158.6430], 13);

        // Используем светлую и понятную подложку Voyager (CartoDB)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
        }).addTo(mapInstance.current);

        L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!mapInstance.current) return;

        // --- УПРАВЛЕНИЕ МАРКЕРАМИ СОТРУДНИКОВ ---
        const currentEmpIds = new Set(employees.map(e => e.id));
        Object.keys(markersEmployeesRef.current).forEach(id => {
            if (!currentEmpIds.has(id)) {
                markersEmployeesRef.current[id].remove();
                delete markersEmployeesRef.current[id];
            }
        });

        employees.forEach(emp => {
            if (emp.lat && emp.lng) {
                const isSOS = emp.emergency_status?.active;
                const isAtSite = emp.is_at_site;
                // Красный - SOS, Зеленый - Работает, Синий - Свободен
                const color = isSOS ? '#ef4444' : (isAtSite ? '#22c55e' : '#3b82f6');
                const initial = emp.full_name.charAt(0).toUpperCase();
                
                const empIcon = L.divIcon({
                    className: '',
                    html: `
                        <div class="custom-marker shadow-2xl transition-all duration-1000" style="background-color: ${color}; width: 44px; height: 44px; font-size: 16px; border: 4px solid white; transform: scale(${isSOS ? '1.2' : '1'}); z-index: 1000;">
                            ${initial}
                            ${isSOS ? '<span class="absolute -top-1 -right-1 w-4 h-4 bg-white text-red-600 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-red-600 animate-bounce">!</span>' : ''}
                        </div>
                    `,
                    iconSize: [44, 44],
                    iconAnchor: [22, 22]
                });

                if (markersEmployeesRef.current[emp.id]) {
                    markersEmployeesRef.current[emp.id].setLatLng([emp.lat, emp.lng]);
                    markersEmployeesRef.current[emp.id].setIcon(empIcon);
                } else {
                    const marker = L.marker([emp.lat, emp.lng], { icon: empIcon })
                        .addTo(mapInstance.current)
                        .bindPopup(`
                            <div class="p-3">
                                <div class="font-black uppercase text-xs mb-1 text-slate-800">${emp.full_name}</div>
                                <div class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">${isAtSite ? 'На объекте' : 'Свободен / В пути'}</div>
                                <div class="pt-2 border-t border-slate-100 flex justify-between items-center gap-4">
                                    <span class="text-[9px] font-black text-slate-400 uppercase">Балланс:</span>
                                    <span class="text-sm font-black text-blue-600">${emp.balance_owed} ₽</span>
                                </div>
                            </div>
                        `);
                    markersEmployeesRef.current[emp.id] = marker;
                }
            }
        });

        // --- УПРАВЛЕНИЕ МАРКЕРАМИ ЗАКАЗОВ (ОБЪЕКТОВ) ---
        const activeOrders = orders.filter(o => o.status === 'active' && o.lat && o.lng);
        const currentOrderIds = new Set(activeOrders.map(o => o.id));
        
        Object.keys(markersOrdersRef.current).forEach(id => {
            if (!currentOrderIds.has(id)) {
                markersOrdersRef.current[id].remove();
                delete markersOrdersRef.current[id];
            }
        });

        activeOrders.forEach(order => {
            if (order.lat && order.lng) {
                const orderIcon = L.divIcon({
                    className: '',
                    html: `
                        <div class="custom-marker shadow-xl bg-orange-500 border-white border-4" style="width: 38px; height: 38px; clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%); background-color: #f97316; display: flex; align-items: center; justify-content: center; color: white;">
                           <span class="text-lg">⌂</span>
                        </div>
                    `,
                    iconSize: [38, 38],
                    iconAnchor: [19, 19]
                });

                if (markersOrdersRef.current[order.id]) {
                    markersOrdersRef.current[order.id].setLatLng([order.lat, order.lng]);
                } else {
                    const marker = L.marker([order.lat, order.lng], { icon: orderIcon })
                        .addTo(mapInstance.current)
                        .bindPopup(`
                            <div class="p-3">
                                <div class="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1 italic">Активный объект</div>
                                <div class="font-black uppercase text-xs text-slate-800 mb-1 leading-tight">${order.address}</div>
                                <div class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">${order.client_name}</div>
                                <div class="mt-2 text-[9px] bg-slate-50 p-2 rounded-lg border border-slate-100 flex justify-between">
                                    <span class="text-slate-400">Людей:</span>
                                    <span class="font-black text-slate-700">${order.confirmed_workers_count}/${order.required_workers}</span>
                                </div>
                            </div>
                        `);
                    markersOrdersRef.current[order.id] = marker;
                }
            }
        });

        // Авто-фокус на все значимые точки (сотрудники + заказы)
        const validPoints = [
            ...employees.filter(e => e.lat && e.lng).map(e => [e.lat, e.lng]),
            ...activeOrders.map(o => [o.lat, o.lng])
        ];

        if (validPoints.length > 0 && !mapInstance.current.fixed) {
            const bounds = L.latLngBounds(validPoints as any);
            mapInstance.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
            mapInstance.current.fixed = true; 
        }
    }, [employees, orders]);

    return (
        <div className="w-full h-full relative group bg-slate-50">
            <div ref={mapRef} className="w-full h-full" />
            
            {/* Панель статуса */}
            <div className="absolute top-6 left-6 z-[100] flex flex-col gap-2">
                <div className="bg-white/90 backdrop-blur-xl px-5 py-3 rounded-2xl border border-slate-200 flex items-center gap-3 shadow-2xl">
                    <div className="relative">
                        <span className="w-2.5 h-2.5 block rounded-full bg-green-500"></span>
                        <span className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
                    </div>
                    <div>
                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest block leading-none">ПРЯМОЙ ЭФИР</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1 block">Мониторинг {employees.filter(e => e.lat && e.lng).length} исполнителей</span>
                    </div>
                </div>
            </div>

            {/* Легенда */}
            <div className="absolute bottom-6 left-6 z-[100] flex flex-wrap gap-3 pointer-events-none">
                <LegendItem color="bg-blue-500" label="Свободен" />
                <LegendItem color="bg-green-500" label="На объекте" />
                <LegendItem color="bg-orange-500" label="Объект" icon="⌂" />
                <LegendItem color="bg-red-500" label="SOS" />
            </div>
        </div>
    );
};

const LegendItem = ({ color, label, icon }: { color: string, label: string, icon?: string }) => (
    <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2 shadow-lg">
        {icon ? (
            <span className={`w-5 h-5 ${color} rounded-lg flex items-center justify-center text-[10px] text-white font-black`}>{icon}</span>
        ) : (
            <span className={`w-2 h-2 rounded-full ${color}`}></span>
        )}
        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{label}</span>
    </div>
);
