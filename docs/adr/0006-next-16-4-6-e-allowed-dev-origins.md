# ADR 0006: Next.js 16.4.6 por segurança e o efeito do `allowedDevOrigins`

- **Status**: Aceito
- **Data**: 2026-11-14

## Contexto

O backoffice nasceu em uma versão do Next.js anterior à 16.4.6. A análise de dependências do **Red Hat Dependency Analytics** apontou **32 vulnerabilidades** nessa versão. A atualização para a linha 16.4.6 foi feita por esse motivo.

A mudança de minor traz um efeito colateral: a partir do Next.js 16.4, o servidor de desenvolvimento responde **403** a requisições de `/_next/*` cuja origem não esteja em `allowedDevOrigins` (por padrão, só `localhost`). O e2e local abre o painel por `http://127.0.0.1:3000`, e sem a exceção o dev server responderia 403 aos recursos `/_next/*` dessa origem.

## Decisão

- Fixar `next` em `~16.4.6` (aceita só patches da 16.4). A versão fica no catálogo do pnpm. Os pacotes de ESLint do Next saíram do repositório com o [ADR 0007](./0007-lint-e-formatacao-biome-eslint-minimo.md): o lint de Next é do Biome (domínio `next`).
- Declarar `allowedDevOrigins: ['127.0.0.1']` em `apps/backoffice/next.config.js`, com um comentário `WHY:` explicando o motivo.
- Manter a configuração restrita a `127.0.0.1`. Não usar curinga nem liberar a rede local: a lista existe justamente para não aceitar qualquer origem.

## Consequências

- **Ganhos**: o painel sai da versão apontada pela análise de segurança; o e2e local continua acessando o dev server por `127.0.0.1`.
- **Escopo do `allowedDevOrigins`**: vale **só no `next dev`**. O CI roda o e2e contra `nx run backoffice:start` (build de produção), em `http://localhost:3000`, então nada muda ali. Acessar o dev server por outro host (IP da rede, túnel, container) exige acrescentar o host à lista, e o sintoma é um 403 em `/_next/*`.
- **Cuidado com bumps**: o Next.js muda APIs e convenções entre minors. O `apps/backoffice/AGENTS.md` manda ler `node_modules/next/dist/docs/` antes de escrever código; faça o mesmo antes de subir a versão.
- **Gatilho de revisão**: nova rodada de avisos de segurança, ou o Renovate propor a 16.5 ou a 17.
