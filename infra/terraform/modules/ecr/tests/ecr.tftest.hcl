mock_provider "aws" {}

variables {
  repositories = ["playground-example-go"]
}

run "immutable_by_default" {
  command = plan

  assert {
    condition     = aws_ecr_repository.this["playground-example-go"].image_tag_mutability == "IMMUTABLE"
    error_message = "A tag sha-<commit> é imutável por padrão."
  }

  assert {
    condition     = aws_ecr_repository.this["playground-example-go"].image_scanning_configuration[0].scan_on_push
    error_message = "O scan no push fica ligado."
  }
}
