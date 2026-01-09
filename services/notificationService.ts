import { dataService } from './dataService';

export const notificationService = {
    async requestPermission(): Promise<boolean> {
        if (!('Notification' in window)) return false;
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    },

    async registerPush(userId: string, role: string) {
        if (!('serviceWorker' in navigator)) return;
        try {
            await navigator.serviceWorker.ready;
            console.log(`[Push] Регистрация для ${role}:${userId}`);
            return true;
        } catch (e) {
            console.error('[Push] Registration failed:', e);
            return null;
        }
    },

    // Функция для вызова визуального уведомления в UI (Toast)
    showInApp(message: string, type: 'info' | 'success' | 'alert' = 'info') {
        const event = new CustomEvent('app-notification', { 
            detail: { message, type } 
        });
        window.dispatchEvent(event);
        
        // Дублируем системным уведомлением если вкладка не в фокусе
        if (document.visibilityState !== 'visible') {
            this.sendLocalNotification('Д.ПРО', message);
        }
    },

    sendLocalNotification(title: string, body: string, url: string = '/') {
        if (Notification.permission === 'granted') {
            // FIX: Removed 'vibrate' from NotificationOptions as it is not supported by the 'new Notification()' constructor in standard TypeScript DOM types.
            // Vibration patterns are typically only supported via ServiceWorkerRegistration.showNotification().
            new Notification(title, {
                body,
                icon: '/icon-192.png',
                data: { url }
            });
        }
    }
};