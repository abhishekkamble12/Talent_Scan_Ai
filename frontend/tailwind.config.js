/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        root: 'var(--bg-root)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        overlay: 'var(--bg-overlay)',
        subtle: 'var(--border-subtle)',
        muted: 'var(--border-strong)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          tint: 'var(--accent-tint)',
          border: 'var(--accent-border)',
        },
        status: {
          error: 'var(--status-error)',
          'error-bg': 'var(--status-error-bg)',
          'error-border': 'var(--status-error-border)',
          warning: 'var(--status-warning)',
          'warning-bg': 'var(--status-warning-bg)',
          'warning-border': 'var(--status-warning-border)',
          success: 'var(--accent)',
          'success-bg': 'var(--accent-tint)',
          'success-border': 'var(--accent-border)',
        }
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
      fontSize: {
        'micro': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.04em' }], // 12px
        'xs': ['0.8125rem', { lineHeight: '1.25rem' }],                       // 13px
        'sm': ['0.875rem', { lineHeight: '1.4rem' }],                          // 14px
        'base': ['1rem', { lineHeight: '1.6rem' }],                            // 16px
        'lg': ['1.0625rem', { lineHeight: '1.5rem', letterSpacing: '-0.015em' }], // 17px
        'xl': ['1.5rem', { lineHeight: '1.75rem', letterSpacing: '-0.025em' }],   // 24px
        '2xl': ['1.875rem', { lineHeight: '2.1rem', letterSpacing: '-0.03em' }],  // 30px
      }
    },
  },
  plugins: [],
}
