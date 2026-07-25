/** @type {import('tailwindcss').Config} */
// ADR-0007: Tailwind entra ADITIVO. preflight DESLIGADO — o reset global do Tailwind
// quebraria o visual de todo o app inline-styled/CSS-vars existente. Assim as utilities
// e os componentes shadcn convivem com o CSS atual sem resetar nada.
module.exports = {
  darkMode: ['class'],
  corePlugins: { preflight: false },
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--sh-border))',
        input: 'hsl(var(--sh-input))',
        ring: 'hsl(var(--sh-ring))',
        background: 'hsl(var(--sh-background))',
        foreground: 'hsl(var(--sh-foreground))',
        primary: { DEFAULT: 'hsl(var(--sh-primary))', foreground: 'hsl(var(--sh-primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--sh-secondary))', foreground: 'hsl(var(--sh-secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--sh-destructive))', foreground: 'hsl(var(--sh-destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--sh-muted))', foreground: 'hsl(var(--sh-muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--sh-accent))', foreground: 'hsl(var(--sh-accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--sh-popover))', foreground: 'hsl(var(--sh-popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--sh-card))', foreground: 'hsl(var(--sh-card-foreground))' },
      },
      borderRadius: {
        lg: 'var(--sh-radius)',
        md: 'calc(var(--sh-radius) - 2px)',
        sm: 'calc(var(--sh-radius) - 4px)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
