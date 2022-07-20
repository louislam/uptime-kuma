# Tiempo de actividad Kuma

<a target="_blank" href="https://github.com/louislam/uptime-kuma"><img src="https://img.shields.io/github/stars/louislam/uptime-kuma" /></a> <a target="_blank" href="https://hub.docker.com/r/louislam/uptime-kuma"><img src="https://img.shields.io/docker/pulls/louislam/uptime-kuma" /></a> <a target="_blank" href="https://hub.docker.com/r/louislam/uptime-kuma"><img src="https://img.shields.io/docker/v/louislam/uptime-kuma/latest?label=docker%20image%20ver." /></a> <a target="_blank" href="https://github.com/louislam/uptime-kuma"><img src="https://img.shields.io/github/last-commit/louislam/uptime-kuma" /></a>  <a target="_blank" href="https://opencollective.com/uptime-kuma"><img src="https://opencollective.com/uptime-kuma/total/badge.svg?label=Open%20Collective%20Backers&color=brightgreen" /></a>
[![GitHub Sponsors](https://img.shields.io/github/sponsors/louislam?label=GitHub%20Sponsors)](https://github.com/sponsors/louislam)

<div align="center" width="100%">
    <img src="./public/icon.svg" width="128" alt="" />
</div>

Es una herramienta de monitoreo autohospedada como "Uptime Robot".

<img src="https://uptime.kuma.pet/img/dark.jpg" width="700" alt="" />

## 🥔 Demostración en vivo

¡Pruébalo!

https://demo.uptime.kuma.pet

Es una demostración temporal en vivo, todos los datos se eliminarán después de 10 minutos. El servidor se encuentra en Tokio, por lo que si vives lejos de allí, puede afectar tu experiencia. Le sugiero que lo instale y lo pruebe para obtener la mejor experiencia de demostración.

VPS es patrocinado por los patrocinadores de Uptime Kuma en [Colectivo Abierto](https://opencollective.com/uptime-kuma)! ¡Muchas gracias!

## ⭐ Funciones

*   Monitoreo del tiempo de actividad para HTTP (s) / TCP / HTTP (s) Palabra clave / Ping / Registro DNS / Push / Steam Game Server.
*   Elegante, reactivo, rápido UI / UX.
*   Notificaciones a través de Telegram, Discord, Gotify, Slack, Pushover, correo electrónico (SMTP) y [Más de 90 servicios de notificación, haga clic aquí para ver la lista completa](https://github.com/louislam/uptime-kuma/tree/master/src/components/notifications).
*   Intervalos de 20 segundos.
*   [Multi Idiomas](https://github.com/louislam/uptime-kuma/tree/master/src/languages)
*   Varias páginas de estado
*   Asignar página de estado al dominio
*   Gráfico de ping
*   Información del certificado
*   Soporte de proxy
*   2FA disponible

## 🔧 Cómo instalar

### 🐳 Estibador

```bash
docker run -d --restart=always -p 3001:3001 -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:1
```

⚠️ Por favor, utilice un **volumen local** solamente. Otros tipos como NFS no son compatibles.

Vaya a http://localhost:3001 después de comenzar.

### 💪🏻 No Docker

Herramientas requeridas:

*   [Nodo.js](https://nodejs.org/en/download/) >= 14
*   [Git](https://git-scm.com/downloads)
*   [pm2](https://pm2.keymetrics.io/) - Para ejecutar en segundo plano

```bash
# Update your npm to the latest version
npm install npm -g

git clone https://github.com/louislam/uptime-kuma.git
cd uptime-kuma
npm run setup

# Option 1. Try it
node server/server.js

# (Recommended) Option 2. Run in background using PM2
# Install PM2 if you don't have it: 
npm install pm2 -g && pm2 install pm2-logrotate

# Start Server
pm2 start server/server.js --name uptime-kuma


```

Vaya a http://localhost:3001 después de comenzar.

Comandos PM2 más útiles

```bash
# If you want to see the current console output
pm2 monit

# If you want to add it to startup
pm2 save && pm2 startup
```

### Instalación avanzada

Si necesita más opciones o necesita navegar a través de un proxy inverso, lea:

https://github.com/louislam/uptime-kuma/wiki/%F0%9F%94%A7-How-to-Install

## 🆙 Cómo actualizar

Por favor, lea:

https://github.com/louislam/uptime-kuma/wiki/%F0%9F%86%99-How-to-Update

## 🆕 ¿Qué sigue?

Marcaré las solicitudes / problemas en el próximo hito.

https://github.com/louislam/uptime-kuma/milestones

Plan del proyecto:

https://github.com/louislam/uptime-kuma/projects/1

## ❤️ Patrocinadores

¡Muchas gracias! (Los patrocinadores de GitHub se actualizarán manualmente. Los patrocinadores de OpenCollective se actualizarán automáticamente, sin embargo, gitHub almacenará en caché la lista. Puede necesitar algún tiempo para ser actualizado)

<img src="https://uptime.kuma.pet/sponsors?v=6" alt />

## 🖼 Más imágenes

Modo de luz:

<img src="https://uptime.kuma.pet/img/light.jpg" width="512" alt="" />

Página de estado:

<img src="https://user-images.githubusercontent.com/1336778/134628766-a3fe0981-0926-4285-ab46-891a21c3e4cb.png" width="512" alt="" />

Página de configuración:

<img src="https://louislam.net/uptimekuma/2.jpg" width="400" alt="" />

Ejemplo de notificación de Telegram:

<img src="https://louislam.net/uptimekuma/3.jpg" width="400" alt="" />

## Motivación

*   Estaba buscando una herramienta de monitoreo autohospedada como "Uptime Robot", pero es difícil encontrar una adecuada. Uno de los más cercanos es el statping. Desafortunadamente, no es estable y ya no se mantiene.
*   Desea crear una interfaz de usuario elegante.
*   Aprende Vue 3 y vite.js.
*   Muestra la potencia de Bootstrap 5.
*   Intente usar WebSocket con SPA en lugar de la API rest.
*   Implementar mi primera imagen de Docker en Docker Hub.

Si te encanta este proyecto, por favor considera darme un ⭐ .

## 🗣️ Discusión

### Página de problemas

Puedes discutir o pedir ayuda en [cuestiones](https://github.com/louislam/uptime-kuma/issues).

### Subreddit

Mi cuenta de Reddit: louislamlam
Puedes mencionarme si haces una pregunta en Reddit.
https://www.reddit.com/r/UptimeKuma/

## Contribuir

### Versión beta

Echa un vistazo a la última versión beta aquí: https://github.com/louislam/uptime-kuma/releases

### Informes de errores / Solicitudes de funciones

Si desea informar de un error o solicitar una nueva función, no dude en abrir un [nuevo número](https://github.com/louislam/uptime-kuma/issues).

### Traducciones

Si desea traducir Uptime Kuma a su idioma, lea: https://github.com/louislam/uptime-kuma/tree/master/src/languages

Siéntase libre de corregir mi gramática en este README, código fuente o wiki, ya que mi idioma materno no es el inglés y mi gramática no es tan buena.

### Solicitudes de extracción

Si desea modificar Uptime Kuma, esta guía puede ser útil para usted: https://github.com/louislam/uptime-kuma/blob/master/CONTRIBUTING.md
