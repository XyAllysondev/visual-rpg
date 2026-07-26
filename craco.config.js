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
  // public/ tem milhares de assets estáticos (bestiary-tokens, token-builder);
  // vigiá-los estoura os file-watchers no Windows e mata o dev server minutos
  // após compilar. Servir sem watch resolve — os assets não mudam em runtime.
  devServer: (config) => {
    const publicDir = path.join(__dirname, 'public');
    const norm = (s) => {
      if (typeof s === 'string') return { directory: s, watch: false };
      if (s && typeof s === 'object') return { ...s, watch: false };
      return { directory: publicDir, watch: false };   // static indefinido → aponta pro public
    };
    config.static = Array.isArray(config.static) && config.static.length
      ? config.static.map(norm)
      : [norm(config.static)];
    return config;
  },
};
