# Hudhud API Kubernetes Deployment

## Introduction

This repository provides a guide to deploying the Hudhud API on a Kubernetes cluster using Terraform and Pulumi.

## Prerequisites

- A running Kubernetes cluster.
- `kubectl`, `kubeseal`, `Helm`, and Flux installed.
- A domain name for accessing the services.

## Infrastructure Setup

### Terraform Configuration

Set up VPC, subnets, and databases using Terraform.

1. Create a `main.tf` file.
2. Initialize and apply the configuration:

```sh
terraform init
terraform apply
```

### Pulumi Configuration
Set up additional infrastructure and Kubernetes resources using Pulumi.

Deploy the Pulumi configuration:

```sh
pulumi up
```
## Deployment Steps
### Namespace
Create and apply a namespace configuration:
```sh
apiVersion: v1
kind: Namespace
metadata:
  name: hudhud
  labels:
    prometheus: enabled
```

### Configurations and Secrets

Store environment variables in a ConfigMap and manage sensitive information using Sealed Secrets.

Apply the ConfigMap and Sealed Secrets:
```sh
kubectl apply -f env-configmap.yaml
kubectl apply -f ghcr-credentials-sealedsecret.yaml
kubectl apply -f keycloak-database-credentials-sealedsecret.yaml
```

### API Deployment

Deploy the Hudhud API pods:

Create an api-deployment.yaml file.
Apply the API deployment:
```sh
kubectl apply -f api-deployment.yaml
```
### Celery Deployment
Deploy the Celery worker pods:

Create a celery-deployment.yaml file.
Apply the Celery deployment:

```sh
kubectl apply -f celery-deployment.yaml
```

###  Service Configuration
Expose the API deployment:

Create an api-svc.yaml file.
Apply the API service:

```sh
kubectl apply -f api-svc.yaml
```

###  Ingress Configuration

Set up Ingress to route traffic to the API service:

Create an api-ingress.yaml file.
Replace your-domain.com with your actual domain.
Apply the Ingress configuration:
```sh
kubectl apply -f api-ingress.yaml
```
### Keycloak Helm Release
Deploy Keycloak using a Helm chart managed by Flux:

Create a keycloak-helm-release.yaml file.
Apply the Keycloak Helm release:

```sh
kubectl apply -f keycloak-helm-release.yaml
```
### Applying the Configuration
Apply all configurations in the correct order:

```sh
kubectl apply -f namespace.yaml
kubectl apply -f env-configmap.yaml
kubectl apply -f ghcr-credentials-sealedsecret.yaml
kubectl apply -f keycloak-database-credentials-sealedsecret.yaml
kubectl apply -f api-deployment.yaml
kubectl apply -f celery-deployment.yaml
kubectl apply -f api-svc.yaml
kubectl apply -f api-ingress.yaml
kubectl apply -f keycloak-helm-release.yaml

```

## Accessing the Services
After applying the configurations, the services should be accessible using the specified domain. Verify the external IP of the services:

```sh
kubectl get svc -n hudhud
```
### Conclusion
This documentation provides a guide to deploying the Hudhud API on a Kubernetes cluster and exposing it using a domain.


