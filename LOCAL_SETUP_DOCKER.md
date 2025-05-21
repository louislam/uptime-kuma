# LOCAL SETUP DOCKER

## commands list

```bash
docker run -it --rm -v $PWD:/code -w /code -p 3001:3001 node:20.4 /bin/bash
# inside the container
npm ci
npm run download-dist
npm run dev
```
