# ADR 0015: Metas de qualidade e gate obrigatório do SonarQube

- **Status**: Aceito
- **Data**: 2026-11-15

## Contexto

O [ADR 0013](./0013-analise-sonarqube-cloud.md) trouxe a análise do SonarQube Cloud, mas deixou o gate fora dos checks obrigatórios: um PR com o gate vermelho ainda podia entrar. A primeira análise da `main` mostrou nota E em segurança, D em confiabilidade e 56,6% de cobertura de linhas.

O dono do projeto definiu as metas e uma regra de conduta:

- todas as notas do Sonar em A, cobertura de linhas e de ramos acima de 90% e no máximo 3% de duplicação;
- nenhum contorno no Sonar: achado não é marcado como falso positivo nem como aceito, e regra não é desligada nem suprimida. A correção é sempre na causa, por mais simples que seja;
- histórico linear na `main`, preservando a data de autoria dos commits.

O plano gratuito do SonarQube Cloud não permite quality gate próprio: só o "Sonar way", que olha o código novo (cobertura mínima de 80%).

## Decisão

- **Metas cobradas no repositório**: cada projeto falha abaixo de 90% em linhas e ramos (thresholds do Vitest, `jacocoTestCoverageVerification` no Java e a checagem do Go no `sonar.yml`), como descreve a rule `testing-conventions`.
- **Gate do PR**: o `sonar.yml` roda em todo PR, sem filtro de caminho, e espera o resultado do gate (`sonar.qualitygate.wait`); gate vermelho reprova o job `Análise`.
- **Metas gerais na `main`**: a cada push na `main`, o `tools/sonar/check-quality-gate.sh` confere o projeto inteiro: gate OK, notas A, cobertura acima de 90% e duplicação até 3%. O `release.yml` roda a mesma conferência, exigindo que a última análise seja do commit que vira versão.
- **Ruleset na `main`**: exige PR, os checks `Checks`, `E2E`, `Format`, `actionlint + pinning + renovate-config` e `Análise`, histórico linear, e bloqueia force push e remoção. O merge é só por rebase, o que preserva a data de autoria. A única exceção do ruleset é o GitHub Actions, para o `nx release` gravar o commit de versão e as tags.
- **Exclusões que continuam**: os templates do gerador (não são código válido antes da geração), os assets de IA gerados pelo `nx configure-ai-agents`, e os arquivos de configuração e o Terraform fora da cobertura. Nenhuma exclusão serve para esconder um achado.

## Consequências

- **Ganhos**: a `main` não recebe código que derrube nota, cobertura ou duplicação, e nenhuma versão sai fora das metas.
- **Custos e riscos**: uma indisponibilidade do SonarQube Cloud bloqueia o merge e o release; cada push na `main` roda todos os testes com cobertura; não há mais force push na `main`, nem para o dono.
- **Gatilho de revisão**: plano pago do SonarQube Cloud (as metas viram um quality gate próprio) ou um release que precise publicar sem passar pela `main`.
