# Registro versionado dos serviços de container (L4): estágio, peso no ALB e
# faixa reservada de prioridades (cada serviço usa priority e priority + 1).
#
# Faixas reservadas:
#   example-go       100-109  NodePort 30100
#   example-quarkus  110-119  NodePort 30110
#
# Estágios (ADR 0008): { ec2 = 100 } é o estágio 1, { ecs = 100 } o 2 e
# { eks = 100 } o 3 (este exige enable_eks = true na plataforma). Migração
# blue/green, um apply por passo: { ec2 = 100, ecs = 0 } sobe o novo fora do
# roteamento, { ec2 = 50, ecs = 50 } divide, { ec2 = 0, ecs = 100 } tira o
# antigo da regra e { ecs = 100 } o destrói.
services = {
  example-go = {
    stages    = { ecs = 100 }
    priority  = 100
    node_port = 30100
  }
  example-quarkus = {
    stages    = { ecs = 100 }
    priority  = 110
    node_port = 30110
    memory    = 1024
  }
}
