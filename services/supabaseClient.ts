import { createClient } from '@supabase/supabase-js';
import { REAL_SUPABASE_API_URL, SUPABASE_KEY } from '../constants';

// We initialize the client but we might not use it if USE_MOCK_DATA is true.
export const supabase = createClient(REAL_SUPABASE_API_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});