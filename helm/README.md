# Uptime Kuma Helm Chart

A Helm chart for deploying [Uptime Kuma](https://uptime.kuma.pet/) - A fancy self-hosted monitoring tool.

## Prerequisites

- Kubernetes 1.16+
- Helm 3.0+
- PV provisioner support in the underlying infrastructure (if persistence is enabled)

## Installing the Chart

To install the chart with the release name `my-uptime-kuma`:

```bash
helm install my-uptime-kuma ./helm
```

To install with custom values:

```bash
helm install my-uptime-kuma ./helm --values custom-values.yaml
```

## Uninstalling the Chart

To uninstall/delete the `my-uptime-kuma` deployment:

```bash
helm delete my-uptime-kuma
```

## Configuration

The following table lists the configurable parameters of the Uptime Kuma chart and their default values.

### Basic Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `1` |
| `image.repository` | Image repository | `louislam/uptime-kuma` |
| `image.tag` | Image tag | `1` |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `environment` | Environment name (used in service naming) | `dev` |

### Service Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `service.type` | Kubernetes service type | `ClusterIP` |
| `service.port` | Service port | `3001` |
| `service.targetPort` | Container target port | `3001` |

### Ingress Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class name | `""` |
| `ingress.annotations` | Ingress annotations | `{}` |
| `ingress.hosts` | Ingress hosts configuration | See values.yaml |
| `ingress.tls` | Ingress TLS configuration | `[]` |

### Persistence Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `persistence.enabled` | Enable persistent storage | `true` |
| `persistence.accessMode` | PVC access mode | `ReadWriteOnce` |
| `persistence.size` | PVC size | `4Gi` |
| `persistence.storageClass` | Storage class name | `""` |

### Resource Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `resources` | CPU/Memory resource requests/limits | `{}` |
| `nodeSelector` | Node labels for pod assignment | `{}` |
| `tolerations` | Toleration labels for pod assignment | `[]` |
| `affinity` | Affinity settings for pod assignment | `{}` |

## Environment-based Service Naming

The chart creates a service with environment-based naming: `uptime-kube-{environment}`

Examples:
- Development: `uptime-kube-dev`
- Staging: `uptime-kube-stage` 
- Production: `uptime-kube-prod`

To deploy to different environments:

```bash
# Development
helm install uptime-dev ./helm --set environment=dev

# Staging  
helm install uptime-stage ./helm --set environment=stage

# Production
helm install uptime-prod ./helm --set environment=prod
```

## Examples

### Basic Installation

```bash
helm install uptime-kuma ./helm
```

### Installation with Ingress

```bash
helm install uptime-kuma ./helm \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=uptime.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

### Installation with Custom Resources

```bash
helm install uptime-kuma ./helm \
  --set resources.requests.cpu=100m \
  --set resources.requests.memory=128Mi \
  --set resources.limits.cpu=500m \
  --set resources.limits.memory=512Mi
```

### Installation for Production Environment

```bash
helm install uptime-prod ./helm \
  --set environment=prod \
  --set replicaCount=2 \
  --set persistence.size=10Gi \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=uptime.company.com
```

## Accessing Uptime Kuma

After installation, follow the instructions in the NOTES to access your Uptime Kuma instance. The initial setup will require you to create an admin account.

## Persistence

By default, the chart creates a PersistentVolumeClaim with 4Gi of storage. This ensures that your monitoring data persists across pod restarts. To disable persistence:

```bash
helm install uptime-kuma ./helm --set persistence.enabled=false
```

**Warning**: Disabling persistence will result in data loss when pods restart.

## Upgrading

To upgrade your installation:

```bash
helm upgrade uptime-kuma ./helm
```

## Troubleshooting

### Pod not starting

Check the pod logs:
```bash
kubectl logs -l app.kubernetes.io/name=uptime-kuma
```

### Service not accessible

Verify the service is running:
```bash
kubectl get svc uptime-kube-{your-environment}
```

### Persistence issues

Check PVC status:
```bash
kubectl get pvc
```

## Contributing

1. Make changes to the chart
2. Update the version in `Chart.yaml`
3. Test the changes
4. Submit a pull request
