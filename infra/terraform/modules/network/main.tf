resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(var.tags, { Name = var.name })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, { Name = var.name })
}

# NOTE: só subnets públicas, sem NAT: o ALB e os serviços ficam nelas. Subnet
# privada com NAT entra com a primeira conta AWS (ADR 0011).
resource "aws_subnet" "public" {
  for_each = var.public_subnets

  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.key
  cidr_block              = each.value
  map_public_ip_on_launch = true

  tags = merge(var.tags, { Name = "${var.name}-public-${each.key}", tier = "public" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, { Name = "${var.name}-public" })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "alb" {
  name        = "${var.name}-alb"
  description = "Shared ALB: client HTTP ingress"
  vpc_id      = aws_vpc.this.id

  tags = merge(var.tags, { Name = "${var.name}-alb" })
}

# WHY: a regra da porta 80 ganhou a porta na chave; o `moved` mantém a mesma
# regra em vez de recriar uma idêntica, que o EC2 recusaria como duplicada.
moved {
  from = aws_vpc_security_group_ingress_rule.alb_listener["0.0.0.0/0"]
  to   = aws_vpc_security_group_ingress_rule.alb_listener["0.0.0.0/0:80"]
}

resource "aws_vpc_security_group_ingress_rule" "alb_listener" {
  for_each = {
    for pair in setproduct(var.alb_ingress_cidrs, var.alb_listener_ports) :
    "${pair[0]}:${pair[1]}" => { cidr = pair[0], port = pair[1] }
  }

  security_group_id = aws_security_group.alb.id
  description       = "Client traffic to the ALB listener"
  ip_protocol       = "tcp"
  from_port         = each.value.port
  to_port           = each.value.port
  cidr_ipv4         = each.value.cidr
}

resource "aws_vpc_security_group_egress_rule" "alb_all" {
  security_group_id = aws_security_group.alb.id
  description       = "ALB to targets and health checks"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# WHY: um SG único para os serviços de container, que só aceita tráfego vindo
# do ALB; o serviço não abre porta para a internet em nenhum estágio.
resource "aws_security_group" "services" {
  name        = "${var.name}-services"
  description = "Container backends (EC2, ECS, EKS): ingress only from the ALB"
  vpc_id      = aws_vpc.this.id

  tags = merge(var.tags, { Name = "${var.name}-services" })
}

resource "aws_vpc_security_group_ingress_rule" "services_from_alb" {
  security_group_id            = aws_security_group.services.id
  description                  = "Traffic and health checks from the ALB"
  ip_protocol                  = "tcp"
  from_port                    = var.service_port_range.from
  to_port                      = var.service_port_range.to
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_egress_rule" "services_all" {
  security_group_id = aws_security_group.services.id
  description       = "Image pulls and AWS APIs"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}
