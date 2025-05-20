# Chat Bot TESSFP

Un chatbot interactivo para el Tecnológico de Estudios Superiores de San Felipe del Progreso (TESSFP).

## Características

- Interfaz de chat amigable
- Respuestas naturales y contextuales
- Integración con la API de Groq
- Sistema de fallback para respuestas offline
- Manejo de contexto en conversaciones
- Soporte para reconocimiento de voz

## Instalación

1. Clona el repositorio:
```bash
git clone <URL_DEL_REPOSITORIO>
```

2. Instala las dependencias:
```bash
npm install
```

3. Crea un archivo `config.json` en la raíz del proyecto con las siguientes claves:
```json
{
    "groqApiKey": "TU_CLAVE_API_GROQ",
    "xaiApiKey": "TU_CLAVE_API_XAI"
}
```

4. Inicia el servidor:
```bash
npm start
```

## Uso

El chatbot estará disponible en `http://localhost:3000`. Puedes interactuar con él mediante:
- Entrada de texto
- Comandos de voz (si el navegador lo soporta)

## Tecnologías utilizadas

- Node.js
- Express
- Groq API
- JavaScript vanilla para el frontend

## Configuración

El proyecto utiliza las siguientes variables de configuración:
- `groqApiKey`: Tu clave API de Groq
- `xaiApiKey`: Tu clave API de XAI

Asegúrate de mantener estas claves seguras y no compartirlas públicamente.

## Contribuir

1. Haz un fork del repositorio
2. Crea una rama para tu característica (`git checkout -b feature/AmazingFeature`)
3. Haz commit de tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Haz push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Distribuido bajo la Licencia MIT. Ver `LICENSE` para más información.
