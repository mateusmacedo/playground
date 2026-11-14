# Migração entre estágios

Complemento de `SKILL.md`. **Status: padrão a seguir.** Nada disto existe hoje: não há módulos `service-ec2`, `service-ecs` ou `service-eks`, nem ALB. O desenho vem do `docs/adr/0008-adapters-de-runtime.md`; os passos abaixo são a consequência direta dele, e os números de exemplo são ilustrativos.

## O que muda e o que não muda

| | Muda | Não muda |
| --- | --- | --- |
| Código do serviço | Nada | `src/core`, entrypoints, testes |
| Artefato | Nada | A mesma imagem OCI, tagueada pelo SHA |
| Configuração | Nada | Variáveis de ambiente, SSM canônico, Secrets Manager |
| Infraestrutura | O módulo do Terraform e os target groups | O dono (Terraform) e o ALB compartilhado |
| Lambdas | Nada | Seguem no Serverless |

Se uma migração exige mudar o código do serviço, algum invariante foi violado. Pare e corrija o invariante (veja a tabela em `SKILL.md`) em vez de adaptar o serviço ao novo destino.

## Antes de começar

- [ ] A imagem do SHA a migrar já está no ECR (camada L3) e é a mesma que roda hoje.
- [ ] O contrato de container passa no destino novo: `PORT`, `/health` com 200, logs JSON no stdout, `SIGTERM` gracioso.
- [ ] O módulo do Terraform do estágio de destino existe e foi revisado (dono: Terraform, ADR 0004).
- [ ] Há como medir saúde: taxa de erro e latência no ALB, antes e depois.
- [ ] O ADR da migração registra o **gatilho** (por que agora). O ADR 0008 não define gatilhos numéricos entre estágios; não invente um, decida e registre.

## Blue/green no ALB

O ADR diz: "sobe o novo, desloca o peso e desliga o antigo", com target groups ponderados.

1. **Suba o novo** (verde) em um target group novo no mesmo listener do ALB, com peso 0. O antigo (azul) segue com 100.
2. **Valide o verde direto**, sem tráfego de usuário: `/health` e o smoke da camada L6 contra o target group novo.
3. **Desloque o peso em passos** (por exemplo 10, 50, 100), observando taxa de erro e latência entre os passos.
4. **Reverta pelo peso** se algo degradar: devolver o peso ao azul é a reversão, e só funciona enquanto o azul continua de pé.
5. **Desligue o azul** só depois de uma janela de observação com 100% no verde. Remover infraestrutura é do Terraform.
6. **Registre**: ADR atualizado (status e data) e o que mudou no catálogo SSM, se algo mudou.

A prioridade das regras do ALB colide entre serviços; cada serviço tem uma faixa reservada em um registro versionado (ADR 0009). Crie o target group e a regra do verde dentro da faixa do serviço.

## Particularidades por salto

| Salto | Cuidado |
| ----- | ------- |
| Estágio 1 para 2 (EC2 para ECS) | Mesmo ALB, target groups novos. A imagem já é a de container, então o risco está no ambiente da task (rede, role, variáveis), não no código. |
| Estágio 2 para 3 (ECS para EKS) | O ADR 0008 prevê EKS "com ingress próprio" e também migração blue/green no ALB. Ele não detalha como o ingress do EKS convive com o ALB compartilhado durante a troca. Decida isso na PoC e registre no ADR. |
| Qualquer salto para fora da Lambda | O consumidor de fila troca de driver: do handler de lote da Lambda para o worker de long-polling no container. O caso de uso no núcleo é o mesmo; teste os dois drivers. |

## Quando não migrar

- Não há necessidade que o estágio atual deixe de atender. Migrar "porque o próximo é melhor" é YAGNI.
- A PoC do ADR 0008 ainda não rodou: nenhum estágio de container é implementável com segurança antes dela.
- O serviço ainda viola um invariante (por exemplo, guarda estado em disco). Corrija antes.

## Veja também

- `docs/adr/0008-adapters-de-runtime.md` (estágios, invariantes e pendência da PoC).
- `docs/adr/0009-camadas-e-ordem-de-implantacao.md` (camadas, promoção do mesmo artefato e faixas de prioridade do ALB).
- `docs/guides/ordem-de-implantacao.md`.
