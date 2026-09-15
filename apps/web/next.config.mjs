/** @type {import('next').NextConfig} */
const nextConfig = {
  // Imagem Docker final bem menor (só o necessário pra rodar `node server.js`),
  // sem precisar copiar node_modules inteiro nem o resto do monorepo.
  output: 'standalone',
};

export default nextConfig;
