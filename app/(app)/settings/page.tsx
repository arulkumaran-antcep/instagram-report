import type { Metadata } from 'next';
import { Database, KeyRound, ShieldCheck, UserRound, Users } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { Card, CardHeader, PageHeader } from '@/components/ui';
import { PasswordForm } from '@/components/PasswordForm';
import { ProfileForm } from '@/components/settings/ProfileForm';
import { TeamManager, type TeamMember } from '@/components/settings/TeamManager';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const member = await requireMember();
  const { data } = await adminDb().from('members').select('user_id, email, full_name, role, created_at').order('created_at');
  const team: TeamMember[] = (data ?? []).map((m) => ({ userId: m.user_id, email: m.email, fullName: m.full_name, role: m.role, createdAt: m.created_at }));

  return (
    <div>
      <PageHeader eyebrow="Preferences & access" title="Settings" description="Your profile, password and the team who can use InstaReport." />
      <div className="grid gap-24 xl:grid-cols-2 md:gap-32">
        <Card>
          <CardHeader title="Your profile" description="Your name appears on reports you generate." />
          <div className="p-20 md:p-24">
            <div className="mb-16 flex items-center gap-8 text-body-sm text-ink-subtle">
              <UserRound className="h-16 w-16" aria-hidden /> {member.email} · <span className="capitalize">{member.role}</span>
            </div>
            <ProfileForm initialName={member.fullName} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Password" description="Use at least 12 characters, including a letter and a number." />
          <div className="p-20 md:p-24">
            <div className="mb-16 flex items-center gap-8 text-body-sm text-ink-subtle">
              <KeyRound className="h-16 w-16" aria-hidden /> Changing it doesn’t sign you out of this device.
            </div>
            <PasswordForm mode="change" />
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Team"
            description={member.role === 'admin' ? 'Add teammates, change roles, reset passwords or remove access.' : 'People who can use InstaReport. Ask an admin to add someone.'}
            action={<Users className="h-20 w-20 text-ink-subtle" aria-hidden />}
          />
          <TeamManager members={team} currentUserId={member.userId} isAdmin={member.role === 'admin'} />
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Data & compliance" description="How InstaReport handles data. Share this with anyone who asks." action={<ShieldCheck className="h-20 w-20 text-ink-subtle" aria-hidden />} />
          <ul className="grid gap-16 p-20 md:grid-cols-2 md:p-24">
            {[
              ['Public data only', 'Posts and profile details anyone can see without an account. Collection runs without logging in to Instagram, so no company account is involved. Private accounts are refused.'],
              ['No third-party data kept', 'Commenters’ names and comments are discarded before anything is stored, and the raw scrape is deleted from Apify right after collection.'],
              ['Images not stored', 'Post images are shrunk in memory so the AI can categorise them, then discarded. Reports link to posts instead of copying images.'],
              ['Private files', 'PDFs and workbooks are stored privately and downloaded through links that expire after 60 seconds, for signed-in team members only.'],
              ['Checked figures', 'All metrics are calculated by code. The AI only writes the commentary, and every figure it writes is checked against the data before publishing.'],
              ['Internal use', 'Reports are for internal research. Get approval before sharing one outside the company.'],
            ].map(([title, text]) => (
              <li key={title} className="flex gap-12">
                <Database className="mt-2 h-16 w-16 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block text-body-md font-semibold text-ink">{title}</span>
                  <span className="mt-2 block text-body-sm text-ink-subtle">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
