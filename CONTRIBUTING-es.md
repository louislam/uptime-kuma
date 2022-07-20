# Información del proyecto

En primer lugar, gracias a todos los que hicieron solicitudes de extracción para Uptime Kuma, ¡nunca pensé que GitHub Community pudiera ser tan agradable! Y también debido a esto, nunca pensé que otras personas realmente leyeran mi código y editaran mi código. No está estructurado y comentado tan bien, jajaja. Lo siento.

El proyecto fue creado con vite.js (vue3). Luego creé un subdirectorio llamado "servidor" para la parte del servidor. Tanto el frontend como el backend comparten el mismo package.json.

El código frontend se integra en el directorio "dist". El servidor (express.js) expone el directorio "dist" como raíz del extremo. Así es como funciona la producción.

## Habilidades técnicas clave

*   Nodo.js (Debe saber qué son la promesa, la función asincrónica / esperada y la flecha, etc.)
*   Socket.io
*   SCSS
*   Vue.js
*   Bootstrap
*   SQLite

## Directorios

*   datos (datos de la aplicación)
*   dist (compilación frontend)
*   extra (Scripts extra útiles)
*   public (recursos de frontend solo para desarrollo)
*   servidor (código fuente del servidor)
*   src (código fuente frontend)
*   prueba (prueba unitaria)

## ¿Puedo crear una solicitud de extracción para Uptime Kuma?

Sí, se puede. Sin embargo, ya que no quiero perder tu tiempo, asegúrate de **Crear una solicitud de extracción de borrador vacía, para que podamos discutir primero** si se trata de una solicitud de extracción grande o no sabe que se fusionará o no.

Además, por favor, no se apresure ni pida ETA, porque tengo que entender la solicitud de extracción, asegurarme de que no sea un cambio de ruptura y apegarse a mi visión de este proyecto, especialmente para solicitudes de extracción grandes.

Marcaré su solicitud de extracción en el [Hitos](https://github.com/louislam/uptime-kuma/milestones), si planeo revisarlo y fusionarlo.

✅ Aceptar:

*   Corrección de errores/seguridad
*   Traducciones
*   Agregar proveedores de notificaciones

⚠️ Discusión primero

*   Grandes solicitudes de extracción
*   Nuevas características

❌ No se fusionará

*   No pase la prueba automática
*   Cualquier cambio de ruptura
*   Solicitud de extracción duplicada
*   Calesa
*   La lógica existente se modifica o elimina por completo sin motivo
*   Una función que está completamente fuera de alcance

### Guía de solicitud de extracción recomendada

Antes de profundizar en la codificación, se prefiere la discusión primero. Se recomienda crear una solicitud de extracción vacía para la discusión.

1.  Bifurcar el proyecto
2.  Clona tu repositorio de bifurcación a local
3.  Crear una nueva rama
4.  Crear una confirmación vacía
    `git commit -m "[empty commit] pull request for <YOUR TASK NAME>" --allow-empty`
5.  Empuje a su repositorio de bifurcación
6.  Crear una solicitud de extracción: https://github.com/louislam/uptime-kuma/compare
7.  Escribe una descripción adecuada
8.  Haga clic en "Cambiar a borrador"
9.  Discusión

## Estilos de proyecto

Personalmente, no me gusta algo que necesite aprender tanto y necesite configurar tanto antes de que finalmente pueda iniciar la aplicación.

*   Fácil de instalar para usuarios que no son de Docker, no se necesita dependencia de compilación nativa (al menos para x86\_64), sin configuración adicional, sin esfuerzo adicional para que se ejecute
*   Contenedor único para usuarios de Docker, no hay un archivo docker-compose muy complejo. Simplemente mapee el volumen y exponga el puerto, luego listo para ir
*   La configuración debe ser configurable en el frontend. No se recomienda la variable de entorno, a menos que esté relacionada con el inicio, como `DATA_DIR`.
*   Fácil de usar
*   El estilo de la interfaz de usuario web debe ser consistente y agradable.

## Estilos de codificación

*   Sangría de 4 espacios
*   Seguir `.editorconfig`
*   Sigue a ESLint
*   Los métodos y funciones deben documentarse con JSDoc

## Convención de nombres

*   Javascript/Typescript: camelCaseType
*   SQLite: snake_case (subrayado)
*   CSS/SCSS: kebab-case (Dash)

## Herramientas

*   Nodo.js >= 14
*   NPM > = 8,5
*   Git
*   IDE compatible con ESLint y EditorConfig (estoy usando IntelliJ IDEA)
*   Una herramienta DE GUI DE SQLite (se sugiere SQLite Expert Personal)

## Instalar dependencias

```bash
npm ci
```

## Servidor de desarrollo

(2022-04-26 Actualización)

Podemos iniciar el servidor de desarrollo frontend y el servidor de desarrollo backend en un solo comando.

Puerto `3000` y puerto `3001` se utilizará.

```bash
npm run dev
```

## Servidor back-end

Se une a `0.0.0.0:3001` por defecto.

Es principalmente una aplicación de socket.io + express.js.

express.js se utiliza para:

*   Punto de entrada, como redirigir a una página de estado o al panel
*   servir a los archivos creados en el frontend (índice.html, .js y .css etc.)
*   servir a las API internas de la página de estado

### Estructura en /server/

*   model/ (Modelo de objetos, asignación automática al nombre de la tabla de la base de datos)
*   modules/ (Módulos modificados de 3ª parte)
*   proveedores de notificaciones/ (lógica de notificación individual)
*   routers/ (Routers Express)
*   controlador de sockets (controladores de Socket.io)
*   servidor.js (punto de entrada del servidor y lógica principal)

## Servidor de desarrollo frontend

Se une a `0.0.0.0:3000` por defecto. El servidor de desarrollo frontend solo se usa para el desarrollo.

Para la producción, no se utiliza. Se compilará en `dist` en su lugar.

Puede usar la extensión de Chrome Vue.js devtools para la depuración.

### Crear el frontend

```bash
npm run build
```

### Detalles del frontend

Uptime Kuma Frontend es una aplicación de una sola página (SPA). La mayoría de las rutas son manejadas por Vue Router.

El router está en `src/router.js`

Como puede ver, la mayoría de los datos en frontend se almacenan en el nivel raíz, a pesar de que cambió el enrutador actual a cualquier otra página.

La lógica de datos y sockets está en `src/mixins/socket.js`.

## Migración de bases de datos

1.  Crear `patch-{name}.sql` en `./db/`
2.  Agregue el nombre de archivo del parche en el `patchList` lista en `./server/database.js`

## Prueba unitaria

Es una prueba de extremo a extremo. Está usando Jest y Puppeteer.

```bash
npm run build
npm test
```

De forma predeterminada, la ventana Cromo se mostrará durante la prueba. Especificar `HEADLESS_TEST=1` para entornos terminales.

## Actualizar dependencias

Instalar `ncu`
https://github.com/raineorshine/npm-check-updates

```bash
ncu -u -t patch
npm install
```

Dado que la actualización anterior de Vite 2.5.10 a 2.6.0 rompió la aplicación por completo, a partir de ahora, debería actualizar solo la versión de lanzamiento del parche.

Liberación del parche = el tercer dígito ([Control de versiones semántico](https://semver.org/))

## Traducciones

Por favor, lea: https://github.com/louislam/uptime-kuma/tree/master/src/languages

## Wiki

Dado que no hay forma de hacer una solicitud de extracción al repositorio de wiki, he configurado otro repositorio para hacerlo.

https://github.com/louislam/uptime-kuma-wiki

## Mantenedor

Compruebe los últimos problemas y solicitudes de extracción:
https://github.com/louislam/uptime-kuma/issues?q=sort%3Aupdated-desc

### Procedimientos de liberación

1.  Redactar una nota de la versión
2.  Asegúrese de que el repositorio esté borrado
3.  ` npm run release-final with env vars:  `VERSIÓN`and`GITHUB_TOKEN'
4.  Espere hasta el `Press any key to continue`
5.  `git push`
6.  Publicar la nota de la versión como 1.X.X
7.  Presione cualquier tecla para continuar
8.  SSH al servidor del sitio de demostración y actualización a 1.X.X

Comprobación:

*   Verifique que todas las etiquetas estén bien en https://hub.docker.com/r/louislam/uptime-kuma/tags
*   Pruebe la imagen de Docker con la etiqueta 1.X.X (Clean install / amd64 / arm64 / armv7)
*   Pruebe la instalación limpia con Node.js

### Procedimientos de release beta

1.  Redacte una nota de la versión, marque "Esta es una versión preliminar"
2.  Asegúrese de que el repositorio esté borrado
3.  `npm run release-beta` con env vars: `VERSION` y `GITHUB_TOKEN`
4.  Espere hasta el `Press any key to continue`
5.  Publicar la nota de la versión como 1.X.X-beta.X
6.  Presione cualquier tecla para continuar

### Liberar Wiki

#### Repositorio de configuración

```bash
git clone https://github.com/louislam/uptime-kuma-wiki.git
cd uptime-kuma-wiki
git remote add production https://github.com/louislam/uptime-kuma.wiki.git
```

#### Empuje a la wiki de producción

```bash
git pull
git push production master
```
