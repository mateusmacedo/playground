# Imagem do modo container do example-quarkus (ECS, EKS ou EC2): fast-jar do
# Quarkus em JVM, com `-Pruntime=container` (ADR 0008). O contexto é a raiz do
# workspace: `pnpm nx docker:build example-quarkus`.
#
# WHY: o jar sai de um Gradle dentro da imagem, não do build do Nx, que gera o
# zip de Lambda na mesma pasta `build/` e seria sobrescrito ao trocar o runtime.
# NOTE: sem `# syntax=`: o frontend do BuildKit do Docker 29 já cobre
# `--mount=type=cache`, e a diretiva puxaria uma imagem sem digest a cada build.

FROM eclipse-temurin:21-jdk-noble@sha256:06c1f157dacf6b68198bd9a4186dd4c34ef24e65d7bbbe2a0cf8e62571ad38c9 AS build

WORKDIR /workspace

# WHY: o Gradle da raiz e os build.gradle vêm antes do código-fonte; mudar um
# .java não invalida a camada do wrapper nem a resolução do build. Os locks e
# a verificação de dependências (em gradle/) vêm junto para a imagem usar as
# mesmas versões e os mesmos checksums do repositório.
COPY gradlew settings.gradle build.gradle gradle.properties buildscript-gradle.lockfile ./
COPY gradle ./gradle
COPY tools/java/eclipse-formatter.xml ./tools/java/eclipse-formatter.xml
COPY apps/services/example-quarkus/build.gradle apps/services/example-quarkus/gradle-container.lockfile ./apps/services/example-quarkus/
COPY apps/services/example-quarkus/core/build.gradle apps/services/example-quarkus/core/gradle.lockfile ./apps/services/example-quarkus/core/
COPY apps/services/example-quarkus/core/src ./apps/services/example-quarkus/core/src
COPY apps/services/example-quarkus/src ./apps/services/example-quarkus/src

# NOTE: o cache do Gradle (distribuição do wrapper e dependências) fica num
# cache mount, fora das camadas da imagem. Os testes rodam no Nx, não aqui.
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew :example-quarkus:quarkusBuild -Pruntime=container \
      --no-daemon --console=plain

FROM eclipse-temurin:21-jre-noble@sha256:0d57a8e90c2bb844c5a8e1b2b71e11eff06dad7edcfd803cd21ed4ae203b2515

# NOTE: o ARG fica no fim para trocar o commit não invalidar o cache do build.
ARG REVISION=desconhecida
LABEL org.opencontainers.image.title="example-quarkus" \
      org.opencontainers.image.revision="${REVISION}"

# WHY: UID numérico fixo, para o `runAsNonRoot` do Kubernetes e a política do
# ECS conseguirem verificar o usuário sem consultar /etc/passwd.
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid 10001 --no-create-home \
      --shell /usr/sbin/nologin app

WORKDIR /app

# WHY: lib/ muda só quando as dependências mudam, e app/ e quarkus/ a cada
# build; em camadas separadas, o push e o pull reaproveitam lib/.
COPY --from=build /workspace/apps/services/example-quarkus/build/quarkus-app/lib/ ./lib/
COPY --from=build /workspace/apps/services/example-quarkus/build/quarkus-app/quarkus-run.jar ./quarkus-run.jar
COPY --from=build /workspace/apps/services/example-quarkus/build/quarkus-app/app/ ./app/
COPY --from=build /workspace/apps/services/example-quarkus/build/quarkus-app/quarkus/ ./quarkus/

# WHY: o heap cabe numa EC2 micro (1 GiB), que ainda abriga o Docker e o agente
# do SSM: 60% da memória do cgroup, GC serial (sem threads extras de coleta) e
# saída do processo no OutOfMemoryError, para o orquestrador reiniciar a réplica.
# JAVA_OPTS e não JDK_JAVA_OPTIONS: este imprime "NOTE: Picked up" no stderr, uma
# linha fora do JSON dos logs. O valor é sobrescrevível por ambiente (task do ECS,
# env do pod), sem novo build.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=60 -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError"

USER 10001:10001
EXPOSE 8080

# WHY: `exec` faz a JVM virar o PID 1 e receber o SIGTERM direto; o shutdown
# gracioso do Quarkus (quarkus.shutdown.timeout) depende disso.
ENTRYPOINT ["sh", "-c", "exec java ${JAVA_OPTS} -jar /app/quarkus-run.jar"]
