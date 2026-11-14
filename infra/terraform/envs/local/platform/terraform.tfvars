vpc_cidr = "10.20.0.0/16"

public_subnets = {
  us-east-1a = "10.20.0.0/24"
  us-east-1b = "10.20.1.0/24"
}

container_services = ["example-go", "example-quarkus"]

# Estágio 3 (EKS): TF_VAR_enable_eks=true no apply da plataforma.
enable_eks = false
