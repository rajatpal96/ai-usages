terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  default = "us-east-1"
}

variable "environment" {
  default = "production"
}

# ECS Cluster for AgentMeter Platform
resource "aws_ecs_cluster" "agentmeter_cluster" {
  name = "agentmeter-${var.environment}"
}

# CloudWatch Log Group for Observability
resource "aws_cloudwatch_log_group" "agentmeter_logs" {
  name              = "/ecs/agentmeter-${var.environment}"
  retention_in_days = 30
}
