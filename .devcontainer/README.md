# Codespaces

Now you can modifiy Uptime Kuma on your browser without setting up a local development.

![image](https://github.com/louislam/uptime-kuma/assets/1336778/31d9f06d-dd0b-4405-8e0d-a96586ee4595)

1. Click `Code` -> `Create codespace on master`
2. Wait a few minutes until you see there are two exposed ports
3. Go to the `3000` url, see if it is working 

![image](https://github.com/louislam/uptime-kuma/assets/1336778/909b2eb4-4c5e-44e4-ac26-6d20ed856e7f)

## Frontend

Since it is using Vite.js, all frontend changes will be hot-reloaded. You don't need to restart the frontend, unless you try to add a new frontend dependency.

## Restart Backend

Sometimes you need to restart the backend after changed something.

1. Click `Terminal`
1. Click `Codespaces: server-dev` in the right panel
1. Press `Ctrl + C` to stop the server
2. Press `Up` to run `npm run start-server-dev`

![image](https://github.com/louislam/uptime-kuma/assets/1336778/e0c0a350-fe46-4588-9f37-e053c85834d1)
