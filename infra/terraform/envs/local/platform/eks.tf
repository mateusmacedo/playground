# Estágio 3 (ADR 0008): o cluster é opcional, porque o k3s do Floci consome
# perto de 500 MB.
data "aws_iam_policy_document" "assume_eks" {
  statement {
    actions = ["sts:AssumeRole", "sts:TagSession"]

    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "eks_cluster" {
  count = var.enable_eks ? 1 : 0

  name               = "${local.name}-eks-cluster"
  assume_role_policy = data.aws_iam_policy_document.assume_eks.json
}

resource "aws_iam_role_policy_attachment" "eks_cluster" {
  count = var.enable_eks ? 1 : 0

  role       = aws_iam_role.eks_cluster[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_eks_cluster" "this" {
  count = var.enable_eks ? 1 : 0

  name     = local.name
  version  = var.eks_version
  role_arn = aws_iam_role.eks_cluster[0].arn

  vpc_config {
    subnet_ids             = module.network.public_subnet_ids
    endpoint_public_access = true
  }

  access_config {
    authentication_mode = "API"
  }

  depends_on = [aws_iam_role_policy_attachment.eks_cluster]
}

# WORKAROUND(floci-2.4.0): o webhook de autenticação do EKS no Floci recusa as
# credenciais públicas test/test. O env services precisa de uma chave IAM de
# verdade (no emulador) para gerar o token do k3s; ela fica no Secrets Manager
# e o services a encontra pelo ARN publicado no SSM.
resource "aws_iam_user" "eks_deployer" {
  count = var.enable_eks ? 1 : 0

  name = "${local.name}-eks-deployer"
}

resource "aws_iam_access_key" "eks_deployer" {
  count = var.enable_eks ? 1 : 0

  user = aws_iam_user.eks_deployer[0].name
}

resource "aws_eks_access_entry" "eks_deployer" {
  count = var.enable_eks ? 1 : 0

  cluster_name  = aws_eks_cluster.this[0].name
  principal_arn = aws_iam_user.eks_deployer[0].arn
  type          = "STANDARD"
}

resource "aws_eks_access_policy_association" "eks_deployer" {
  count = var.enable_eks ? 1 : 0

  cluster_name  = aws_eks_cluster.this[0].name
  principal_arn = aws_iam_user.eks_deployer[0].arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }

  depends_on = [aws_eks_access_entry.eks_deployer]
}

resource "aws_secretsmanager_secret" "eks_deployer" {
  count = var.enable_eks ? 1 : 0

  name                    = "playground/local/platform/eks-deployer"
  description             = "Local-only IAM key used by the services layer to reach the emulated EKS"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "eks_deployer" {
  count = var.enable_eks ? 1 : 0

  secret_id = aws_secretsmanager_secret.eks_deployer[0].id
  secret_string = jsonencode({
    access_key_id     = aws_iam_access_key.eks_deployer[0].id
    secret_access_key = aws_iam_access_key.eks_deployer[0].secret
  })
}
