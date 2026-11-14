# Módulo `network`

Rede da plataforma (L1): VPC, subnets públicas em duas ou mais zonas, internet gateway, route table pública e os dois security groups.

| Security group    | Entrada                                                                           |
| ----------------- | --------------------------------------------------------------------------------- |
| `<nome>-alb`      | Porta do listener (`alb_listener_port`, 80) a partir de `alb_ingress_cidrs`       |
| `<nome>-services` | Só do SG do ALB, na faixa `service_port_range` (container, instância ou NodePort) |

```hcl
module "network" {
  source = "../../../modules/network"

  name           = "playground-local"
  cidr_block     = "10.20.0.0/16"
  public_subnets = { us-east-1a = "10.20.0.0/24", us-east-1b = "10.20.1.0/24" }
}
```

- Sem subnet privada nem NAT: o ALB e os serviços ficam nas públicas. Isso muda com a primeira conta AWS ([ADR 0011](../../../../docs/adr/0011-estrutura-profissional-do-terraform.md)).
- No Floci, cada VPC vira uma rede Docker real, e os security groups não filtram tráfego entre containers: uma regra faltando passa no emulador e falha na AWS.
