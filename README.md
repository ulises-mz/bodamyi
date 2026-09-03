# Inés & Marcel — La Velada

Invitación digital para la boda de Inés y Marcel, versión "La Velada":
lino, chocolate y salvia, con el trailer *Save the Date* dentro de un arco.

- **Fecha**: viernes 27 de noviembre de 2026 · Acto civil 5:00 PM · Cena 7:00 PM
- **Lugar**: Vino Mundo, Ciudad Colón
- **RSVP**: hasta el 15 de septiembre de 2026 (Supabase, misma tabla que la invitación original)
- **Personalización por enlace**: `?invitado=Nombre&n=12` escribe el nombre en la tarjeta y numera la invitación.

Sitio estático sin build: `index.html`, `velada.css`, `velada.js`, `rsvp.js`, `rsvp-api.js`.
El vídeo se sirve como `.m4v` para que la CDN no rompa las peticiones por rango que Safari exige.

Desarrollo local: `npx serve . -l 4175`
