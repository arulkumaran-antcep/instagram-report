import type { Config } from 'tailwindcss';

// Tokens from the InstaReport design system (Stitch). Every size is in px so
// layouts don't shift with the browser's root font size.
// Colours are CSS variables (see globals.css) so light and dark themes share one set of class names.
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;
const px = (values: number[]) => Object.fromEntries(values.map((v) => [String(v), `${v}px`]));

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    screens: { sm: '640px', md: '769px', lg: '1025px', xl: '1280px', '2xl': '1536px' },
    spacing: {
      0: '0px',
      px: '1px',
      ...px([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 64, 72, 80, 96, 112, 120, 128, 160, 192, 240, 256, 280, 320]),
    },
    borderRadius: { none: '0px', sm: '2px', DEFAULT: '4px', md: '6px', lg: '8px', xl: '12px', '2xl': '16px', full: '9999px' },
    fontSize: {
      'label-sm': ['var(--fs-label-sm)', { lineHeight: '14px', letterSpacing: '0.05em', fontWeight: '500' }],
      'label-md': ['var(--fs-label-md)', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '500' }],
      'body-sm': ['var(--fs-body-sm)', { lineHeight: 'var(--lh-body-sm)' }],
      'body-md': ['var(--fs-body-md)', { lineHeight: 'var(--lh-body-md)' }],
      'body-lg': ['var(--fs-body-lg)', { lineHeight: 'var(--lh-body-lg)' }],
      'headline-sm': ['var(--fs-headline-sm)', { lineHeight: 'var(--lh-headline-sm)', fontWeight: '600' }],
      'headline-md': ['var(--fs-headline-md)', { lineHeight: 'var(--lh-headline-md)', fontWeight: '600' }],
      'headline-lg': ['var(--fs-headline-lg)', { lineHeight: 'var(--lh-headline-lg)', letterSpacing: '-0.01em', fontWeight: '600' }],
      'headline-xl': ['var(--fs-headline-xl)', { lineHeight: 'var(--lh-headline-xl)', letterSpacing: '-0.02em', fontWeight: '700' }],
      display: ['var(--fs-display)', { lineHeight: 'var(--lh-display)', letterSpacing: '-0.02em', fontWeight: '700' }],
    },
    extend: {
      fontFamily: { sans: ['var(--font-inter)', 'system-ui', 'sans-serif'] },
      maxWidth: px([240, 320, 360, 420, 480, 560, 640, 720, 800, 960, 1120, 1280, 1440]),
      minWidth: px([0, 160, 200, 240]),
      width: px([16, 18, 20, 24, 32, 36, 40, 44, 48, 56, 64, 280]),
      height: px([16, 18, 20, 24, 32, 36, 40, 44, 48, 56, 64]),
      colors: {
        canvas: c('canvas'),
        'canvas-deep': c('canvas-deep'),
        surface: { low: c('surface-low'), DEFAULT: c('surface'), high: c('surface-high'), highest: c('surface-highest') },
        ink: { DEFAULT: c('ink'), muted: c('ink-muted'), subtle: c('ink-subtle'), faint: c('ink-faint') },
        line: { DEFAULT: c('line'), strong: c('line-strong') },
        primary: { DEFAULT: c('primary'), strong: c('primary-strong'), deep: c('primary-deep'), on: c('primary-on') },
        accent: { DEFAULT: c('primary'), strong: c('primary-strong') },
        info: c('info'),
        success: c('success'),
        warning: c('warning'),
        danger: c('danger'),
      },
      boxShadow: {
        glow: 'var(--shadow-raised)',
        card: 'var(--shadow-card)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, var(--brand-a) 0%, var(--brand-b) 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
