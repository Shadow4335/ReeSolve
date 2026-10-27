export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        border: 'var(--border)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        accent: 'var(--accent)',
        sidebar: 'var(--sidebar)',
        'sidebar-accent': 'var(--sidebar-accent)',
        destructive: 'var(--destructive)',
        peach: 'var(--peach)',
        'peach-foreground': 'var(--peach-foreground)',
        warn: 'var(--warn)',
        'warn-foreground': 'var(--warn-foreground)',
        danger: 'var(--danger)',
        'danger-foreground': 'var(--danger-foreground)',
      },
      fontFamily: {
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      borderRadius: { xl: '1rem', '2xl': '1.25rem' },
    },
  },
  plugins: [],
}
