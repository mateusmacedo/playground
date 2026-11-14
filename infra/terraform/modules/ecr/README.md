# Módulo `ecr`

Repositórios ECR da plataforma (L1), um por serviço de container, com scan no push e lifecycle policy que mantém as últimas `keep_last_images` imagens.

```hcl
module "ecr" {
  source = "../../../modules/ecr"

  repositories = ["playground-example-go", "playground-example-quarkus"]
  force_delete = true
}
```

- `image_tag_mutability` é `IMMUTABLE` por padrão: a tag `sha-<commit>` aponta sempre para o mesmo digest ([ADR 0008](../../../../docs/adr/0008-adapters-de-runtime.md)).
- `force_delete` só no ambiente descartável (o local).
- Saída `repositories`: mapa nome => `{ name, arn, url }`. No Floci a `url` é `000000000000.dkr.ecr.us-east-1.localhost:4566/<nome>`.
