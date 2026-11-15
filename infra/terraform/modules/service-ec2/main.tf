data "aws_region" "current" {}

locals {
  resource_name = "${var.name}-ec2"
  registry      = split("/", var.image)[0]

  user_data = templatefile("${path.module}/templates/user-data.sh.tftpl", {
    image             = var.image
    registry          = local.registry
    registry_alias    = var.registry_alias
    region            = data.aws_region.current.region
    container_name    = var.name
    container_port    = var.container_port
    health_check_path = var.health_check_path
    docker_tmpfs_size = var.docker_tmpfs_size
    environment       = var.environment
  })
}

data "aws_iam_policy_document" "assume_ec2" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  name               = local.resource_name
  assume_role_policy = data.aws_iam_policy_document.assume_ec2.json

  tags = var.tags
}

data "aws_iam_policy_document" "pull_image" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "PullServiceImage"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = [var.ecr_repository_arn]
  }
}

resource "aws_iam_role_policy" "pull_image" {
  name   = "pull-image"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.pull_image.json
}

resource "aws_iam_instance_profile" "this" {
  name = local.resource_name
  role = aws_iam_role.instance.name

  tags = var.tags
}

resource "aws_lb_target_group" "this" {
  name                 = local.resource_name
  vpc_id               = var.vpc_id
  target_type          = "instance"
  protocol             = "HTTP"
  port                 = var.container_port
  deregistration_delay = var.deregistration_delay

  health_check {
    path                = var.health_check_path
    matcher             = "200-299"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = merge(var.tags, { stage = "ec2" })
}

resource "aws_launch_template" "this" {
  name                   = local.resource_name
  image_id               = var.ami_id
  instance_type          = var.instance_type
  user_data              = base64encode(local.user_data)
  update_default_version = true

  # WHY: a instância só recebe tráfego do ALB pelo IP privado; sem IP público,
  # ela não fica alcançável da internet mesmo numa subnet pública.
  network_interfaces {
    associate_public_ip_address = false
    delete_on_termination       = true
    security_groups             = var.security_group_ids
  }

  iam_instance_profile {
    arn = aws_iam_instance_profile.this.arn
  }

  # NOTE: hop limit 2 para o container do serviço alcançar o IMDSv2 da
  # instância, como recomenda a AWS para workloads em container.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  tag_specifications {
    resource_type = "instance"
    tags          = merge(var.tags, { Name = local.resource_name, service = var.name, stage = "ec2" })
  }

  tags = var.tags
}

resource "aws_autoscaling_group" "this" {
  name                      = local.resource_name
  min_size                  = var.desired_capacity
  max_size                  = var.desired_capacity
  desired_capacity          = var.desired_capacity
  vpc_zone_identifier       = var.subnet_ids
  target_group_arns         = [aws_lb_target_group.this.arn]
  health_check_type         = var.health_check_type
  health_check_grace_period = var.health_check_grace_period
  wait_for_capacity_timeout = var.wait_for_capacity_timeout

  launch_template {
    id      = aws_launch_template.this.id
    version = aws_launch_template.this.latest_version
  }

  # WHY: uma imagem nova (sha-<commit>) gera versão nova do launch template, e
  # o refresh troca a instância; com ASG de 1, aceita-se a janela sem alvo.
  instance_refresh {
    strategy = "Rolling"

    preferences {
      min_healthy_percentage = 0
    }
  }

  dynamic "tag" {
    for_each = merge(var.tags, { Name = local.resource_name, service = var.name, stage = "ec2" })

    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}
