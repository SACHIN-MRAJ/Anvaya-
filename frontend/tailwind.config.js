/** @type {import('tailwindcss').Config} */
export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{ts,tsx}'] },
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
      },
      colors: {
        /* ── Primary brand: driven by CSS variables so themes swap at runtime ── */
        brand: {
          50:  'rgb(var(--br50)  / <alpha-value>)',
          100: 'rgb(var(--br100) / <alpha-value>)',
          200: 'rgb(var(--br200) / <alpha-value>)',
          300: 'rgb(var(--br300) / <alpha-value>)',
          400: 'rgb(var(--br400) / <alpha-value>)',
          500: 'rgb(var(--br500) / <alpha-value>)',
          600: 'rgb(var(--br600) / <alpha-value>)',
          700: 'rgb(var(--br700) / <alpha-value>)',
          800: 'rgb(var(--br800) / <alpha-value>)',
          900: 'rgb(var(--br900) / <alpha-value>)',
          950: 'rgb(var(--br950) / <alpha-value>)',
        },
        /* ── Warm saffron (kept for legacy accents) ── */
        saffron: { 50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 400: '#FBBF24', 500: '#F59E0B', 600: '#D97706', 700: '#B45309' },
        /* ── Success / approval green ── */
        indgreen: { 50: '#ECFDF5', 100: '#D1FAE5', 400: '#34D399', 500: '#10B981', 600: '#059669', 700: '#047857' },
        /* ── Near-black text ── */
        ink: { DEFAULT: '#09090B', soft: '#3F3F46', mute: '#71717A' },
        /* ── Page background ── */
        canvas: '#FAFAFA',
        /* ── Dark charcoal surfaces (GovBar, sidebar, dark panels) ── */
        surface: {
          DEFAULT: '#111111',
          50:  '#F9F9F9',
          100: '#F0F0F0',
          200: '#E4E4E4',
          300: '#BFBFBF',
          400: '#8C8C8C',
          500: '#595959',
          600: '#404040',
          700: '#262626',
          800: '#1A1A1A',
          900: '#141414',
          950: '#0A0A0A',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(9, 9, 11, 0.04), 0 2px 8px -2px rgba(9, 9, 11, 0.06)',
        lift: '0 18px 40px -18px rgba(180, 83, 9, 0.18)',
        glow: '0 0 0 1px rgba(255,255,255,0.08), 0 20px 50px -20px rgba(217, 119, 6, 0.55)',
        amber: '0 0 32px rgba(217,119,6,0.35)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.15)',
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.25rem', '3xl': '1.75rem' },
      keyframes: {
        shimmer:   { '100%': { transform: 'translateX(100%)' } },
        float:     { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        floatslow: { '0%,100%': { transform: 'translateY(0) rotate(0deg)' }, '50%': { transform: 'translateY(-12px) rotate(1.5deg)' } },
        floatalt:  { '0%,100%': { transform: 'translateY(0) rotate(0deg)' }, '50%': { transform: 'translateY(10px) rotate(-1deg)' } },
        dash:      { to: { strokeDashoffset: '-40' } },
        gradientx: { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        ring:      { '0%': { transform: 'scale(0.8)', opacity: '0.7' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
        marquee:   { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        glow:      { '0%,100%': { boxShadow: '0 0 20px rgba(217,119,6,0.3)' }, '50%': { boxShadow: '0 0 40px rgba(217,119,6,0.6)' } },
        fadeup:    { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        shimmer:   'shimmer 1.6s infinite',
        float:     'float 5s ease-in-out infinite',
        floatslow: 'floatslow 7s ease-in-out infinite',
        floatalt:  'floatalt 6s ease-in-out infinite',
        dash:      'dash 1.6s linear infinite',
        gradientx: 'gradientx 8s ease infinite',
        ring:      'ring 1.8s cubic-bezier(0, 0, 0.2, 1) infinite',
        marquee:   'marquee 40s linear infinite',
        glow:      'glow 3s ease-in-out infinite',
        fadeup:    'fadeup 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};
