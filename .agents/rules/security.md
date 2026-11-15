---
paths:
  - "apps/**"
  - "tools/**"
  - "infra/**"
  - ".github/**"
---

# Segurança

Revisão de segurança: agente `security`. As regras OBRIGATÓRIAS de segredo, `.env` e Floci estão no `AGENTS.md` da raiz; as do painel (`NEXT_PUBLIC_*`, `app-config.ts`, menu e sessão), no `AGENTS.md` do backoffice; a leitura de configuração no serviço, no `AGENTS.md` de `apps/services`. Para o que não pode vazar em resposta e log, veja a rule `error-handling` e a `skill-error-handling`; para o painel, a `skill-react-best-practices`.

## Segredos

- Segredo de verdade mora no **Secrets Manager**. O SSM do bootstrap local guarda `String` **sem criptografia**: só configuração, nunca credencial ([ADR 0004](../../docs/adr/0004-serverless-e-terraform.md)).
- Nunca grave credencial, token ou chave em código, teste, `serverless.yml`, workflow ou log.

## Autenticação e autorização

- Autorização de verdade é do **servidor**: a checagem fica na rota, no handler ou na Server Action, a cada uso.
- Valide o token em um ponto central (middleware, authorizer ou camada de entrada), não em cada endpoint. Nunca confie em papel ou permissão vindos do cliente.

## Entrada e saída

- Valide toda entrada na fronteira (entrypoint, rota, Server Action) com schema explícito; o núcleo recebe dado já validado.
- Sem SQL por concatenação: consulta parametrizada.
- URL de saída vinda de entrada do usuário: valide o destino (SSRF) e bloqueie faixas privadas e de link-local.
- CORS com origens explícitas, usando o domínio customizado (nunca o gerado do CloudFront); `*` não vale com credenciais.

## Infraestrutura e IAM

- Privilégio mínimo: role por serviço, **identity-based**, com os ARNs lidos do SSM; sem `*` em ação ou recurso quando o alvo é conhecido. Permissão em recurso compartilhado de L2 vai na role do serviço, não em resource policy ([ADR 0009](../../docs/adr/0009-camadas-e-ordem-de-implantacao.md)).
- Dado que sobrevive ao código é do Terraform, com `prevent_destroy`; um `serverless remove` nunca apaga dado ([ADR 0004](../../docs/adr/0004-serverless-e-terraform.md)).
- Não leia o state de outro lado; o contrato é o SSM.

## CI e dependências

- Permissões do `GITHUB_TOKEN` no mínimo (`contents: read` por padrão; `write` só no job que precisa, como nos workflows existentes). O pinning por SHA está no `AGENTS.md` da raiz.
- Dependência nova passa pelo Renovate, além do catálogo do pnpm.
- Imagem de container: base mínima fixada por `tag@digest`, processo não-root com UID numérico, sem segredo em camada nem em `ARG`.
