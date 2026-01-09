
// Credentials provided by user
export const SUPABASE_URL = 'https://fopcwaffkdolqwuzjkzy.supabase.co';
export const REAL_SUPABASE_API_URL = 'https://fopcwaffkdolqwuzjkzy.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_fts0uYLymGEA55GA2MEm4A_zSnA0enu';

// Zvonobot
export const ZVONOBOT_API_KEY = 'YOUR_ZVONOBOT_API_KEY_HERE';

// Prices
export const HOURLY_RATE_WORKER = 400;
export const HOURLY_RATE_CLIENT = 520;
export const MIN_HOURLY_RATE_CLIENT = 450; // Минимальная цена, установленная админом

// Feature Flags
/**
 * ВАЖНО: Установлено в true, так как текущая схема Supabase в проекте пользователя 
 * не содержит необходимых колонок (datetime, claimed_by, is_read и др.) или таблиц (customers).
 * Приложение будет использовать LocalStorage как надежную базу данных.
 */
export const USE_MOCK_DATA = false;
