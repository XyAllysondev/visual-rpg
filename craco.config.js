// CRACO — injeta o Tailwind no pipeline PostCSS do CRA sem `eject` (react-scripts 5
// não lê tailwind.config.js sozinho) e registra o alias `@` → src (usado pelo shadcn).
// Ver ADR-0007 (adoção aditiva de Tailwind+shadcn).
const path = require('path');
module.exports = {
  style: {
    postcss: {
      plugins: [require('tailwindcss'), require('autoprefixer')],
    },
  },
  webpack: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
};
