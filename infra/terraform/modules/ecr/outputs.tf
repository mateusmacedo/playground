output "repositories" {
  description = "Repositórios por nome, com name, arn e url."
  value = {
    for name, repo in aws_ecr_repository.this : name => {
      name = repo.name
      arn  = repo.arn
      url  = repo.repository_url
    }
  }
}
