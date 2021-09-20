# Uptime-Kuma K8s Deployment

⚠ Warning: K8s deployment is provided by contributors. I have no experience with K8s and I can't fix error in the future. I only test Docker and Node.js. Use at your own risk.

## How does it work?

Kustomize is a tool which builds a complete deployment file for all config elements.
You can edit the files in the ```uptime-kuma``` folder except the ```kustomization.yml``` until you know what you're doing.
If you want to choose another namespace you can edit the ```kustomization.yml``` in the ```kubernetes```-Folder and change the ```namespace: uptime-kuma``` to something you like.

It creates a certificate with the specified Issuer and creates the Ingress for the Uptime-Kuma ClusterIP-Service.

## What do I have to edit?

You have to edit the ```ingressroute.yml``` to your needs.
This ingressroute.yml is for the [nginx-ingress-controller](https://kubernetes.github.io/ingress-nginx/) in combination with the [cert-manager](https://cert-manager.io/).

- Host
- Secrets and secret names
- (Cluster)Issuer (optional)
- The Version in the Deployment-File
  - Update:
    - Change to newer version and run the above commands, it will update the pods one after another

## How To use

- Install [kustomize](https://kubectl.docs.kubernetes.io/installation/kustomize/)
- Edit files mentioned above to your needs
- Run ```kustomize build > apply.yml```
- Run ```kubectl apply -f apply.yml```

Now you should see some k8s magic and Uptime-Kuma should be available at the specified address.
