// URL del archivo TSV
const TSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTfyt324lkoc9CpJcc09KaOg47eE4XAFYGBvxPe26xTzfkypdGJlfIlQl5FmobVmlvlsNGpYcZZYhL7/pub?output=tsv"

// Configuración del Blob Store para almacenamiento
const BLOB_API_URL = "/api/blob"

// Variables globales
let tsvData = []
let headers = []
let knowledgeBase = {}
let conversationHistory = []
let currentConversationId = generateUniqueId()
let savedConversations = []
const suggestionsShown = false
let isDarkTheme = false
let commonQuestions = [] // Declarar commonQuestions
const userGreeted = false // Variable para rastrear si el usuario ya fue saludado
let lastQuestion = null // Variable para almacenar la última pregunta formulada

// Variables para reconocimiento de voz
let recognition = null
let isListening = false
let voiceNotification = null

// Elementos del DOM
let chatMessages
let userInput
let sendButton
let voiceButton
let saveButton
let historyButton
let themeButton
let suggestionsContainer
let historyModal
let historyList

// Funciones auxiliares (declaración)
function generateUniqueId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  const costs = new Array()
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i
    for (let j = 0; j <= shorter.length; j++) {
      if (i == 0) costs[j] = j
      else {
        if (j > 0) {
          let newValue = costs[j - 1]
          if (longer.charAt(i - 1) != shorter.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
          costs[j - 1] = lastValue
          lastValue = newValue
        }
      }
    }
    if (i > 0) costs[shorter.length] = lastValue
  }

  return (longer.length - costs[shorter.length]) / Number.parseFloat(longer.length)
}

function loadSavedConversations() {
  try {
    const savedData = localStorage.getItem("chatbotConversations")
    if (savedData) {
      savedConversations = JSON.parse(savedData)
    }
  } catch (error) {
    console.error("Error al cargar las conversaciones guardadas:", error)
  }
}

function initSpeechRecognition() {
  window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!window.SpeechRecognition) {
    console.log("Speech Recognition API is not supported in this browser.")
    return
  }

  recognition = new window.SpeechRecognition()
  recognition.lang = "es-MX" // Establecer el idioma a español de México
  recognition.continuous = false // No mantener la escucha continua
  recognition.interimResults = false // No mostrar resultados intermedios

  recognition.onstart = () => {
    isListening = true
    voiceButton.classList.add("listening")
    voiceNotification.classList.add("active")
    voiceNotification.textContent = "Escuchando..."
  }

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0])
      .map((result) => result.transcript)
      .join("")

    userInput.value = transcript
    handleUserMessage()
  }

  recognition.onend = () => {
    isListening = false
    voiceButton.classList.remove("listening")
    voiceNotification.classList.remove("active")
    voiceNotification.textContent = "¡Di algo!"
  }

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error)
    voiceNotification.classList.remove("active")
    voiceNotification.textContent = "Error al escuchar"
  }
}

function createVoiceNotification() {
  voiceNotification = document.createElement("div")
  voiceNotification.id = "voice-notification"
  voiceNotification.className = "voice-notification"
  voiceNotification.textContent = "¡Di algo!"
  document.body.appendChild(voiceNotification)
}

function toggleSpeechRecognition() {
  if (recognition) {
    if (isListening) {
      recognition.stop()
    } else {
      recognition.start()
    }
  } else {
    console.warn("Speech recognition not initialized.")
  }
}

function saveCurrentConversation() {
  const conversation = {
    id: currentConversationId,
    messages: conversationHistory,
    timestamp: new Date().toISOString(),
  }

  savedConversations.push(conversation)
  localStorage.setItem("chatbotConversations", JSON.stringify(savedConversations))

  // Actualizar la lista del historial
  displayConversationInHistory(conversation)

  // Generar un nuevo ID para la siguiente conversación
  currentConversationId = generateUniqueId()
  conversationHistory = []

  alert("¡Conversación guardada!")
}

function openHistoryModal() {
  historyModal.style.display = "block"
  displaySavedConversations()
}

function closeHistoryModal() {
  historyModal.style.display = "none"
}

function displaySavedConversations() {
  historyList.innerHTML = "" // Limpiar la lista antes de mostrar

  // Cargar las conversaciones guardadas desde localStorage
  loadSavedConversations()

  if (savedConversations.length === 0) {
    historyList.innerHTML = "<p class='no-history'>No hay conversaciones guardadas.</p>"
    return
  }

  // Mostrar cada conversación en la lista
  savedConversations.forEach((conversation) => {
    displayConversationInHistory(conversation)
  })
}

function displayConversationInHistory(conversation) {
  const listItem = document.createElement("div")
  listItem.classList.add("history-item")

  // Formatear la fecha y hora
  const date = new Date(conversation.timestamp)
  const formattedDate = date.toLocaleDateString()
  const formattedTime = date.toLocaleTimeString()

  // Crear el título del historial
  const title = document.createElement("h3")
  title.textContent = `Conversación del ${formattedDate} a las ${formattedTime}`
  listItem.appendChild(title)

  // Mostrar un resumen de la conversación
  const summary = document.createElement("p")
  if (conversation.messages.length > 0) {
    const firstMessage = conversation.messages.find((msg) => msg.role === "user")
    if (firstMessage) {
      summary.textContent = firstMessage.content
    } else {
      summary.textContent = "Conversación sin mensajes de usuario"
    }
  } else {
    summary.textContent = "Conversación vacía"
  }
  listItem.appendChild(summary)

  // Añadir la fecha
  const dateElement = document.createElement("div")
  dateElement.classList.add("history-date")
  dateElement.textContent = `${formattedDate}`
  listItem.appendChild(dateElement)

  // Añadir evento para cargar la conversación
  listItem.addEventListener("click", () => {
    // Aquí se podría implementar la carga de la conversación
    closeHistoryModal()
  })

  historyList.appendChild(listItem)
}

function addBotMessage(message) {
  const botMessage = document.createElement("div")
  botMessage.classList.add("chat-message", "bot-message")
  botMessage.innerHTML = message
  chatMessages.appendChild(botMessage)
  chatMessages.scrollTop = chatMessages.scrollHeight // Auto-scroll
}

function addSuggestions() {
  // Esta función ahora solo se usa para el mensaje inicial
  const suggestionsContainer = document.createElement("div")
  suggestionsContainer.classList.add("suggestions-container")

  commonQuestions.forEach((question) => {
    const suggestionButton = document.createElement("button")
    suggestionButton.classList.add("suggestion-button")
    suggestionButton.textContent = question
    suggestionButton.addEventListener("click", () => {
      userInput.value = question
      handleUserMessage()
    })
    suggestionsContainer.appendChild(suggestionButton)
  })

  chatMessages.appendChild(suggestionsContainer)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
}

function isGreeting(message) {
  const greetings = ["hola", "buenos dias", "buenas tardes", "buenas noches", "saludos"]
  const normalizedMessage = normalizeText(message)
  return greetings.some((greeting) => normalizedMessage.includes(greeting))
}

// Función para manejar el mensaje del usuario
function handleUserMessage() {
  const message = userInput.value.trim()

  if (message) {
    // Añadir mensaje del usuario al chat
    addUserMessage(message)

    // Limpiar el input
    userInput.value = ""

    // Mostrar indicador de carga
    showLoadingIndicator()

    // Guardar el mensaje como última pregunta si no es una respuesta afirmativa
    if (!isAffirmativeResponse(message)) {
      lastQuestion = message
    }

    // Procesar la pregunta y generar respuesta
    setTimeout(() => {
      processUserQuery(message)
    }, 500)
  }
}

// Función para añadir el mensaje del usuario al chat
function addUserMessage(message) {
  const userMessage = document.createElement("div")
  userMessage.classList.add("chat-message", "user-message")
  userMessage.textContent = message
  chatMessages.appendChild(userMessage)

  // Guardar en el historial
  conversationHistory.push({ role: "user", content: message, timestamp: new Date().toISOString() })

  chatMessages.scrollTop = chatMessages.scrollHeight // Auto-scroll
}

// Inicializar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM cargado, inicializando chatbot...")

  // Inicializar elementos del DOM
  initializeDOM()

  // Cargar tema guardado
  loadThemePreference()

  // Cargar datos y configurar eventos
  fetchTSVData()

  // Cargar conversaciones guardadas
  loadSavedConversations()

  // Configurar eventos
  setupEventListeners()

  // Inicializar reconocimiento de voz
  initSpeechRecognition()

  // Crear notificación de voz
  createVoiceNotification()
})

// Función para inicializar elementos del DOM
function initializeDOM() {
  chatMessages = document.getElementById("chat-messages")
  userInput = document.getElementById("user-input")
  sendButton = document.getElementById("send-btn")
  voiceButton = document.getElementById("voice-btn")
  saveButton = document.getElementById("save-chat-btn")
  historyButton = document.getElementById("view-history-btn")
  themeButton = document.getElementById("toggle-theme-btn")
  suggestionsContainer = document.getElementById("suggestions-container")
  historyModal = document.getElementById("history-modal")
  historyList = document.getElementById("history-list")

  // Verificar que los elementos existen
  if (!chatMessages || !userInput || !sendButton || !voiceButton) {
    console.error("No se pudieron encontrar los elementos del DOM necesarios")
    alert("Error al cargar la interfaz. Por favor, recarga la página.")
    return
  }

  console.log("Elementos del DOM inicializados correctamente")
}

// Función para configurar event listeners
function setupEventListeners() {
  console.log("Configurando event listeners...")

  // Eventos para enviar mensajes
  sendButton.addEventListener("click", handleUserMessage)
  userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleUserMessage()
    }
  })

  // Evento para el botón de voz
  voiceButton.addEventListener("click", toggleSpeechRecognition)

  // Eventos para guardar y ver historial
  saveButton.addEventListener("click", saveCurrentConversation)
  historyButton.addEventListener("click", openHistoryModal)

  // Evento para cambiar tema
  themeButton.addEventListener("click", toggleTheme)

  // Cerrar modal de historial
  document.querySelector(".close-modal").addEventListener("click", closeHistoryModal)
  window.addEventListener("click", (e) => {
    if (e.target === historyModal) {
      closeHistoryModal()
    }
  })

  // Eventos para mejorar la experiencia móvil
  window.addEventListener("resize", adjustMobileHeight)
  adjustMobileHeight()

  if (userInput) {
    userInput.addEventListener("focus", handleInputFocus)
    userInput.addEventListener("blur", handleInputBlur)
  }

  // Mejorar la experiencia táctil
  document.addEventListener("touchstart", () => {}, { passive: true })

  console.log("Event listeners configurados correctamente")
}

// Función para cargar el tema guardado
function loadThemePreference() {
  const savedTheme = localStorage.getItem("chatbotTheme")
  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme")
    isDarkTheme = true
  }
}

// Función para cambiar entre tema claro y oscuro
function toggleTheme() {
  isDarkTheme = !isDarkTheme
  document.body.classList.toggle("dark-theme")
  localStorage.setItem("chatbotTheme", isDarkTheme ? "dark" : "light")
}

// Función para cargar los datos TSV
async function fetchTSVData() {
  try {
    console.log("Cargando datos TSV desde:", TSV_URL)

    const response = await fetch(TSV_URL)
    if (!response.ok) {
      throw new Error(`No se pudo cargar el archivo TSV: ${response.status} ${response.statusText}`)
    }

    const text = await response.text()

    if (!text || text.trim() === "") {
      throw new Error("El archivo TSV está vacío")
    }

    parseTSVData(text)

    // Construir la base de conocimiento desde los datos TSV
    buildKnowledgeBase()

    // Añadir conversaciones casuales
    addCasualConversations()

    // Añadir mensaje de bienvenida
    addBotMessage(
      "¡Hola! Soy el asistente virtual del TESSFP. Estoy aquí para ayudarte con información sobre el Tecnológico de Estudios Superiores de San Felipe del Progreso. ¿En qué puedo ayudarte hoy?",
    )

    // Mostrar sugerencias iniciales
    extractCommonQuestions()
    updateSuggestions()

    console.log("Datos TSV cargados y procesados correctamente")
  } catch (error) {
    console.error("Error al cargar los datos:", error)
    addBotMessage(`Lo siento, no pude cargar la información. Por favor, intenta de nuevo más tarde.`)
  }
}

// Función para analizar los datos TSV
function parseTSVData(tsvText) {
  try {
    const lines = tsvText.trim().split("\n")

    if (lines.length === 0) {
      throw new Error("No se encontraron líneas en el archivo TSV")
    }

    // Extraer encabezados (primera fila - nombres de temas/categorías)
    headers = lines[0].split("\t")

    if (headers.length === 0) {
      throw new Error("No se encontraron encabezados en el archivo TSV")
    }

    // Limpiar datos anteriores
    tsvData = []

    // Extraer datos (filas 2, 3 y 4)
    for (let i = 1; i < lines.length && i < 4; i++) {
      const values = lines[i].split("\t")
      const row = {}

      for (let j = 0; j < headers.length && j < values.length; j++) {
        row[headers[j]] = values[j] || ""
      }

      tsvData.push(row)
    }

    console.log("Datos cargados:", {
      headers: headers,
      rowCount: tsvData.length,
      sampleRow: tsvData.length > 0 ? tsvData[0] : null,
    })
  } catch (error) {
    console.error("Error al analizar los datos TSV:", error)
    addBotMessage(`Error al procesar la información: ${error.message}`)
  }
}

// Función para construir la base de conocimiento desde los datos TSV
function buildKnowledgeBase() {
  // Reiniciar la base de conocimiento
  knowledgeBase = {}

  // Procesar cada columna como un tema/intención
  for (let colIndex = 0; colIndex < headers.length; colIndex++) {
    const topic = headers[colIndex]

    // Ignorar columnas vacías
    if (!topic || topic.trim() === "") continue

    // Obtener palabras clave, contenido y enlace
    const keywords = tsvData.length > 0 ? tsvData[0][topic] || "" : "" // Fila 2: Palabras clave
    const content = tsvData.length > 1 ? tsvData[1][topic] || "" : "" // Fila 3: Contenido
    const link = tsvData.length > 2 ? tsvData[2][topic] || "" : "" // Fila 4: Enlace

    // Ignorar temas sin contenido
    if (!content || content.trim() === "") continue

    // Crear patrones de búsqueda basados en las palabras clave o el nombre del tema
    const patterns =
      keywords && keywords.trim() !== "" ? keywords.split(",").map((p) => p.trim()) : generatePatternsFromTopic(topic)

    // Formatear la respuesta combinando contenido y enlace
    const response = formatResponse(content, link)

    // Añadir a la base de conocimiento
    knowledgeBase[topic] = {
      patterns: patterns,
      responses: [response],
    }
  }

  // Modificar las respuestas por defecto para dar información más útil
  knowledgeBase.fallback = {
    patterns: [],
    responses: [
      `No tengo información específica sobre esa consulta. ¿Podrías reformular tu pregunta? Estoy aquí para ayudarte con todo lo relacionado al TESSFP.`,
      `No encuentro información exacta sobre eso. Prueba preguntando de otra manera o sobre algún tema específico del TESSFP.`,
      `Esa información no está en mi base de datos actual. ¿Hay algún otro tema relacionado con el TESSFP que te interese?`,
      `No puedo responder a eso con exactitud. ¿Hay alguna otra pregunta sobre el TESSFP que pueda ayudarte a resolver?`,
    ],
  }

  console.log("Base de conocimiento construida:", Object.keys(knowledgeBase))
}

// Función para añadir conversaciones casuales
function addCasualConversations() {
  // Saludos
  knowledgeBase.saludos = {
    patterns: [
      "hola",
      "buenos dias",
      "buenas tardes",
      "buenas noches",
      "saludos",
      "que tal",
      "que onda",
      "que hay",
      "ola",
      "alo",
      "hello",
      "hi",
      "hey",
      "ktal",
      "qtal",
      "qonda",
      "qhay",
      "qpasa",
      "que pasa",
    ],
    responses: [
      "¡Hola! ¿En qué puedo ayudarte hoy sobre el TESSFP?",
      "¡Hola! Estoy aquí para resolver tus dudas sobre el Tecnológico. ¿Qué necesitas saber?",
      "¡Buen día! ¿En qué puedo asistirte respecto al TESSFP?",
      "¡Hola! Soy el asistente virtual del TESSFP. ¿Cómo puedo ayudarte?",
      "¡Saludos! Estoy aquí para brindarte información sobre el Tecnológico. ¿Qué te gustaría saber?",
    ],
  }

  // Estado
  knowledgeBase.estado = {
    patterns: [
      "como estas",
      "como te encuentras",
      "como te va",
      "como te sientes",
      "que tal tu dia",
      "como andas",
      "todo bien",
      "estas bien",
      "kmo stas",
      "komo estas",
      "como stas",
    ],
    responses: [
      "¡Estoy muy bien, gracias por preguntar! Listo para ayudarte con información sobre el TESSFP. ¿Qué necesitas saber?",
      "¡Excelente! Siempre disponible para resolver tus dudas sobre el Tecnológico. ¿En qué puedo ayudarte?",
      "Todo perfecto. Estoy aquí para brindarte la información que necesites sobre el TESSFP. ¿Qué te gustaría saber?",
      "Muy bien, gracias. ¿Y tú? ¿En qué puedo ayudarte hoy respecto al Tecnológico?",
      "¡De maravilla! Listo para asistirte con cualquier duda sobre el TESSFP. ¿Qué necesitas?",
    ],
  }

  // Agradecimientos
  knowledgeBase.agradecimientos = {
    patterns: [
      "gracias",
      "te lo agradezco",
      "muchas gracias",
      "mil gracias",
      "thx",
      "thanks",
      "thank you",
      "grax",
      "grasias",
      "gras",
      "grcs",
    ],
    responses: [
      "¡De nada! Estoy aquí para ayudarte. ¿Hay algo más que quieras saber sobre el TESSFP?",
      "¡Es un placer! Si tienes más preguntas sobre el Tecnológico, no dudes en consultarme.",
      "No hay de qué. ¿Necesitas información adicional sobre el TESSFP?",
      "Para eso estoy. ¿Puedo ayudarte con algo más relacionado con el Tecnológico?",
      "¡Encantado de ayudar! Si surge otra duda sobre el TESSFP, aquí estaré.",
    ],
  }

  // Despedidas
  knowledgeBase.despedidas = {
    patterns: [
      "adios",
      "hasta luego",
      "nos vemos",
      "bye",
      "chao",
      "hasta pronto",
      "me voy",
      "hasta mañana",
      "cuidate",
      "me despido",
      "bye bye",
      "adeu",
      "asta luego",
      "asta pronto",
    ],
    responses: [
      "¡Hasta luego! Si tienes más preguntas sobre el TESSFP en el futuro, no dudes en volver.",
      "¡Adiós! Fue un placer ayudarte. Estoy aquí para cuando necesites más información sobre el Tecnológico.",
      "¡Que tengas un excelente día! Regresa cuando necesites más información sobre el TESSFP.",
      "¡Hasta pronto! Recuerda que puedes consultarme cualquier duda sobre el Tecnológico cuando lo necesites.",
      "¡Cuídate! Estaré aquí para resolver tus dudas sobre el TESSFP cuando vuelvas.",
    ],
  }

  // Preguntas sobre el bot
  knowledgeBase.sobre_bot = {
    patterns: [
      "quien eres",
      "que eres",
      "como te llamas",
      "eres un bot",
      "eres humano",
      "eres una persona",
      "con quien hablo",
      "kien eres",
      "ke eres",
      "q eres",
      "qien eres",
    ],
    responses: [
      "Soy el asistente virtual del TESSFP, diseñado para brindarte información sobre el Tecnológico de Estudios Superiores de San Felipe del Progreso. ¿En qué puedo ayudarte?",
      "Soy un chatbot creado para asistirte con información sobre el TESSFP. Estoy aquí para resolver tus dudas sobre el Tecnológico.",
      "Me llamo Asistente TESSFP, y mi función es proporcionarte información sobre el Tecnológico de Estudios Superiores de San Felipe del Progreso. ¿Qué necesitas saber?",
      "Soy un asistente virtual especializado en información sobre el TESSFP. Puedo ayudarte con dudas sobre carreras, trámites, servicios y más.",
      "Soy el chatbot oficial del TESSFP, programado para brindarte información precisa sobre el Tecnológico. ¿Cómo puedo ayudarte hoy?",
    ],
  }

  // Bromas y diversión
  knowledgeBase.bromas = {
    patterns: [
      "cuentame un chiste",
      "dime un chiste",
      "algo gracioso",
      "hazme reir",
      "un chiste",
      "eres divertido",
      "eres aburrido",
      "aburres",
      "qentame un chiste",
      "asme reir",
    ],
    responses: [
      "¿Qué le dice un archivo a un estudiante? ¡Sin mí no puedes graduarte! 😄 Hablando de graduación, ¿necesitas información sobre titulación en el TESSFP?",
      "¿Sabes por qué los libros de matemáticas son tan tristes? Porque tienen muchos problemas. 😄 ¿En qué puedo ayudarte con información sobre el TESSFP?",
      "¿Qué hace un estudiante de informática en el jardín? Intenta conectarse al WiFi. 😄 Por cierto, ¿necesitas información sobre las carreras de tecnología en el TESSFP?",
      "Un profesor le pregunta a un alumno: '¿Qué es la nada?' Y el alumno responde: '¡Lo que estoy pensando ahora mismo!' 😄 ¿Puedo ayudarte con alguna información sobre el TESSFP?",
      "¿Por qué los estudiantes de ingeniería no pueden distinguir entre Halloween y Navidad? Porque Oct 31 = Dec 25. 😄 ¿Necesitas información sobre las ingenierías del TESSFP?",
    ],
  }
}

// Función para generar patrones de búsqueda a partir del nombre del tema
function generatePatternsFromTopic(topic) {
  // Convertir el nombre del tema en patrones de búsqueda
  const patterns = []

  // Añadir el tema original
  patterns.push(topic)

  // Añadir variaciones comunes
  const normalizedTopic = normalizeText(topic)

  // Mapeo de temas a palabras clave adicionales
  const topicKeywords = {
    informacion_general: ["informacion", "general", "acerca", "sobre", "tessfp"],
    titulacion: [
      "titulacion",
      "titularme",
      "titulo",
      "opciones de titulacion",
      "como titularme",
      "formas de titulacion",
    ],
    carreras: ["carreras", "licenciaturas", "ingenierias", "oferta educativa", "que puedo estudiar"],
    servicios_escolares: ["servicios", "tramites", "constancia", "certificado", "inscripcion"],
    becas: ["becas", "apoyo economico", "financiamiento"],
    calendario: ["calendario", "fechas", "vacaciones", "periodo"],
    contacto: ["contacto", "telefono", "correo", "direccion", "ubicacion"],
  }

  // Añadir palabras clave específicas si existen para este tema
  for (const [key, keywords] of Object.entries(topicKeywords)) {
    if (normalizedTopic.includes(key) || key.includes(normalizedTopic)) {
      patterns.push(...keywords)
      break
    }
  }

  // Si no se encontraron palabras clave específicas, añadir algunas genéricas
  if (patterns.length <= 1) {
    patterns.push(`informacion sobre ${topic}`, `que es ${topic}`, `${topic} tessfp`)
  }

  return patterns
}

// Función para formatear la respuesta combinando contenido y enlace
function formatResponse(content, link) {
  // Formatear el contenido con HTML
  let formattedContent = formatHTMLContent(content)

  // Incluir la información completa en lugar de solo agregar links
  if (link && link.trim() !== "" && link.includes("http")) {
    // Verificar si el enlace ya está incluido en el contenido
    if (!formattedContent.includes(link)) {
      // En lugar de solo proporcionar el enlace, mencionar que hay más información disponible
      formattedContent += `<br><br>Para más información, puedes visitar <a href="${link}" target="_blank">la página oficial del TESSFP</a>.`
    }
  }

  return formattedContent
}

// Función para formatear contenido HTML desde el texto del Excel
function formatHTMLContent(text) {
  if (!text) return ""

  // Reemplazar saltos de línea con <br>
  let formatted = text.replace(/\n/g, "<br>")

  // Detectar y formatear listas con viñetas
  formatted = formatted.replace(/✅\s*(.*?)(?=<br>|$)/g, "<br>✅ $1")
  formatted = formatted.replace(/•\s*(.*?)(?=<br>|$)/g, "<br>• $1")
  formatted = formatted.replace(/\d+\.\s*(.*?)(?=<br>|$)/g, "<br>$&")

  // Detectar y formatear títulos (solo si terminan con dos puntos)
  formatted = formatted.replace(/([^:<>\n]+):\s/g, "<strong>$1:</strong> ")

  // Detectar y formatear SOLO URLs (no todo el texto)
  formatted = formatted.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>')

  // Añadir iconos para mejorar la presentación
  formatted = formatted.replace(/📍/g, '<span class="icon location">📍</span>')
  formatted = formatted.replace(/📞/g, '<span class="icon phone">📞</span>')
  formatted = formatted.replace(/📧/g, '<span class="icon email">📧</span>')
  formatted = formatted.replace(/🌐/g, '<span class="icon website">🌐</span>')

  return formatted
}

// Función para extraer preguntas comunes para sugerencias
function extractCommonQuestions() {
  // Crear preguntas basadas en los temas disponibles y el historial de conversación
  commonQuestions = []

  // Mapeo de temas a preguntas
  const topicToQuestion = {
    titulacion: "¿Cuáles son las opciones de titulación?",
    carreras: "¿Qué carreras ofrece el TESSFP?",
    servicios: "¿Qué servicios escolares ofrece el TESSFP?",
    becas: "¿Qué becas están disponibles?",
    contacto: "¿Cómo puedo contactar al TESSFP?",
    informacion: "¿Qué es el TESSFP?",
    calendario: "¿Cuál es el calendario escolar?",
    tramites: "¿Cómo realizo un trámite escolar?",
    inscripcion: "¿Cómo me inscribo al TESSFP?",
    horarios: "¿Dónde consulto mi horario?",
  }

  // Si hay historial de conversación, generar preguntas relacionadas
  if (conversationHistory.length > 0) {
    const lastUserMessage = conversationHistory.filter((msg) => msg.role === "user").pop()
    if (lastUserMessage) {
      const lastQuery = lastUserMessage.content.toLowerCase()

      // Generar preguntas relacionadas con la última consulta
      if (lastQuery.includes("titulacion") || lastQuery.includes("titularme") || lastQuery.includes("titulo")) {
        commonQuestions.push(
          "¿Cuáles son los requisitos para titularme?",
          "¿Cuánto tiempo toma el proceso de titulación?",
          "¿Qué documentos necesito para titularme?",
        )
      } else if (lastQuery.includes("carrera") || lastQuery.includes("estudiar") || lastQuery.includes("ingenieria")) {
        commonQuestions.push(
          "¿Cuál es el plan de estudios de Ingeniería Informática?",
          "¿Qué campo laboral tienen los egresados?",
          "¿Cuánto duran las carreras?",
        )
      } else if (lastQuery.includes("servicio") || lastQuery.includes("tramite") || lastQuery.includes("constancia")) {
        commonQuestions.push(
          "¿Cómo solicito una constancia de estudios?",
          "¿Cuál es el proceso de reinscripción?",
          "¿Cómo tramito mi credencial?",
        )
      } else if (lastQuery.includes("beca") || lastQuery.includes("apoyo") || lastQuery.includes("financiamiento")) {
        commonQuestions.push(
          "¿Cuáles son los requisitos para solicitar una beca?",
          "¿Cuándo se abren las convocatorias de becas?",
          "¿Qué tipos de becas hay disponibles?",
        )
      } else if (lastQuery.includes("contacto") || lastQuery.includes("ubicacion") || lastQuery.includes("direccion")) {
        commonQuestions.push(
          "¿Dónde se encuentra el TESSFP?",
          "¿Cuál es el teléfono del TESSFP?",
          "¿Cuál es el correo electrónico de contacto?",
        )
      } else if (isGreeting(lastQuery) || isCasualConversation(lastQuery)) {
        // Si el usuario saludó o está en conversación casual, mostrar preguntas generales
        commonQuestions.push(
          "¿Qué carreras ofrece el TESSFP?",
          "¿Cómo me inscribo al TESSFP?",
          "¿Dónde se encuentra el TESSFP?",
          "¿Cuáles son las opciones de titulación?",
          "¿Qué becas están disponibles?",
        )
      }
    }
  }

  // Si no hay suficientes preguntas basadas en el historial, añadir preguntas de temas
  if (commonQuestions.length < 5) {
    // Añadir preguntas basadas en los temas disponibles
    for (const topic in knowledgeBase) {
      if (
        topic === "fallback" ||
        topic === "saludos" ||
        topic === "estado" ||
        topic === "agradecimientos" ||
        topic === "despedidas" ||
        topic === "sobre_bot" ||
        topic === "comida_personal" ||
        topic === "bromas"
      )
        continue

      // Buscar si hay una pregunta predefinida para este tema
      for (const [key, question] of Object.entries(topicToQuestion)) {
        if (topic.toLowerCase().includes(key) && !commonQuestions.includes(question)) {
          commonQuestions.push(question)
          break
        }
      }

      // Limitar a 5 preguntas
      if (commonQuestions.length >= 5) break
    }
  }

  // Si aún no hay suficientes preguntas, añadir algunas genéricas
  if (commonQuestions.length < 5) {
    const genericQuestions = [
      "¿Cómo me inscribo al TESSFP?",
      "¿Cuándo inician las clases?",
      "¿Cómo solicito una constancia?",
      "¿Qué hago para cambiar de carrera?",
      "¿Dónde encuentro mi horario?",
    ]

    for (const question of genericQuestions) {
      if (!commonQuestions.includes(question)) {
        commonQuestions.push(question)
        if (commonQuestions.length >= 5) break
      }
    }
  }

  console.log("Preguntas comunes extraídas:", commonQuestions)
}

// Función para verificar si un mensaje es una conversación casual
function isCasualConversation(message) {
  const casualPatterns = [
    "como estas",
    "que haces",
    "que tal",
    "ya comiste",
    "donde estas",
    "gracias",
    "adios",
    "hasta luego",
    "quien eres",
    "que eres",
  ]
  const normalizedMessage = normalizeText(message)

  return casualPatterns.some((pattern) => normalizedMessage.includes(normalizeText(pattern)))
}

// Umbral mínimo de similitud (cambiado de 0.6 a 0.75)
const similarityThreshold = 0.85

// Función para detectar la intención del usuario with tolerancia a errores
function detectIntent(query) {
  const normalizedQuery = normalizeText(query)

  // Primero verificar si es una conversación casual
  for (const intent of [
    "saludos",
    "estado",
    "agradecimientos",
    "despedidas",
    "sobre_bot",
    "comida_personal",
    "bromas",
  ]) {
    if (knowledgeBase[intent]) {
      for (const pattern of knowledgeBase[intent].patterns) {
        if (
          normalizedQuery.includes(normalizeText(pattern)) ||
          calculateSimilarity(normalizedQuery, normalizeText(pattern)) > 0.7
        ) {
          return intent
        }
      }
    }
  }

  // Verificar si la consulta es demasiado general (una sola palabra)
  const queryWords = normalizedQuery
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2)
  const isGeneralQuery = queryWords.length === 1

  // Si es una consulta general, verificar si coincide con algún tema principal
  if (isGeneralQuery) {
    const generalWord = queryWords[0]
    const matchingTopics = []

    // Buscar temas que coincidan con la palabra general
    for (const [intent, data] of Object.entries(knowledgeBase)) {
      if (
        intent === "fallback" ||
        intent === "saludos" ||
        intent === "estado" ||
        intent === "agradecimientos" ||
        intent === "despedidas" ||
        intent === "sobre_bot" ||
        intent === "comida_personal" ||
        intent === "bromas"
      )
        continue

      if (
        data.patterns &&
        data.patterns.some(
          (pattern) => normalizeText(pattern).includes(generalWord) || generalWord.includes(normalizeText(pattern)),
        )
      ) {
        matchingTopics.push(intent)
      }
    }

    // Si encontramos temas coincidentes, devolver un intent especial
    if (matchingTopics.length > 0) {
      // Guardar los temas coincidentes para usarlos después
      window.lastMatchingTopics = matchingTopics
      return "need_clarification"
    }
  }

  // Buscar coincidencias exactas en la base de conocimiento
  // Requerir al menos dos palabras clave coincidentes para una coincidencia exacta
  for (const [intent, data] of Object.entries(knowledgeBase)) {
    if (
      intent === "fallback" ||
      intent === "saludos" ||
      intent === "estado" ||
      intent === "agradecimientos" ||
      intent === "despedidas" ||
      intent === "sobre_bot" ||
      intent === "comida_personal" ||
      intent === "bromas"
    )
      continue

    if (data.patterns) {
      let matchCount = 0
      const matchedPatterns = []

      for (const pattern of data.patterns) {
        const normalizedPattern = normalizeText(pattern)

        // Verificar si el patrón está incluido en la consulta
        if (normalizedQuery.includes(normalizedPattern)) {
          matchCount++
          matchedPatterns.push(pattern)
        }

        // También verificar similitud alta
        const similarity = calculateSimilarity(normalizedQuery, normalizedPattern)
        if (similarity > 0.9) {
          // Umbral más alto para coincidencias de similitud
          matchCount++
          matchedPatterns.push(pattern)
        }
      }

      // Si hay al menos dos coincidencias o una coincidencia con una similitud muy alta
      if (matchCount >= 2 || (matchCount === 1 && matchedPatterns.some((p) => p.length > 8))) {
        return intent
      }
    }
  }

  // Si no hay coincidencias exactas, buscar coincidencias parciales con tolerancia a errores
  let bestMatch = null
  let bestScore = similarityThreshold

  for (const [intent, data] of Object.entries(knowledgeBase)) {
    if (intent === "fallback") continue

    if (data.patterns) {
      for (const pattern of data.patterns) {
        const normalizedPattern = normalizeText(pattern)

        // Calcular similitud entre palabras individuales
        const queryWords = normalizedQuery.split(" ")
        const patternWords = normalizedPattern.split(" ")

        let wordMatchCount = 0

        for (const queryWord of queryWords) {
          if (queryWord.length < 3) continue // Ignorar palabras muy cortas

          for (const patternWord of patternWords) {
            if (patternWord.length < 3) continue // Ignorar palabras muy cortas

            const similarity = calculateSimilarity(queryWord, patternWord)
            if (similarity > 0.9) {
              // Umbral más alto para coincidencias de palabras
              wordMatchCount++
            }

            if (similarity > bestScore) {
              bestScore = similarity
              bestMatch = intent
            }
          }
        }

        // Si hay al menos dos palabras con alta similitud
        if (wordMatchCount >= 2) {
          return intent
        }

        // También calcular similitud entre frases completas
        const phraseSimilarity = calculateSimilarity(normalizedQuery, normalizedPattern)
        if (phraseSimilarity > bestScore) {
          bestScore = phraseSimilarity
          bestMatch = intent
        }
      }
    }
  }

  // Si se encontró una coincidencia con suficiente similitud, usarla
  if (bestMatch) {
    return bestMatch
  }

  // Si no se encontró ninguna coincidencia, buscar en los encabezados
  for (const header of headers) {
    const normalizedHeader = normalizeText(header)
    const similarity = calculateSimilarity(normalizedQuery, normalizedHeader)

    if (similarity > bestScore) {
      bestScore = similarity
      bestMatch = header
    }
  }

  return bestMatch || "fallback"
}

// Añadir respuestas para solicitar clarificación
knowledgeBase.need_clarification = {
  patterns: [],
  responses: [
    "Parece que estás preguntando sobre {topic}. ¿Podrías ser más específico sobre qué te gustaría saber?",
    "Tengo información sobre {topic}. ¿Qué aspecto específico te interesa conocer?",
    "Para brindarte la mejor información sobre {topic}, ¿podrías detallar más tu pregunta?",
    "Puedo ayudarte con información sobre {topic}. ¿Qué te gustaría saber exactamente?",
  ],
}

// Función para procesar la consulta del usuario
async function processUserQuery(query) {
  try {
    console.log("Procesando consulta:", query)
    
    // Guardar en historial
    conversationHistory.push({ role: "user", content: query })
    
    // Verificar si es una respuesta afirmativa
    if (isAffirmativeResponse(query)) {
      const previousContext = getPreviousContext()
      if (previousContext) {
        // Extraer información sobre TESSFP del contexto previo
        if (previousContext.includes("TESSFP")) {
          const topics = Object.keys(knowledgeBase).filter(topic => 
            previousContext.toLowerCase().includes(topic.toLowerCase()) &&
            !["fallback", "saludos", "estado", "agradecimientos", "despedidas", "sobre_bot", "comida_personal", "bromas"].includes(topic)
          )
          
          if (topics.length > 0) {
            const topic = topics[0]
            const response = getRandomResponse(knowledgeBase[topic].responses)
            conversationHistory.push({ role: "assistant", content: response })
            removeLoadingIndicator()
            addBotMessage(response)
            return
          }
        }
      }
    }

    // PASO 1: Verificar si la consulta está relacionada con el TESSFP
    const isTessfpRelated = isRelatedToTessfp(query)
    console.log("¿Relacionado con TESSFP?:", isTessfpRelated)

    if (isTessfpRelated) {
      // Si está relacionado con TESSFP, usar la base de conocimiento del TSV
      console.log("Usando base de conocimiento del TESSFP")
      const intent = detectIntent(query)

      // Manejar solicitudes de clarificación
      if (intent === "need_clarification" && window.lastMatchingTopics && window.lastMatchingTopics.length > 0) {
        const topics = window.lastMatchingTopics
        let topicNames = topics.map((t) => formatTopicName(t)).join(", ")

        // Si hay muchos temas, limitar a los primeros 3
        if (topics.length > 3) {
          topicNames =
            topics
              .slice(0, 3)
              .map((t) => formatTopicName(t))
              .join(", ") + " y otros temas"
        }

        // Obtener una respuesta de clarificación y reemplazar el marcador de posición
        let response = getRandomResponse(knowledgeBase.need_clarification.responses)
        response = response.replace("{topic}", topicNames)

        // Guardar en historial y mostrar respuesta
        conversationHistory.push({ role: "assistant", content: response.replace(/<[^>]*>/g, "") })
        removeLoadingIndicator()
        addBotMessage(response)

        // Mostrar opciones de temas para facilitar la selección
        setTimeout(() => {
          showTopicOptions(topics)
        }, 500)
      } else {
        // Procesar normalmente si no necesita clarificación
        const responseData = knowledgeBase[intent] || knowledgeBase.fallback
        const response = getRandomResponse(responseData.responses)

        // Guardar en historial y mostrar respuesta
        conversationHistory.push({ role: "assistant", content: response.replace(/<[^>]*>/g, "") })
        removeLoadingIndicator()
        addBotMessage(response)
      }
    } else {
      // PASO 2: Si no está relacionado con TESSFP, intentar con Grok
      console.log("Intentando responder con Grok")
      try {
        const grokResponse = await fetchGrokResponse(query)
        if (grokResponse) {
          // Si Grok responde correctamente
          console.log("Respuesta de Grok obtenida")
          conversationHistory.push({ role: "assistant", content: grokResponse })
          removeLoadingIndicator()
          addBotMessage(grokResponse)
          return
        }
      } catch (grokError) {
        console.error("Error al obtener respuesta de Grok:", grokError)
      }

      // PASO 3: Si Grok falla, verificar si es una conversación casual
      console.log("Verificando si es conversación casual")
      const casualIntent = detectCasualIntent(query)
      if (casualIntent) {
        // Si es una conversación casual, usar respuesta precargada
        console.log("Usando respuesta casual precargada")
        const casualResponse = getRandomResponse(knowledgeBase[casualIntent].responses)
        conversationHistory.push({ role: "assistant", content: casualResponse.replace(/<[^>]*>/g, "") })
        removeLoadingIndicator()
        addBotMessage(casualResponse)
        return
      }

      // PASO 4: Intentar nuevamente con Grok como último recurso
      console.log("Intentando nuevamente con Grok como último recurso")
      try {
        const lastResortGrokResponse = await fetchGrokResponse(query)
        if (lastResortGrokResponse) {
          conversationHistory.push({ role: "assistant", content: lastResortGrokResponse })
          removeLoadingIndicator()
          addBotMessage(lastResortGrokResponse)
          return
        }
      } catch (finalGrokError) {
        console.error("Error final al obtener respuesta de Grok:", finalGrokError)
      }

      // PASO 5: Si todo falla, mostrar mensaje por defecto
      console.log("Mostrando mensaje por defecto")
      const defaultMessage = "Estoy diseñado para responder preguntas sobre el TESSFP."
      conversationHistory.push({ role: "assistant", content: defaultMessage })
      removeLoadingIndicator()
      addBotMessage(defaultMessage)
    }

    // Actualizar sugerencias basadas en la nueva conversación
    extractCommonQuestions()
    updateSuggestions()
  } catch (error) {
    console.error("Error al procesar la consulta:", error)
    removeLoadingIndicator()
    addBotMessage(
      "Lo siento, ocurrió un error al procesar tu consulta. Por favor, intenta con otra pregunta o elige alguna de las sugerencias.",
    )
  }
}

// Función para verificar si una consulta está relacionada con el TESSFP
function isRelatedToTessfp(query) {
  // Lista de palabras clave relacionadas con el TESSFP
  const tessfpKeywords = [
    "tessfp",
    "tecnologico",
    "san felipe",
    "progreso",
    "carrera",
    "inscripcion",
    "beca",
    "titulacion",
    "servicio",
    "tramite",
    "escolar",
    "estudiante",
    "profesor",
    "campus",
    "horario",
    "clase",
    "examen",
    "semestre",
    "ingenieria",
    "licenciatura",
  ]

  const normalizedQuery = normalizeText(query)

  // Si la consulta contiene alguna palabra clave relacionada con el TESSFP
  return tessfpKeywords.some((keyword) => normalizedQuery.includes(normalizeText(keyword)))
}

// Función para detectar si es una conversación casual
function detectCasualIntent(query) {
  const normalizedQuery = normalizeText(query)

  // Lista de intenciones casuales
  const casualIntents = ["saludos", "estado", "agradecimientos", "despedidas", "sobre_bot", "bromas"]

  // Verificar si coincide con alguna intención casual
  for (const intent of casualIntents) {
    if (knowledgeBase[intent]) {
      for (const pattern of knowledgeBase[intent].patterns) {
        if (
          normalizedQuery.includes(normalizeText(pattern)) ||
          calculateSimilarity(normalizedQuery, normalizeText(pattern)) > 0.7
        ) {
          return intent
        }
      }
    }
  }

  return null
}

// Función para obtener respuesta de Grok
async function fetchGrokResponse(query) {
  try {
    console.log("Solicitando respuesta a Grok para:", query)

    // Preparar el historial de conversación (últimos 5 mensajes para mantener contexto)
    const relevantHistory = conversationHistory.slice(-5);
    
    // Realizar la solicitud a nuestra API interna
    const response = await fetch("http://localhost:3000/api/grok", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        conversationHistory: relevantHistory,
        system: "Eres un asistente virtual amigable y conversacional para el Tecnológico de Estudios Superiores de San Felipe del Progreso (TESSFP). Responde de manera natural y en español. Si alguien responde afirmativamente a una pregunta tuya anterior, proporciona la información prometida. NO saludes nuevamente si ya estás en una conversación."
      })
    })

    // Verificar si la respuesta es exitosa
    if (!response.ok) {
      console.error("Error en la respuesta de Grok:", response.status, response.statusText)
      throw new Error(`Error en la API: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    if (!data || !data.response) {
      console.error("Respuesta de Grok inválida:", data)
      throw new Error("Respuesta inválida del servidor")
    }

    console.log(
      "Respuesta procesada de Grok:",
      data.response ? data.response.substring(0, 50) + "..." : "No hay respuesta"
    )

    return data.response
  } catch (error) {
    console.error("Error al obtener respuesta de Grok:", error)
    return null
  }
}

function showTopicOptions(topics) {
  // Si ya se mostró un mensaje de clarificación, no añadir otro mensaje
  // Solo añadir los botones de opciones

  let message = '<div class="topic-options">'
  topics.forEach((topic) => {
    // Formatear el nombre del tema para mostrarlo más amigable
    const displayName = formatTopicName(topic)
    message += `<button class="topic-option-btn" data-topic="${topic}">${displayName}</button>`
  })
  message += "</div>"

  addBotMessage(message)

  // Agregar event listeners a los botones después de que se hayan añadido al DOM
  setTimeout(() => {
    const buttons = document.querySelectorAll(".topic-option-btn")
    buttons.forEach((button) => {
      button.addEventListener("click", function () {
        const selectedTopic = this.getAttribute("data-topic")
        const responseData = knowledgeBase[selectedTopic]

        if (responseData) {
          // Mostrar la respuesta del tema seleccionado
          const response = getRandomResponse(responseData.responses)
          addBotMessage(response)

          // Actualizar sugerencias
          extractCommonQuestions()
          updateSuggestions()

          // Guardar en historial
          conversationHistory.push({ role: "assistant", content: response.replace(/<[^>]*>/g, "") })
        }
      })
    })
  }, 100)
}

// Función para formatear el nombre del tema para mostrarlo más amigable
function formatTopicName(topic) {
  // Reemplazar guiones bajos por espacios y capitalizar cada palabra
  return topic
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

// Modificar la función updateSuggestions para implementar la navegación
function updateSuggestions() {
  // Verificar si ya existe un contenedor de sugerencias
  const suggestionsContainer = document.getElementById("suggestions-container")

  if (suggestionsContainer) {
    // Limpiar sugerencias anteriores
    suggestionsContainer.innerHTML = ""
  } else {
    return // Si no existe el contenedor, no hacer nada
  }

  // Usar las preguntas comunes extraídas o preguntas por defecto
  const suggestions =
    commonQuestions.length > 0
      ? commonQuestions
      : [
          "¿Cuáles son las opciones de titulación?",
          "¿Qué carreras ofrece el TESSFP?",
          "¿Cómo solicito una constancia?",
          "¿Qué hago para cambiar de carrera?",
          "¿Cuándo inician las inscripciones?",
        ]

  // Crear wrapper y scroll container
  const suggestionsWrapper = document.createElement("div")
  suggestionsWrapper.className = "suggestions-wrapper"

  const suggestionsScroll = document.createElement("div")
  suggestionsScroll.className = "suggestions-scroll"
  suggestionsScroll.id = "suggestions-scroll"

  // Crear botones de sugerencia
  suggestions.forEach((suggestion) => {
    const button = document.createElement("button")
    button.className = "suggestion-button"
    button.textContent = suggestion

    // Usar click en lugar de touchstart para evitar activaciones accidentales
    button.addEventListener("click", () => {
      userInput.value = suggestion
      handleUserMessage()
    })

    suggestionsScroll.appendChild(button)
  })

  suggestionsWrapper.appendChild(suggestionsScroll)
  suggestionsContainer.appendChild(suggestionsWrapper)

  // Crear navegación
  const suggestionsNav = document.createElement("div")
  suggestionsNav.className = "suggestions-nav"

  // Botón de navegación izquierda
  const navLeft = document.createElement("div")
  navLeft.className = "nav-arrow nav-left"
  navLeft.innerHTML = '<div class="nav-arrow-icon"></div>'
  navLeft.addEventListener("click", () => {
    navigateSuggestions("left")
  })

  // Botón de navegación derecha
  const navRight = document.createElement("div")
  navRight.className = "nav-arrow nav-right"
  navRight.innerHTML = '<div class="nav-arrow-icon"></div>'
  navRight.addEventListener("click", () => {
    navigateSuggestions("right")
  })

  // Contenedor para los puntos de navegación
  const dotsContainer = document.createElement("div")
  dotsContainer.className = "nav-dots"
  dotsContainer.style.display = "flex"
  dotsContainer.style.gap = "5px"

  suggestionsNav.appendChild(navLeft)
  suggestionsNav.appendChild(dotsContainer)
  suggestionsNav.appendChild(navRight)

  suggestionsContainer.appendChild(suggestionsNav)

  // Inicializar los puntos de navegación después de que se hayan renderizado las sugerencias
  setTimeout(() => {
    initializeNavigationDots()

    // Añadir evento de scroll para actualizar los puntos de navegación
    suggestionsScroll.addEventListener("scroll", () => {
      updateNavigationDots()
    })
  }, 100)
}

// Función para inicializar los puntos de navegación
function initializeNavigationDots() {
  const suggestionsScroll = document.getElementById("suggestions-scroll")
  const dotsContainer = document.querySelector(".nav-dots")

  if (!suggestionsScroll || !dotsContainer) return

  // Limpiar puntos existentes
  dotsContainer.innerHTML = ""

  // Calcular cuántos puntos necesitamos basados en el ancho del contenedor y el contenido
  const containerWidth = suggestionsScroll.clientWidth
  const scrollWidth = suggestionsScroll.scrollWidth

  if (scrollWidth <= containerWidth) {
    // No necesitamos navegación si todo cabe en la pantalla
    const navContainer = document.querySelector(".suggestions-nav")
    if (navContainer) {
      navContainer.style.display = "none"
    }
    return
  }

  // Calcular número de páginas (redondeando hacia arriba)
  const numPages = Math.ceil(scrollWidth / containerWidth)

  // Crear puntos de navegación
  for (let i = 0; i < numPages; i++) {
    const dot = document.createElement("div")
    dot.className = "nav-dot"
    if (i === 0) dot.classList.add("active")

    // Añadir evento de clic para navegar a esa página
    dot.addEventListener("click", () => {
      const scrollPosition = (scrollWidth - containerWidth) * (i / (numPages - 1))
      suggestionsScroll.scrollLeft = scrollPosition
    })

    dotsContainer.appendChild(dot)
  }

  // Mostrar la navegación
  const navContainer = document.querySelector(".suggestions-nav")
  if (navContainer) {
    navContainer.style.display = "flex"
  }
}

// Función para actualizar los puntos de navegación basados en la posición actual
function updateNavigationDots() {
  const suggestionsScroll = document.getElementById("suggestions-scroll")
  const dots = document.querySelectorAll(".nav-dot")

  if (!suggestionsScroll || dots.length === 0) return

  const containerWidth = suggestionsScroll.clientWidth
  const scrollWidth = suggestionsScroll.scrollWidth
  const scrollLeft = suggestionsScroll.scrollLeft

  // Calcular la página actual basada en la posición de desplazamiento
  const currentPage = Math.round((scrollLeft / (scrollWidth - containerWidth)) * (dots.length - 1))

  // Actualizar clases de los puntos
  dots.forEach((dot, index) => {
    if (index === currentPage) {
      dot.classList.add("active")
    } else {
      dot.classList.remove("active")
    }
  })
}

// Función para navegar entre sugerencias
function navigateSuggestions(direction) {
  const suggestionsScroll = document.getElementById("suggestions-scroll")
  if (!suggestionsScroll) return

  const containerWidth = suggestionsScroll.clientWidth
  const currentScroll = suggestionsScroll.scrollLeft

  // Calcular la nueva posición de desplazamiento
  let newScroll
  if (direction === "left") {
    newScroll = Math.max(0, currentScroll - containerWidth)
  } else {
    newScroll = Math.min(suggestionsScroll.scrollWidth - containerWidth, currentScroll + containerWidth)
  }

  // Desplazar suavemente
  suggestionsScroll.scrollLeft = newScroll
}

// Función para mostrar indicador de carga
function showLoadingIndicator() {
  const loadingIndicator = document.createElement("div")
  loadingIndicator.classList.add("chat-message", "bot-message", "loading-indicator")
  loadingIndicator.innerHTML = "<div class='spinner'></div>"
  chatMessages.appendChild(loadingIndicator)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

// Función para eliminar indicador de carga
function removeLoadingIndicator() {
  const loadingIndicator = document.querySelector(".loading-indicator")
  if (loadingIndicator) {
    loadingIndicator.remove()
  }
}

// Función para ajustar la altura en dispositivos móviles (evita problemas con el teclado virtual)
function adjustMobileHeight() {
  if (window.innerWidth <= 768) {
    const vh = window.innerHeight * 0.01
    document.documentElement.style.setProperty("--vh", `${vh}px`)
  }
}

// Función para manejar el enfoque del input en dispositivos móviles
function handleInputFocus() {
  if (window.innerWidth <= 768) {
    // Dar tiempo al teclado para aparecer y luego hacer scroll
    setTimeout(() => {
      window.scrollTo(0, document.body.scrollHeight)
      chatMessages.scrollTop = chatMessages.scrollHeight
    }, 300)
  }
}

// Función para manejar el desenfoque del input en dispositivos móviles
function handleInputBlur() {
  if (window.innerWidth <= 768) {
    // Restaurar scroll cuando el teclado se oculta
    setTimeout(() => {
      window.scrollTo(0, 0)
    }, 100)
  }
}

// Función para obtener una respuesta aleatoria de un array
function getRandomResponse(responses) {
  return responses[Math.floor(Math.random() * responses.length)]
}

// Función para detectar respuestas afirmativas
function isAffirmativeResponse(query) {
  const affirmativePatterns = ["si", "sí", "claro", "por supuesto", "ok", "okay", "vale", "efectivamente", "así es", "correcto"]
  const normalizedQuery = normalizeText(query)
  return affirmativePatterns.some((pattern) => normalizedQuery.includes(pattern))
}

// Función para obtener el contexto previo
function getPreviousContext() {
  if (conversationHistory.length >= 2) {
    const lastAssistantMessage = conversationHistory
      .slice()
      .reverse()
      .find((msg) => msg.role === "assistant")
    return lastAssistantMessage ? lastAssistantMessage.content : null
  }
  return null
}
