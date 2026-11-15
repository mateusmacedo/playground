# ADR 0014: A meta de segurança A antecipa o HTTPS e os access logs do ALB

- **Status**: Aceito
- **Data**: 2026-11-15

## Contexto

O repositório passou a exigir todas as notas do SonarQube Cloud em A, sem aceitar nem esconder achado ([ADR 0013](./0013-analise-sonarqube-cloud.md)). A primeira análise da `main` deu nota E em segurança, com 9 vulnerabilidades. Três delas estavam no Terraform do ambiente local:

- `terraform:S5332`: o listener do ALB servia HTTP em texto claro;
- `terraform:S6258`: o ALB não gravava access logs;
- `terraform:S6329` (BLOCKER): o launch template da EC2 não declarava a interface de rede, e a instância podia receber IP público.

Nota A em segurança exige zero vulnerabilidades. O [ADR 0011](./0011-estrutura-profissional-do-terraform.md) adia "alarmes e observabilidade" até haver serviço em produção, e o `README` do módulo `alb` adiava o HTTPS e os access logs até existirem usuários externos e conta AWS. Seguir os dois deixaria a nota de segurança abaixo de A.

Um teste no Floci 2.4.0 confirmou que o emulador importa certificado no ACM e termina TLS de verdade no listener HTTPS (TLS 1.3, com o certificado importado), e que o HTTP na mesma porta é recusado.

## Decisão

A meta de segurança A é um gatilho próprio, à parte da tabela do ADR 0011, e antecipa só o que um achado de segurança exige:

- **HTTPS no ALB**: os serviços penduram as regras num listener HTTPS (porta 443, política `ELBSecurityPolicy-TLS13-1-2-2021-06`). A porta 80 só redireciona para o HTTPS com 301. O contrato SSM passa de `platform/alb/http-listener-*` para `platform/alb/https-listener-*`.
- **Certificado local**: sem domínio, o env `platform` gera um certificado autoassinado para `localhost` (provider `tls`) e o importa no ACM do Floci. Numa conta real, o certificado vem do ACM com validação por DNS. O smoke confia no certificado pelo output `alb_certificate_pem`, sem desligar a verificação.
- **Access logs do ALB**: o módulo `alb` cria o bucket de destino com acesso público bloqueado, SSE-S3 (o único que o ALB aceita), versionamento, expiração (90 dias por padrão) e uma política que só aceita a entrega do ELB e só por HTTPS. Quem acessa esse bucket também fica registrado (S3 server access logging), num segundo bucket com as mesmas proteções, separado para o registro não gerar registro de si mesmo.
- **EC2 sem IP público**: o launch template declara a interface de rede com `associate_public_ip_address = false`; o tráfego chega só pelo ALB.

O resto da tabela do ADR 0011 continua valendo: alarmes, dashboards, WAF, CloudFront e deletion protection seguem esperando os gatilhos de lá.

Alternativa descartada: manter o ADR 0011 como está e deixar o S6258 aberto, com a nota de segurança em B até haver serviço em produção. Ela contraria a meta de todas as notas em A.

## Consequências

- **Ganhos**: nota de segurança A sem esconder achado; o tráfego local já passa pelo mesmo caminho de TLS que uma conta real usaria; trilha de auditoria das requisições na borda.
- **Custos e riscos**: um provider a mais (`tls`), dois buckets a mais no Floci e a porta 443 publicada no compose (`FLOCI_ALB_HTTPS_PORT`, padrão 8443). Quem chamava o ALB local por `http://localhost:8088` recebe 301 e passa a usar `https://localhost:8443` com o certificado do output.
- **Gatilho de revisão**: a primeira conta AWS (o certificado passa a vir do ACM com DNS) ou um achado de segurança novo que esbarre em outra linha da tabela do ADR 0011.
