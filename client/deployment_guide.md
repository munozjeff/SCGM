# Guía de Despliegue en Firebase Hosting

Esta guía te ayudará a desplegar tu aplicación React (Vite) en Firebase Hosting.

## 1. Prerrequisitos
Asegúrate de estar en la carpeta del cliente:
`cd c:\Users\jeff\Documents\Antigravity\SCGM\client`

## 2. Instalar Firebase CLI
Si no tienes las herramientas de Firebase instaladas, ejecutas:
```bash
npm install -g firebase-tools
```

## 3. Iniciar Sesión
Loguéate con tu cuenta de Google:
```bash
firebase login
```

## 4. Inicializar Proyecto (Solo la primera vez)
```bash
firebase init hosting
```
- Cuando pregunte **"What do you want to use as your public directory?"**, escribe: `dist`
- Cuando pregunte **"Configure as a single-page app (rewrite all urls to /index.html)?"**, escribe: `y` (Sí)
- **IMPORTANTE:** Si preguntas **"Set up automatic builds and deploys with GitHub?"**, puedes decir `n` (No) por ahora.
- Si pregunta **"File dist/index.html already exists. Overwrite?"**, di `n` (No).

## 5. Construir la Aplicación
Genera los archivos optimizados para producción:
```bash
npm run build
```
*(Esto creará la carpeta `dist` con tu app lista)*

## 6. Desplegar
Sube los archivos a Firebase:
```bash
firebase deploy
```

¡Listo! La terminal te mostrará la URL de tu aplicación (ej. `https://tu-proyecto.web.app`).
