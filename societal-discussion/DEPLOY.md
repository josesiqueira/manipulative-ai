# Deployment Guide for CSC Rahti

This guide explains how to deploy the Bilingual Chatbot Experiment to CSC's Rahti container cloud (OpenShift/OKD).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CSC Rahti (OpenShift)                   │
│  ┌─────────────────┐      ┌─────────────────┐               │
│  │  Frontend Pod   │      │  Backend Pod    │               │
│  │  (Next.js)      │◄────►│  (FastAPI)      │               │
│  │  Port 8080      │      │  Port 8080      │               │
│  └────────┬────────┘      └────────┬────────┘               │
│           │                        │                        │
│           ▼                        ▼                        │
│  web-bilingual-chatbot-   api-bilingual-chatbot-            │
│  experiment.2.rahtiapp.fi experiment.2.rahtiapp.fi          │
└─────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │   CSC Pukki DBaaS (External)    │
                    │   PostgreSQL @ 193.166.25.147   │
                    └─────────────────────────────────┘
```

## Prerequisites

1. **CSC Account** with access to:
   - Rahti 2 service
   - Pukki DBaaS (PostgreSQL)

2. **Tools installed:**
   - `oc` (OpenShift CLI)
   - `docker` or `podman`

3. **Database ready:**
   - PostgreSQL instance on Pukki
   - Rahti IP (86.50.229.150/32) whitelisted in Pukki

## URLs

| Component | URL |
|-----------|-----|
| Frontend | https://web-bilingual-chatbot-experiment.2.rahtiapp.fi |
| Backend API | https://api-bilingual-chatbot-experiment.2.rahtiapp.fi |
| Database | postgresql://admin:***@193.166.25.147:5432/bilingual_chatbot_experiment |

---

## Initial Deployment

### Step 1: Login to Rahti

```bash
# Get your token from https://rahti.csc.fi → Click your name → "Copy login command"
oc login https://api.2.rahti.csc.fi:6443 --token=<your_token>

# Switch to your project
oc project bilingual-chatbot-experiment
```

### Step 2: Login to Rahti Image Registry

```bash
docker login -p $(oc whoami -t) -u unused image-registry.apps.2.rahti.csc.fi
```

### Step 3: Create Secrets

```bash
oc create secret generic app-secrets \
  --from-literal=DATABASE_URL="postgresql+asyncpg://admin:YOUR_PASSWORD@193.166.25.147:5432/bilingual_chatbot_experiment" \
  --from-literal=OPENAI_API_KEY="sk-..." \
  --from-literal=ANTHROPIC_API_KEY="sk-ant-..." \
  --from-literal=ADMIN_PASSWORD="your-admin-password" \
  --from-literal=ENCRYPTION_SECRET="$(openssl rand -base64 32)"
```

### Step 4: Build and Push Images

From the `societal-discussion` directory:

```bash
# Build API image
docker build -t image-registry.apps.2.rahti.csc.fi/bilingual-chatbot-experiment/api:latest ./apps/api

# Build Web image (with API URL baked in)
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api-bilingual-chatbot-experiment.2.rahtiapp.fi \
  -t image-registry.apps.2.rahti.csc.fi/bilingual-chatbot-experiment/web:latest \
  ./apps/web

# Push images
docker push image-registry.apps.2.rahti.csc.fi/bilingual-chatbot-experiment/api:latest
docker push image-registry.apps.2.rahti.csc.fi/bilingual-chatbot-experiment/web:latest
```

### Step 5: Deploy to Rahti

```bash
# Apply all Kubernetes manifests
oc apply -f k8s/api-deployment.yaml
oc apply -f k8s/api-service.yaml
oc apply -f k8s/api-route.yaml
oc apply -f k8s/web-deployment.yaml
oc apply -f k8s/web-service.yaml
oc apply -f k8s/web-route.yaml

# Or apply all at once
oc apply -f k8s/
```

### Step 6: Run Database Migrations

```bash
# Execute migrations inside the API pod
oc exec deployment/api -- uv run alembic upgrade head
```

### Step 7: Verify Deployment

```bash
# Check pod status
oc get pods

# Check routes
oc get routes

# View logs
oc logs deployment/api
oc logs deployment/web
```

---

## Redeploying After Code Changes

### Quick Redeploy (same images)

```bash
# Restart pods to pull latest images
oc rollout restart deployment/api
oc rollout restart deployment/web
```

### Full Redeploy (rebuild images)

```bash
# 1. Rebuild images
docker build -t image-registry.apps.2.rahti.csc.fi/bilingual-chatbot-experiment/api:latest ./apps/api
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api-bilingual-chatbot-experiment.2.rahtiapp.fi \
  -t image-registry.apps.2.rahti.csc.fi/bilingual-chatbot-experiment/web:latest \
  ./apps/web

# 2. Push images
docker push image-registry.apps.2.rahti.csc.fi/bilingual-chatbot-experiment/api:latest
docker push image-registry.apps.2.rahti.csc.fi/bilingual-chatbot-experiment/web:latest

# 3. Restart deployments
oc rollout restart deployment/api
oc rollout restart deployment/web

# 4. Watch rollout status
oc rollout status deployment/api
oc rollout status deployment/web
```

---

## Database Management

### Run Migrations

```bash
# From your local machine (if Pukki allows your IP)
DATABASE_URL="postgresql+asyncpg://admin:PASSWORD@193.166.25.147:5432/bilingual_chatbot_experiment" \
  uv run alembic upgrade head

# Or from inside the API pod
oc exec deployment/api -- uv run alembic upgrade head
```

### Create New Migration

```bash
# Locally
DATABASE_URL="postgresql+asyncpg://admin:PASSWORD@193.166.25.147:5432/bilingual_chatbot_experiment" \
  uv run alembic revision --autogenerate -m "Description of changes"
```

### Access Database Directly

```bash
# Using psql (if installed)
psql postgresql://admin:PASSWORD@193.166.25.147:5432/bilingual_chatbot_experiment
```

---

## Updating Secrets

```bash
# Delete and recreate
oc delete secret app-secrets
oc create secret generic app-secrets \
  --from-literal=DATABASE_URL="..." \
  --from-literal=OPENAI_API_KEY="..." \
  # ... other secrets

# Restart pods to pick up new secrets
oc rollout restart deployment/api
```

---

## Troubleshooting

### View Logs

```bash
# API logs
oc logs deployment/api -f

# Web logs
oc logs deployment/web -f

# Previous pod logs (after crash)
oc logs deployment/api --previous
```

### Debug Pod

```bash
# Shell into running pod
oc exec -it deployment/api -- /bin/sh

# Check environment variables
oc exec deployment/api -- env | grep DATABASE
```

### Check Events

```bash
oc get events --sort-by='.lastTimestamp'
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Image pull error | Re-login to registry: `docker login -p $(oc whoami -t) -u unused image-registry.apps.2.rahti.csc.fi` |
| Database connection refused | Check Pukki CIDR whitelist includes Rahti IP (86.50.229.150/32) |
| Pod crashloop | Check logs: `oc logs deployment/api --previous` |
| Route not working | Verify route: `oc get route api -o yaml` |

---

## Useful Commands

```bash
# View all resources
oc get all

# Scale deployment
oc scale deployment/api --replicas=2

# Delete everything
oc delete -f k8s/

# Port forward for local testing
oc port-forward deployment/api 8080:8080
```

---

## Project Info

- **CSC Project Number:** 2017723
- **Rahti Project:** bilingual-chatbot-experiment
- **Pukki Instance:** bilingual_chatbot_experiment
