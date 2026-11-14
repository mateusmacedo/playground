//@ts-check
const { join } = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // WHY: o build standalone é o artefato de deploy na AWS (Lambda ou container); a raiz do rastreio é a do
  // monorepo para levar as dependências do workspace pnpm junto.
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../..'),
  // WHY: a partir do 16.4 o dev server responde 403 a /_next/* vindo de origem fora da lista (só localhost por padrão);
  // o e2e local acessa por 127.0.0.1. Vale só em desenvolvimento.
  allowedDevOrigins: ['127.0.0.1'],
  sassOptions: {
    quietDeps: true,
  },
};

module.exports = nextConfig;
