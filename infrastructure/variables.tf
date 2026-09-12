variable "project_name" {
  description = "Project/application name."
  type        = string
  default     = "crisisconnect"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "hackathon"
}

variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "ap-south-1"
}

variable "app_url" {
  description = "Primary frontend callback URL."
  type        = string
  default     = "http://localhost:3000"
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the public RDS instance in hackathon mode."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "crisisconnect"
}

variable "db_username" {
  description = "PostgreSQL admin username."
  type        = string
  default     = "crisisadmin"
}

variable "db_password" {
  description = "PostgreSQL admin password."
  type        = string
  sensitive   = true
}

variable "ses_sender_email" {
  description = "Verified SES sender email."
  type        = string
}

variable "notification_sender_id" {
  description = "Optional sender ID label for SMS where supported."
  type        = string
  default     = "CRISISAPP"
}

variable "notifylk_user_id" {
  description = "Notify.lk user ID used by the worker Lambda for SMS delivery."
  type        = string
  sensitive   = true
  default     = ""
}

variable "notifylk_api_key" {
  description = "Notify.lk API key used by the worker Lambda for SMS delivery."
  type        = string
  sensitive   = true
  default     = ""
}

variable "notifylk_sender_id" {
  description = "Approved Notify.lk sender ID. Use NotifyDEMO only for test traffic."
  type        = string
  default     = "NotifyDEMO"
}

variable "notifylk_sms_type" {
  description = "Optional Notify.lk SMS type. Set to unicode when Sinhala or Tamil content is required."
  type        = string
  default     = ""
}

variable "demo_sms_recipients" {
  description = "Optional comma-separated Sri Lankan phone numbers that should always receive outbound SMS during demos."
  type        = string
  default     = ""
}

variable "gemini_api_key" {
  description = "Gemini API key used by the AI orchestration lambda."
  type        = string
  sensitive   = true
  default     = ""
}
