'use client';

import { useState } from 'react';
import { Search, UploadCloud } from 'lucide-react';
import { GenerateForm } from '@/components/GenerateForm';
import { UploadForm } from '@/components/UploadForm';
import { cx } from '@/components/ui';

const TABS = [
  { key: 'username', label: 'From a username', icon: Search },
  { key: 'upload', label: 'Upload an export', icon: UploadCloud },
] as const;

export function GenerateTabs() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('username');
  return (
    <div>
      <div role="tablist" aria-label="Data source" className="mx-auto mb-20 flex w-full max-w-420 gap-4 rounded-xl bg-canvas-deep p-4">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            type="button"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            onClick={() => setTab(key)}
            className={cx(
              'flex h-40 flex-1 items-center justify-center gap-8 rounded-lg text-body-sm font-medium transition-colors',
              tab === key ? 'bg-surface-highest text-ink' : 'text-ink-subtle hover:text-ink',
            )}
          >
            <Icon className="h-16 w-16" aria-hidden /> {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'username' ? <GenerateForm /> : <UploadForm />}
      </div>
    </div>
  );
}
