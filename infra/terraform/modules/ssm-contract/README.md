# Módulo `ssm-contract`

Publica outputs de uma camada no SSM, no caminho canônico `/<app>/<stage>/<região>/<domínio>/<recurso>/<atributo>` ([ADR 0004](../../../../docs/adr/0004-serverless-e-terraform.md)). É a única interface entre camadas: nada de `terraform_remote_state`.

```hcl
module "contract" {
  source = "../../../modules/ssm-contract"

  stage  = "local"
  region = "us-east-1"
  layer  = "L1"
  parameters = {
    "platform/vpc/id"               = module.network.vpc_id
    "example-go/ecr-repository/url" = module.ecr.repositories["playground-example-go"].url
  }
}
```

- As chaves seguem `<domínio>/<recurso>/<atributo>` em minúsculas com hífen; o módulo valida o formato.
- Os parâmetros são `String`: só identificadores (ARN, URL, nome). Segredo vai para o Secrets Manager, e aqui entra só o ARN dele.
- Listas vão como texto separado por vírgula.
