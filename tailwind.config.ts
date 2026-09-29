import type { Config } from 'tailwindcss';

// Tokens from the InstaReport design system (Stitch). Every size is in px so
// layouts don't shift with the browser's root font size.
const px = (values: number[]) => Object.fromEntries(values.map((v) => [String(v), `${v}px`]));

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    screens: { sm: '640px', md: '769px', lg: '1025px', xl: '1280px', '2xl': '1536px' },
    spacing: {
      0: '0px',
      px: '1px',
      ...px([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 64, 72, 80, 96, 112, 128, 160, 192, 240, 256, 280, 320]),
    },
    borderRadius: { none: '0px', sm: '2px', DEFAULT: '4px', md: '6px', lg: '8px', xl: '12px', '2xl': '16px', full: '9999px' },
    fontSize: {
      'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.05em', fontWeight: '500' }],
      'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '500' }],
      'body-sm': ['13px', { lineHeight: '18px' }],
      'body-md': ['14px', { lineHeight: '20px' }],
      'body-lg': ['16px', { lineHeight: '24px' }],
      'headline-sm': ['18px', { lineHeight: '24px', fontWeight: '600' }],
      'headline-md': ['24px', { lineHeight: '32px', fontWeight: '600' }],
      'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' }],
      'headline-xl': ['40px', { lineHeight: '48px', letterSpacing: '-0.02em', fontWeight: '700' }],
      'display': ['56px', { lineHeight: '64px', letterSpacing: '-0.02em', fontWeight: '700' }],
    },
    extend: {
      fontFamily: { sans: ['var(--font-inter)', 'system-ui', 'sans-serif'] },
      maxWidth: px([240, 320, 360, 420, 480, 560, 640, 720, 800, 960, 1120, 1280, 1440]),
      minWidth: px([0, 160, 200, 240]),
      width: px([16, 18, 20, 24, 32, 36, 40, 44, 48, 56, 64, 280]),
      height: px([16, 18, 20, 24, 32, 36, 40, 44, 48, 56, 64]),
      colors: {
        canvas: '#0b1326',
        'canvas-deep': '#060e20',
        surface: { low: '#131b2e', DEFAULT: '#171f33', high: '#222a3d', highest: '#2d3449' },
        ink: { DEFAULT: '#dae2fd', muted: '#cbc3d7', subtle: '#958ea0', faint: '#6b6679' },
        line: { DEFAULT: 'rgba(255,255,255,0.08)', strong: '#494454' },
        primary: { DEFAULT: '#d0bcff', strong: '#a078ff', deep: '#6d3bd7', on: '#23005c' },
        accent: { DEFAULT: '#ffb0cd', strong: '#ec4899' },
        info: '#adc6ff',
        success: '#4ade80',
        warning: '#fbbf24',
        danger: '#ffb4ab',
      },
      boxShadow: {
        glow: '0px 8px 32px rgba(139, 92, 246, 0.15)',
        card: '0px 1px 2px rgba(0, 0, 0, 0.3)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #a078ff 0%, #ec4899 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
