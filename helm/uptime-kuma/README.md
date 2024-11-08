# Uptime Kuma

Uptime Kuma is an easy-to-use self-hosted monitoring tool.

Homepage : https://uptime.kuma.pet/

### Source Code

- https://github.com/louislam/uptime-kuma

### TL:DR

```shell
helm install uptime-kuma uptime-kuma -n uptime-kuma \
    --values values-test.yaml                       \
    --set persistVolume.csi.handle=<your-efs-id>    \
    --set ingress.host=<your-host-name>             \
    --set ingress.metadata.annotations.alb\.ingress\.kubernetes\.io/vpc-id=<vpc-id>
```

> In [Installation & Configuration](https://github.com/louislam/uptime-kuma/wiki/%F0%9F%94%A7-How-to-Install), uptime-kuma officially recommend volume mapping to `/app/data`. <br>
> So I used the PersistVolume(e.g. efs), PersistVolumeCliam to maintain persistance data. <br>

### Requirements

I used these helm chart with Amazon EKS 1.30.

> HOWEVER, I don't use any special features that are only available in certain versions, <br>
> so I guess it would be campatiable Amazon EKS 1.30, and more.


| Requirements                                         | Name                         | Version | Ref                                                             |
| ---------------------------------------------------- | ---------------------------- | ------- | --------------------------------------------------------------- |
| https://aws.github.io/eks-charts                     | aws-load-balancer-controller | 1.8.1   | https://github.com/kubernetes-sigs/aws-load-balancer-controller |
| https://kubernetes-sigs.github.io/aws-efs-csi-driver | aws-efs-csi-driver           | 3.0.4   | https://github.com/kubernetes-sigs/aws-efs-csi-driver           |

### Values

| Key                                         | Type   | Default                  |
| ------------------------------------------- | ------ | ------------------------ |
| nameOverride                                | string | `nil`                    |
| namespaceOverride                           | string | `nil`                    |
| isEnableService                             | bool   | `false`                  |
| isEnableIngress                             | bool   | `false`                  |
| isEnablePersistVolume                       | bool   | `false`                  |
| deployment.image                            | string | `louislam/uptime-kuma:1` |
| deployment.port                             | int    | `3001`                   |
| deployment.spec.replicas                    | int    | `1`                      |
| deployment.request.cpu                      | string | `256Mi`                  |
| deployment.request.memory                   | string | `150m`                   |
| service.metadata.labels                     | object | `{}`                     |
| service.metadata.annotations                | object | `{}`                     |
| service.spec.type                           | string | `NodePort`               |
| service.spec.sessionAffinity                | string | `nil`                    |
| service.spec.selectors                      | object | `{}`                     |
| service.spec.externalTrafficPolicy          | string | `nil`                    |
| service.spec.externalIPs                    | list   | `[]`                     |
| ingress.host                                | string | `example.com`            |
| ingress.ingressClassName                    | string | `alb`                    |
| ingress.metadata.labels                     | object | `{}`                     |
| ingress.metadata.annotations                | object | `{}`                     |
| ingress.spec.selector                       | object | `{}`                     |
| persistVolume.size                          | string | `1Gi`                    |
| persistVolume.volumemode                    | string | `FileSystem`             |
| persistVolume.accessmode                    | string | `ReadWriteMany`          |
| persistVolume.persistentVolumeReclaimPolicy | string | `Retain`                 |
| persistVolume.storageClass                  | string | `efs-sc`                 |
| persistVolume.csi.driver                    | string | `efs.csi.aws.com`        |
| persistVolume.csi.handle                    | string | `nil`                    |
