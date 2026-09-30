import 'server-only';
import { secretOverride } from '@/lib/secrets';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value || value.startsWith('your_')) {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value;
};

// Read lazily so importing a module never throws during `next build`.
export const env = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL');
  },
  get supabaseAnonKey() {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  },
  get supabaseServiceRoleKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get apifyToken() {
    return secretOverride('apify_token') ?? required('APIFY_API_TOKEN');
  },
  get apifyActorId() {
    return process.env.APIFY_INSTAGRAM_SCRAPER_ACTOR_ID || 'apify/instagram-scraper';
  },
  get anthropicKey() {
    return secretOverride('anthropic_key') ?? required('ANTHROPIC_API_KEY');
  },
};
