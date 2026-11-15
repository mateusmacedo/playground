# Fitness functions do playground

Complemento de `SKILL.md`. Cada seção diz o status: **Existe** (está no repositório), **Padrão a seguir** (não existe; trecho verificado ou esboço) ou **Roadmap** (ADR aceito, sem implementação).

Toda fitness function roda no gate que já existe: `pnpm nx affected -t lint typecheck test` no `pre-push` e no PR, e tudo no release (`pnpm check:full`). Veja `AGENTS.md`, seção "Comandos de validação".

## 1. Núcleo puro em TypeScript (Padrão a seguir)

O `@nx/enforce-module-boundaries` olha **entre projetos do Nx**. O `src/core` de um serviço é uma pasta dentro do mesmo projeto, então o ESLint do Nx não o enxerga. Quem fiscaliza pasta é o Biome, com um `override` no `biome.json` da raiz (hoje o arquivo não tem `overrides`). Este trecho foi testado com o Biome 2.6 do repositório:

```json
{
  "overrides": [
    {
      "includes": ["apps/services/*/src/core/**"],
      "linter": {
        "rules": {
          "style": {
            "noRestrictedImports": {
              "level": "error",
              "options": {
                "paths": {
                  "aws-lambda": "O núcleo não conhece o runtime.",
                  "fastify": "O núcleo não conhece o runtime."
                },
                "patterns": [
                  {
                    "group": ["@nestjs/*", "@aws-sdk/*", "../entrypoints/*"],
                    "message": "O núcleo não importa framework, SDK nem entrypoint."
                  }
                ]
              }
            }
          }
        }
      }
    }
  ]
}
```

Notas:

- O `aws-lambda` também cobre `import type`, que é o que o `README` do `example-ts` pede ("sem tipos de `aws-lambda`").
- Acrescente o que o núcleo não deve conhecer conforme o serviço (cliente HTTP, ORM).
- Teste a regra: crie um `bad.ts` em `src/core/` que importe `aws-lambda`, rode `pnpm exec biome lint apps/services` e confirme o erro; depois apague o arquivo com `trash`.

## 2. Núcleo puro em Go (Padrão a seguir)

O compilador já impede import cíclico. Para impedir que `internal/core` dependa do runtime, liste as dependências transitivas do pacote (verificado no `example-go`: o `internal/core` não tem nenhuma, o `cmd/example-go` tem):

```bash
cd apps/services/example-go
if go list -deps ./internal/core | grep -E 'aws-lambda-go|net/http'; then
  echo 'internal/core importa runtime' >&2
  exit 1
fi
```

## 3. Fronteiras do Nx (Existe, permissivo)

`eslint.config.mjs` da raiz tem `depConstraints: [{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }]`: qualquer projeto pode depender de qualquer um. Hoje `packages/` ainda não tem libs, então há pouco o que proteger, mas a regra deve ser apertada **junto** com a primeira lib.

As opções `sourceTag`, `onlyDependOnLibsWithTags`, `notDependOnLibsWithTags`, `allowedExternalImports` e `bannedExternalImports` existem no `@nx/eslint-plugin` 24. Um desenho **a seguir** quando houver libs:

```js
depConstraints: [
  // o painel não importa código de serviço, e o contrário também
  { sourceTag: 'scope:backoffice', notDependOnLibsWithTags: ['platform:serverless'] },
  { sourceTag: 'platform:serverless', notDependOnLibsWithTags: ['scope:backoffice'] },
  // linguagens não se misturam
  { sourceTag: 'stack:ts', notDependOnLibsWithTags: ['stack:go'] },
  { sourceTag: 'stack:go', notDependOnLibsWithTags: ['stack:ts'] },
  // uma lib de núcleo só depende de outro núcleo e não importa runtime
  {
    sourceTag: 'type:core',
    onlyDependOnLibsWithTags: ['type:core'],
    bannedExternalImports: ['aws-lambda', '@aws-sdk/*', 'fastify', '@nestjs/*'],
  },
],
```

As tags `scope:backoffice`, `platform:serverless`, `stack:ts` e `stack:go` existem. `type:core` **não existe**: o `AGENTS.md` pede para usar as tags existentes antes de inventar outras, então só crie essa tag com uma decisão registrada. Projetos de app não podem ser importados por outros projetos (regra `noImportsOfApps` do próprio plugin), o que já cobre "serviço não importa serviço". Rode `pnpm nx affected -t lint` para conferir.

## 4. `pre-deploy` (Existe)

O target `pre-deploy` (executor `validate` do plugin `tools/serverless`, arquivo `src/executors/validate/rules.ts`) valida o `serverless.yml` antes do `package` e do `deploy`: `custom.nxServerless`, `provider.name: aws`, `service` em kebab-case, stage permitido, runtime (`nodejs*` ou o de Go), `package.json` e `tsconfig.json` no serviço TypeScript, `go.mod` no Go, bloqueio de `remove` em `prod` e ausência de `extends`. É cacheado. Todo invariante que se confere olhando o manifesto é candidato a nova regra ali, com teste em `rules.spec.ts`.

## 5. Contrato de container (Padrão a seguir, camada L6)

Esboço de smoke test para a imagem OCI. Não foi executado, porque ainda não existe imagem de serviço. Cobre o contrato do ADR 0008: `PORT`, `/health`, JSON no stdout e `SIGTERM` gracioso.

```bash
#!/usr/bin/env bash
set -euo pipefail
image="$1"
cid=$(docker run -d -e PORT=8080 -p 8080:8080 "$image")
trap 'docker rm -f "$cid" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 30); do
  curl -fsS http://localhost:8080/health >/dev/null && break
  sleep 1
done
curl -fsS http://localhost:8080/health >/dev/null

docker logs "$cid" 2>&1 | while IFS= read -r line; do
  printf '%s' "$line" | jq -e . >/dev/null
done

docker stop -t 10 "$cid" >/dev/null
test "$(docker inspect -f '{{.State.ExitCode}}' "$cid")" = 0
```

Para Lambda o equivalente é um smoke contra o endpoint no Floci depois do deploy. A propriedade stateless não tem smoke automático e fica como item de revisão: o processo não guarda em disco nem em memória nada que mude a resposta conforme a instância.

## 6. Artefato único (Padrão a seguir, camadas L3 e L4)

O ADR 0009 define que L3 produz a imagem tagueada pelo SHA e que ECS e EKS recebem `image_tag=<sha>`. As checagens, quando houver pipeline:

- Só o job de L3 executa `docker build`; nenhum outro job constrói imagem.
- O tag implantado em cada destino é o SHA do commit promovido, e o digest da imagem no ECR é o mesmo em `dev`, `homolog` e `prod`.
- Falha o job se o módulo de serviço (`service-ec2`, `service-ecs` ou `service-eks`) receber um tag que não seja um SHA existente no ECR.

## 7. `contract:check` (Roadmap, ADR 0004)

Target Nx que falha quando um `${ssm:...}` usado em algum `serverless.yml` não existe no catálogo de parâmetros publicado pelo Terraform. Enquanto o Terraform não existe, o catálogo é o que o bootstrap de `infra/local` publica no Floci. Não escreva código que chame `contract:check` antes de ele existir.
