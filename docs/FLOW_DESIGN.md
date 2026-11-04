# Bot de Primavera Urbana – Diseño del flujo

Asistente de WhatsApp (Twilio) que da información del Centro Comercial Primavera Urbana
(Villavicencio, Meta). Toda la información sale de `PrimaveraUrbana-Chatbot-Preguntas-Data.docx`,
transcrita en `src/data/knowledgeBase.js`.

## Arquitectura

```
Usuario (WhatsApp) → Twilio → POST /webhook → routes/webhook.js
                                                 │
                       ┌─────────────────────────┼──────────────────────────┐
                       ▼                         ▼                          ▼
              Saludo / "menú"           Número de opción             Pregunta libre
              → menú principal          → respuesta fija              → Claude + base de
                                          (utils/messages.js)           conocimiento (services/ai.js)
```

## Flujo

1. **Saludo** ("hola", "buenas tardes"...) → bienvenida + menú numerado.
2. **Menú principal**
   1. Horarios
   2. Ubicación (con enlace a Google Maps)
   3. Tiendas y marcas → submenú con las 10 tiendas → detalle (local, piso, descripción)
   4. Eventos y sorteos (el sorteo de la camioneta muestra si está vigente o finalizado según la fecha)
   5. Parqueadero y servicios
   6. Atención al cliente / PQRS
   7. Redes sociales
3. **Preguntas libres** ("¿dónde queda Adidas?", "¿hay cajero?") → Claude responde **solo** con la base
   de conocimiento. Si el dato no existe, lo dice y remite al directorio o a Atención al Cliente.
4. Si el primer mensaje ya es una pregunta, el bot saluda y la responde directamente.
5. "menú" / "inicio" en cualquier momento vuelve al menú principal.
6. Imágenes o audios sin texto → aviso de que solo se atiende texto.

## Estados (`flows/stateMachine.js`)

| Estado       | Significado                                  |
|--------------|----------------------------------------------|
| `IDLE`       | Sin conversación → el próximo mensaje saluda |
| `MENU`       | Se mostró el menú principal                  |
| `STORE_LIST` | Se mostró la lista de tiendas                |
| `CHATTING`   | Conversación en curso                        |

Los números se resuelven contra la **última lista mostrada** (`session.pendingButtonMap`).
Solo un mensaje que es únicamente un número cuenta como opción.

## Actualizar la información

Edita `src/data/knowledgeBase.js`: los menús y el prompt de la IA se generan a partir de ahí.
Para un nuevo sorteo con fechas, agrega `startDate` / `endDate` (YYYY-MM-DD) y el bot calculará
si está vigente.

## Archivos

```
src/
├── index.js                 # Servidor Express
├── routes/webhook.js        # Enrutador de mensajes (saludo, menú, opciones, preguntas)
├── handlers/info.js         # Respuestas del menú, tiendas y preguntas libres
├── data/knowledgeBase.js    # Información del centro comercial (fuente única)
├── services/
│   ├── ai.js                # Claude (respuestas basadas en la base de conocimiento)
│   ├── session.js           # Sesiones en memoria (24 h) + historial
│   └── whatsapp.js          # Cliente Twilio WhatsApp
├── flows/stateMachine.js    # Estados
└── utils/messages.js        # Plantillas de texto
legacy/editbot/              # Código anterior (bot de edición de video), ya no se usa
```
