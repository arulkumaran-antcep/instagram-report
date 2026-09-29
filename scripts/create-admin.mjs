// Creates the first admin account. Run once: npm run create-admin
// Prints a temporary password; you choose your own on first sign-in.
import { createInterface } from 'node:readline/promises';
import { randomInt } from 'node:crypto';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const rl = createInterface({ input: process.stdin, output: process.stdout });

const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
const group = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('');
let password;
do password = `${group()}-${group()}-${group()}`;
while (!/\d/.test(password) || !/[a-z]/.test(password));

try {
  const { error: tableError } = await db.from('members').select('user_id', { head: true, count: 'exact' });
  if (tableError) throw new Error('The members table is missing. Run supabase/migrations/001_production_schema.sql first.');

  const fullName = (await rl.question('Your full name: ')).trim();
  const email = (await rl.question('Your work email: ')).trim().toLowerCase();
  if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a name and a valid email.');

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { must_change_password: true },
  });
  if (error) throw new Error(`Could not create the account: ${error.message}`);

  const { error: memberError } = await db.from('members').insert({ user_id: data.user.id, email, full_name: fullName, role: 'admin' });
  if (memberError) {
    await db.auth.admin.deleteUser(data.user.id);
    throw new Error(`Could not add you to the team: ${memberError.message}`);
  }

  console.log('\nAdmin account created.');
  console.log(`  Email:              ${email}`);
  console.log(`  Temporary password: ${password}`);
  console.log('\nStart the app (npm run dev), sign in with these, and choose your own password.');
} catch (e) {
  console.error(`\n${e.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
