// Archivo: api/grok.js
// Este archivo maneja las solicitudes a la API de Grok
import fetch from 'node-fetch';

// Función para manejar solicitudes POST
export default async function handler(req, res) {
  // Verificar que sea una solicitud POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" })
  }
  try {
    // Extraer la consulta y el contexto del sistema del cuerpo de la solicitud
    const { query, system } = req.body;

    if (!query) {
      return res.status(400).json({ error: "La consulta es requerida" });
    }    // Cargar y procesar el archivo TSV desde Google Sheets
    let tessfpData = "";
    try {
      const TSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTfyt324lkoc9CpJcc09KaOg47eE4XAFYGBvxPe26xTzfkypdGJlfIlQl5FmobVmlvlsNGpYcZZYhL7/pub?output=tsv";
      console.log("Intentando cargar TSV desde Google Sheets...");
        const response = await fetch(TSV_URL);
      
      if (!response.ok) {
        throw new Error(`Error al obtener TSV: ${response.status} ${response.statusText}`);
      }
      
      const rawData = await response.text();      if (!rawData || rawData.trim() === "") {
        throw new Error("El archivo TSV está vacío");
      }
      
      // Procesar el TSV en un formato más legible
      const lines = rawData.split('\n')
        .map(line => line.trim())
        .filter(Boolean); // Eliminar líneas vacías
        const processed = lines.map(line => {
        const parts = line.split('\t').map(s => s.trim());
        if (parts.length < 2) return null;
        const [category, info] = parts;
        return info ? `${category}: ${info}` : null;
      })
      .filter(Boolean) // Eliminar elementos nulos
      .join('\n');
      
      tessfpData = processed || "Información básica del TESSFP no disponible en este momento.";
      console.log("Datos TSV procesados exitosamente");
    } catch (error) {
      console.warn("Error al cargar TSV:", error.message);
      tessfpData = "Información básica del TESSFP no disponible en este momento.";
    }
    
    // Usar las variables de entorno
    const apiKey = process.env.GROQ_API_KEY;
    const xaiApiKey = process.env.XAI_API_KEY;
    
    if (!apiKey || !xaiApiKey) {
      console.error("Error: API keys no encontradas en las variables de entorno");
      return res.status(500).json({ error: "Error de configuración del servidor" });
    }

    try {      // Llamar directamente a la API de Groq con timeout      console.log("Iniciando llamada a Groq API...");
      const grokResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json"
        },        body: JSON.stringify({
          model: "mixtral-8x7b-32768",
          temperature: 0.5,
          messages: [
            {
              role: "system",
              content: system || `Eres un asistente virtual amigable y conversacional para el TESSFP (Tecnológico de Estudios Superiores de San Felipe del Progreso).
              
              INFORMACIÓN DEL TESSFP:
              ${tessfpData || 'Intentando obtener la información más actualizada del TESSFP...'}
              
              INSTRUCCIONES IMPORTANTES:
              1. Usa la información específica del TESSFP proporcionada arriba para responder preguntas.
              2. Si la información solicitada está en los datos del TSV, úsala de manera precisa.
              3. Si la información no está disponible en los datos proporcionados, indícalo claramente y sugiere contactar directamente al TESSFP.
              
              INSTRUCCIONES ESPECÍFICAS:
              1. Usa la información proporcionada arriba para responder preguntas sobre el TESSFP.
              2. Si la información solicitada no está en los datos proporcionados, indícalo claramente.
              
              IMPORTANTE:
              1) Si ya estás en una conversación, NO saludes nuevamente.
              2) Si alguien responde "sí", "ok" o similar a una pregunta tuya, proporciona la información que ofreciste.
              3) Mantén tus respuestas enfocadas en el tema y el contexto actual.
              4) Sé conciso y directo, evita repetir información.
              5) Para preguntas sobre la escuela que no puedas confirmar en tu base de datos:
                 - Comienza tu respuesta con "No estoy completamente seguro, pero..."
                 - Da una respuesta general basada en el conocimiento común de instituciones educativas
                 - Siempre termina invitando a verificar la información directamente en la escuela o a través de sus redes sociales oficiales
              6) Si no sabes algo específico del TESSFP, sé honesto y sugiere contactar directamente a la institución.`
            },
            ...(req.body.conversationHistory || []).map(msg => ({
              role: msg.role,
              content: msg.content
            })),
            {
              role: "user",
              content: query
            }
          ],
          max_tokens: 500        })
      });

      if (!grokResponse.ok) {
        console.error(`Error de Groq API: ${grokResponse.status}`);
        throw new Error(`Error en la API de Groq: ${grokResponse.status}`);
      }

      const data = await grokResponse.json();
      console.log("Respuesta recibida de Groq API");
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error("Respuesta inesperada de Groq:", JSON.stringify(data));
        throw new Error("Formato de respuesta inválido de Groq");
      }

      const response = data.choices[0].message.content;
      if (!response || typeof response !== 'string') {
        throw new Error("Respuesta vacía o inválida de Groq");
      }

      return res.status(200).json({ response })    } catch (error) {
      console.error("Error detallado al llamar a la API de Groq:", error);
      
      if (error.name === 'AbortError') {
        console.log("La solicitud excedió el tiempo límite, usando respuesta de fallback");
        return res.status(200).json({ 
          response: simulateGrokResponse(query),
          fallback: true,
          error: "La solicitud excedió el tiempo límite"
        });
      }

      console.log("Error en la API, usando respuesta de fallback");
      return res.status(200).json({
        response: simulateGrokResponse(query),
        fallback: true,
        error: error.message
      });    }
  } catch (error) {
    console.error("Error en el handler principal:", error.message);
    return res.status(200).json({
      response: simulateGrokResponse(query || ""),
      fallback: true,
      error: "Error interno del servidor: " + error.message
    });
  }
}

// Función para simular una respuesta de Grok (como fallback)
function simulateGrokResponse(query) {
  // Normalizar la consulta
  const normalizedQuery = query.toLowerCase()

  // Respuestas simuladas basadas en palabras clave
  if (normalizedQuery.includes("clima") || normalizedQuery.includes("tiempo")) {
    return "No tengo acceso a información en tiempo real sobre el clima, pero puedo ayudarte con información sobre el TESSFP."
  }

  if (normalizedQuery.includes("recomienda") || normalizedQuery.includes("sugieres")) {
    return "Como asistente del TESSFP, puedo recomendarte que consultes la página oficial para obtener información actualizada sobre las carreras y servicios que ofrece el Tecnológico."
  }

  if (normalizedQuery.includes("piensas") || normalizedQuery.includes("opinas")) {
    return "Mi función es proporcionar información objetiva sobre el TESSFP, no expresar opiniones personales. ¿Hay algo específico sobre el Tecnológico que te gustaría saber?"
  }

  // Para consultas muy cortas o de una sola letra
  if (normalizedQuery.length < 3) {
    return "Parece que tu mensaje es muy corto. ¿Podrías proporcionar más detalles sobre lo que quieres saber? Estoy aquí para ayudarte con información sobre el TESSFP."
  }

  // Para respuestas afirmativas como "okey", "ok", "sí", etc.
  if (["ok", "okey", "okay", "vale", "si", "sí", "claro", "entendido", "perfecto", "bien"].includes(normalizedQuery)) {
    return "¡Perfecto! Estoy aquí para ayudarte con cualquier información sobre el TESSFP. ¿Hay algo específico que te gustaría saber sobre el Tecnológico?"
  }
  // Respuesta genérica para otras consultas
  if (normalizedQuery.includes("escuela") || normalizedQuery.includes("tessfp") || 
      normalizedQuery.includes("tecnologico") || normalizedQuery.includes("estudiar") ||
      normalizedQuery.includes("carrera") || normalizedQuery.includes("curso")) {
    return "No estoy completamente seguro sobre los detalles específicos, pero te invito a verificar esta información directamente en la escuela o a través de las redes sociales oficiales del TESSFP. ¿Te gustaría que te proporcione los medios de contacto oficiales?"
  }
  return "Estoy aquí para ayudarte principalmente con información sobre el TESSFP. Si tienes alguna pregunta específica sobre el Tecnológico, estaré encantado de asistirte."
}
