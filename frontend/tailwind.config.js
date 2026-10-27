// Theme: "Tricolour Restrained". Values live in src/index.css as CSS variables; Tailwind only references them.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // brand
        navy: { 50: 'var(--navy-50)', 700: 'var(--navy-700)', 900: 'var(--navy-900)' },
        saffron: 'var(--saffron)',
        'india-green': 'var(--india-green)',
        white: 'var(--white)',
        // neutrals
        background: 'var(--bg)',
        card: 'var(--surface)',
        ink: 'var(--ink)',
        foreground: 'var(--ink)',
        'muted-foreground': 'var(--muted)',
        border: 'var(--border)',
        // semantic aliases used across components
        primary: 'var(--navy-700)',
        'primary-foreground': 'var(--white)',
        accent: 'var(--navy-50)',
        muted: 'var(--navy-50)',
        destructive: 'var(--danger)',
        // status colours (same meaning everywhere) and their light tints
        ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)', paused: 'var(--paused)',
        'ok-tint': 'var(--ok-tint)', 'warn-tint': 'var(--warn-tint)', 'danger-tint': 'var(--danger-tint)', 'paused-tint': 'var(--paused-tint)',
      },
      fontFamily: {
        sans: ['"Noto Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        display: ['"Noto Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      borderRadius: { sm: '2px', DEFAULT: '4px', md: '4px', lg: '4px', xl: '6px', '2xl': '6px', '3xl': '6px' },
      boxShadow: { sm: '0 1px 2px 0 var(--shadow)', DEFAULT: '0 1px 2px 0 var(--shadow)', md: '0 2px 6px 0 var(--shadow)' },
      // Calm, official motion: short fades and slides (150-250 ms, ease-out), no bounce. transform + opacity only.
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        pageIn: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        msgIn: { from: { opacity: '0', transform: 'translateY(-3px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' }, '20%': { transform: 'translateX(-4px)' }, '40%': { transform: 'translateX(4px)' },
          '60%': { transform: 'translateX(-3px)' }, '80%': { transform: 'translateX(2px)' },
        },
        settle: { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        leave: { from: { opacity: '1', transform: 'translateY(0)' }, to: { opacity: '0', transform: 'translateY(-4px)' } },
      },
      animation: {
        rise: 'rise 240ms ease-out backwards',
        'fade-in': 'fadeIn 200ms ease-out backwards',
        'page-in': 'pageIn 220ms ease-out backwards',
        'msg-in': 'msgIn 160ms ease-out backwards',
        shake: 'shake 300ms ease-in-out',
        pop: 'settle 200ms ease-out backwards',
        leave: 'leave 220ms ease-in forwards',
      },
    },
  },
  plugins: [],
}
