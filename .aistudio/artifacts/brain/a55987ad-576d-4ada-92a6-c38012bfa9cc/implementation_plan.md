# Voz y tono de tyba — Plan de implementación (Consolidado)

Aplicación web full-stack minimalista diseñada para que cualquier integrante del equipo de tyba (Colombia, Perú y Chile) ajuste copys o capturas de interfaz a las reglas oficiales de voz y tono, recibiendo 3 opciones alineadas, diagnóstico, «Sí hacer» y «No hacer», fundamentada en las fuentes oficiales adjuntas y el skill `tyba-voz-y-tono`.

> [!IMPORTANT]
> **Fuentes y directrices consolidadas:**
> - **Fuentes oficiales incorporadas al sistema:**
>   1. `tyba_73c89e13`: Arquetipos de personalidad (Sabio 40%, Cuidador 30%, Compañero 30%), pilares (Oferta, Credibilidad, Adaptabilidad), momentos del journey (Descubrimiento, Activación, Inversión activa, Retención), reglas fijas de voz, y glosario de productos de Credicorp Capital (FIC/FFMM, FVP, Tyba Pocket, CDT digital, Acciones y ETFs).
>   2. `Microcopy_y_buenas_pr_cticas_78fce993`: Aportes de UX Writing y Kinneret Yifrah para tyba (microcopy es diseño, no es marketing publicitario, anticipar dudas, transparencia ante riesgos, CTAs con verbos de acción directa).
>   3. `Global_Guidelines_e57e6d52`: Reglas de UX para modales/diálogos (centrado <3 líneas / <20 palabras; alineado a la izquierda >3 líneas; reglas para modales destructivos y de abandono de procesos).
>   4. `tyba-voz-y-tono` (Skill en `/skills/user_skills/tyba-voz-y-tono/SKILL.md`): Tono fijo de 4 dimensiones, regla de «nosotros» y tuteo, estructura de 3 partes (apertura + núcleo + cierre), frases aprobadas de oferta internacional y lista de prohibiciones.
> - **Atajos rápidos de canales:** Accesos directos para insertar ejemplos típicos de **Push**, **WhatsApp**, **Microcopy (botones/errores)** y **Modales (abandono/alerta)** además del ejemplo principal.
> - **Modo de respaldo local:** Banner informativo destacado con opción de reintento con IA si el servidor o la cuota fallan.

---

## 1. Visión general y concepto clave

- **Qué hace:** Permite ingresar un texto, pegar/arrastrar una captura de pantalla (PNG, JPEG, WebP) o usar ejemplos predefinidos. El backend procesa la solicitud con `gemini-3.8-flash` bajo la instrucción de sistema oficial de tyba enriquecida con las directrices de UX Writing y devuelve un JSON estructurado con: lectura de captura, diagnóstico, exactamente 3 opciones con nota explicativa, 3-4 «Sí hacer» y 3-4 «No hacer».
- **Audiencia:** Diseñadores de producto, UX writers, redactores, creadores de contenido, equipos de soporte, growth y marketing en tyba (Credicorp Capital).
- **Valor diferencial:** Sin necesidad de cuentas de IA personales ni tokens expuestos. Privacidad total (cero registro de copys), cuota protegida por IP, y un motor de reglas de respaldo local que asegura continuidad operativa si la red o la cuota fallan.

---

## 2. Experiencia de usuario y diseño visual

- **Estructura y ritmo:**
  - Columna única centrada de 680 px con espaciado amplio y aire.
  - Tipografía `Inter` en toda la interfaz.
  - Paleta de marca tyba:
    - **Azul tyba:** `#0069E9` (acento principal, subrayados, estados activos)
    - **Azul profundo:** `#0A3699` (hover, énfasis secundario)
    - **Azul pálido:** `#C8DBFF` (fondos de selección y estados suaves)
    - **Tinta:** `#0B1220` (texto principal, fondo en modo oscuro)
    - **Papel:** `#F7FAFF` (fondo principal claro)
  - Modo claro / oscuro armónico respetando tokens semánticos y `@custom-variant dark`.
  - Cero tarjetas repetidas, sin etiquetas en mayúsculas, sin numeración 01/02/03 mecánica, sin degradados llamativos.
- **Flujo de navegación (dos pestañas en encabezado):**
  1. **«Ajustar un copy»**:
     - Título: *«Haz que tu copy suene a tyba.»*
     - Subtítulo breve explicativo.
     - Caja de texto amplia con placeholder *«Pega un copy, cuéntanos qué necesitas o sube una captura de pantalla»*.
     - Barra de herramientas con:
       - Botón «Adjuntar captura» (admite clic, arrastrar y soltar, y pegar directo desde el portapapeles `Ctrl+V`), con miniatura previa y opción para removerla.
       - Enlace «Probar con un ejemplo» y accesos rápidos (Push, WhatsApp, Microcopy, Modal).
       - Contador de caracteres (máx. 4.000).
       - Botón principal de acción: **«Ajustar»**.
     - **Estado de carga:** *«Revisando con la guía de voz y tono»* con animación sutil de puntos y botón interactivo «Cancelar» (AbortController).
     - **Bloque de resultados:**
       - Línea con la lectura de la captura (si se adjuntó imagen).
       - Diagnóstico (1-2 frases del desalineamiento o confirmación).
       - 3 opciones de copy (19 px legibles, nota a la izquierda como «Más breve», botón «Copiar» con feedback táctil).
       - 2 columnas: **«Sí hacer»** (azul con checkmark) y **«No hacer»** (rojo tenue con cruz).
       - Enlace interactivo **«Pedir otras opciones»** que envía las opciones anteriores para recibir 3 variaciones frescas.
  2. **«Cómo hablamos»** (accesible vía pestaña o enlace `#ejemplos`):
     - Título: *«Así hablamos en tyba.»*
     - Subtítulo: *«Cada mensaje abre con calidez, informa con claridad y cierra con un impulso moderado. Siempre en «tú», siempre en «nosotros».»*
     - Lista de los 5 casos principales con contexto en gris, copy recomendado en 20 px, botón «Copiar», y línea «Evitamos» con frase tachada.
     - Sección *«Otros momentos»*: Bienvenida, Confirmación de aporte, y Algo falla en la app.
     - Sección *«Guías de UX & Microcopy»*: Buenas prácticas para modales (centrado vs izquierda, acciones destructivas), CTAs directos y prevención de fricción.

---

## 3. Decisiones técnicas clave

- **Backend seguro Node/Express con `@google/genai`:**
  - La clave `GEMINI_API_KEY` reside exclusivamente en variables de entorno del servidor.
  - Endpoint `POST /api/ajustar` con limitador de tasa en memoria por IP (8 peticiones/minuto, 60 peticiones/día).
  - CORS restringido al origen propio y `https://tyba-design.github.io`.
  - Validación rigurosa de entrada (texto $\le$ 4.000 caracteres, imagen $\le$ 4 MB y tipo mime PNG/JPEG/WEBP).
- **Instrucción de sistema para Gemini:**
  - Incluye la instrucción completa de voz y tono del prompt inicial.
  - Enriquecida con el conocimiento de las fuentes: pautas de microcopy de producto, alineaciones de modales, arquetipos (Sabio/Cuidador/Compañero) y glosario de Credicorp Capital.
  - Modelo: `gemini-3.8-flash` con temperatura 0.7 y salida JSON estructurada vía `responseSchema`.
- **Motor de respaldo local (client-side rule engine):**
  - Implementado en TypeScript en el navegador (`src/lib/reglasRespaldo.ts`).
  - Corrige automáticamente: «bienvenido/a» $\rightarrow$ «te damos la bienvenida», «tranquilo/a» $\rightarrow$ «no te preocupes», «colocar dinero» $\rightarrow$ «invertir», verbos en «yo» a «nosotros» (puedo $\rightarrow$ podemos, etc.), y remueve emojis.
  - Detecta e inspecciona: «usted», superlativos, promesas de rentabilidad/seguridad, «invierte en tyba», asesoría cerrada, adjetivos con género, exceso de exclamaciones, menciones de inversión internacional no homologadas.
  - Entrega 3 opciones corregidas + ejemplos de la guía por concordancia temática + Sí hacer y No hacer.

---

## 4. Arquitectura del sistema y flujo de datos

```
┌───────────────────────────────────────────────────────────────┐
│                      Navegador (React + TS)                   │
│                                                               │
│  ┌────────────────────────┐      ┌─────────────────────────┐  │
│  │   Ajustar un copy      │      │     Cómo hablamos       │  │
│  │   - Textarea + Imagen  │      │     - Guía y ejemplos   │  │
│  │   - Atajos / Ejemplos  │      │     - Microcopy & Modal │  │
│  │   - Modo oscuro/claro  │      │     - Botones copiar    │  │
│  └───────────┬────────────┘      └─────────────────────────┘  │
│              │                                                │
│              ▼                                                │
│    POST /api/ajustar ──────────┐                              │
│    (AbortController)           │                              │
│                                │ Error / Límite excedido      │
│                                ▼                              │
│                     ┌──────────────────────┐                  │
│                     │  Motor de Reglas     │                  │
│                     │  Local (Respaldo)    │                  │
│                     └──────────────────────┘                  │
└────────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────┐
│                  Servidor Express (server.ts)                 │
│                                                               │
│  1. CORS (origen propio + tyba-design.github.io)              │
│  2. Rate limiter por IP (8/min, 60/día)                       │
│  3. Validación de payload (4k chars, 4MB imagen)              │
│  4. Cero almacenamiento o logs de contenido                   │
│                                                               │
│                      Google GenAI SDK                         │
│                    ('gemini-3.8-flash')                       │
│             Instrucción de sistema de Voz y Tono              │
│                 Salida JSON estructurada                      │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. Plan de ejecución por fases

1. **Configuración del servidor full-stack:**
   - Crear `server.ts` con Express, integrando Vite middlewares en desarrollo y sirviendo estáticos en producción.
   - Endpoint `POST /api/ajustar` con `gemini-3.8-flash`, CORS, IP rate limiter (8/min, 60/día), y validación de payload.
   - Configurar scripts de ejecución en `package.json` (`"dev": "tsx server.ts"` y `"start": "node dist/server.js"` o `"tsx server.ts"`).
2. **Motor de reglas de respaldo (`src/lib/reglasRespaldo.ts`):**
   - Lógica de reemplazo automático (género, 'yo' $\rightarrow$ 'nosotros', tuteo, términos clave, emojis).
   - Generador de diagnósticos y matriz de do's & don'ts según violaciones detectadas.
3. **Componentes e interfaz tyba (`src/App.tsx`, `src/index.css`):**
   - Configuración Tailwind con `@custom-variant dark` y paleta de colores de tyba.
   - Pestañas «Ajustar un copy» y «Cómo hablamos».
   - Soporte para pegado directo de capturas (`onPaste`), arrastrar y soltar, miniatura con botón de eliminar.
   - Presentación de opciones con tipografía en 19/20 px, botón de copia rápida, columnas de Sí/No hacer.
   - Banner de fallback interactivo con reintento asistido por IA.
4. **Verificación y pruebas:**
   - Pruebas con los casos de aceptación descritos (caso bienvenido/tranquilo/tasas, retiro total, y respaldo sin red).
   - `compile_applet` y `lint_applet` combinados.
