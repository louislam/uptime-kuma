## What does this PR implement/fix? Explain your changes.

...

## Does this close any currently open issues?

Closes #<PR>

## Steps to test this PR:

- Create cluster

```bash
./hacks/df_create_kind.sh
```

- Export GitHub info

```bash
export GHP_USERNAME=your_github_username_goes_here
export GHP_SECRET=your_github_pat_goes_here
```

- Deploy DF Core

```bash
./hacks/df_deploy.sh
```

- Build dev images command:

```bash
docker build -t df-backend:local -f $DF_HOME/df-platform/df-backend/Dockerfile $DF_HOME/df-platform/df-backend
docker build -t df-frontend:local -f $DF_HOME/df-platform/df-frontend/Dockerfile $DF_HOME/df-platform/df-frontend
```

- Load images to cluster:

```bash
kind load docker-image df-frontend:local --name data-fabric
kind load docker-image df-backend:local --name data-fabric
```

- Update the images in Kubernetes

```bash
kubectl set image deployment/df-platform frontend=df-frontend:local -n data-fabric
kubectl set image deployment/df-platform backend=df-backend:local -n data-fabric
```