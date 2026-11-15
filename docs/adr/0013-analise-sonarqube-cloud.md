# ADR 0013: Análise do SonarQube Cloud com a cobertura dos testes

- **Status**: Aceito
- **Data**: 2026-11-14

## Contexto

A análise do repositório se resumia ao Biome, ao ESLint (só as fronteiras do Nx), aos compiladores e ao `go vet`. A cobertura dos testes só rodava no `release.yml`, sem relatório consolidado nem acompanhamento do código novo em cada PR. Faltava uma visão única de qualidade e segurança para TypeScript, Go, Java e Terraform antes da primeira release candidate.

O projeto `q-marketplace-nx`, do mesmo autor, já é analisado pelo SonarQube Cloud na organização `mateusmacedo`, com um workflow próprio e a cobertura de cada linguagem. O playground é público, o que cabe no plano gratuito do SonarQube Cloud.

## Decisão

O repositório passa a ser analisado pelo **SonarQube Cloud**, na organização `mateusmacedo`, projeto `mateusmacedo_playground`, com a análise feita pelo GitHub Actions.

- **Workflow próprio**: `.github/workflows/sonar.yml` fica fora dos checks do PR. O quality gate chega ao PR pelo app do SonarQube Cloud, e uma indisponibilidade do serviço não bloqueia o merge. No PR, só os projetos afetados rodam os testes; a análise completa da `main` é semanal ou manual.
- **Cobertura por linguagem**: o Vitest roda com `--coverage.enabled --coverage.reporter=lcov`, e o workflow reescreve os caminhos do lcov para a raiz do repositório; o Go roda com `go test -coverprofile`; o Java usa o JaCoCo, ativado no `build.gradle` da raiz só com `-Pcoverage`, mais o `quarkus-jacoco` nos projetos Quarkus, porque o agente do JaCoCo não mede as classes do `@QuarkusTest`.
- **Configuração**: o `sonar-project.properties` declara fontes, testes, exclusões (templates do gerador do `nx-serverless` e saídas de build) e os relatórios de TypeScript e Java. O workflow passa o que depende do runner: o bytecode do Java, as bibliotecas do cache do Gradle e os relatórios do Go.
- **Fora do repositório**: importar o repositório na organização do SonarQube Cloud, escolher a análise pelo GitHub Actions, desligar a análise automática (ela recusa a análise vinda do CI quando ligada) e gravar o token no secret `SONAR_TOKEN`.

Alternativas descartadas:

- **SonarQube Server próprio**: o runner do GitHub não alcança um servidor local, e manter um servidor exposto custa mais que o plano gratuito.
- **Só o SonarLint no editor**: não dá quality gate nem histórico de cobertura no PR.

## Consequências

- **Ganhos**: achados de qualidade e de segurança em TypeScript, Go, Java, Terraform e CSS, com o quality gate e a cobertura do código novo no PR.
- **Custos e riscos**: um serviço externo e um secret; o PR repete os testes dos projetos afetados, agora com cobertura; um projeto novo com outra estrutura de pastas pode exigir ajuste nos caminhos de cobertura.
- **Gatilho de revisão**: o repositório virar privado (o SonarQube Cloud passa a cobrar) ou a decisão de bloquear o merge pelo quality gate.
