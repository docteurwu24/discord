// background.js - Service Worker pour l'Assistant IA Discord avec gestion de Personas

let logsWindowId = null;
let logQueue = [];
let logsPageReady = false;

// --- Fonctions de gestion des logs ---
async function openLogsWindow() {
  const targetUrl = chrome.runtime.getURL('logs.html');

  if (logsWindowId !== null) {
    try {
      const win = await chrome.windows.get(logsWindowId);
      if (win) {
        chrome.windows.update(logsWindowId, { focused: true });
        logMessage('Fenêtre de logs existante focalisée.');
        return;
      }
    } catch (e) {
      logsWindowId = null;
    }
  }

  chrome.windows.create({
    url: targetUrl,
    type: 'popup',
    width: 800,
    height: 600
  }, (win) => {
    if (chrome.runtime.lastError) {
      console.error("Erreur création fenêtre logs:", chrome.runtime.lastError.message);
      return;
    }
    logsWindowId = win.id;
    logsPageReady = false;
    logMessage('Fenêtre de logs ouverte.');
  });
}

function logMessage(message, type = 'INFO') {
  const logEntry = `[${new Date().toLocaleTimeString()}] [${type}] ${message}`;
  console.log(logEntry);

  if (logsPageReady && logsWindowId !== null) {
    chrome.runtime.sendMessage({ type: 'LOG_MESSAGE', message: logEntry })
      .catch(error => {
        if (error.message.includes("Receiving end does not exist")) {
          logsPageReady = false;
          logsWindowId = null;
          logQueue.push(logEntry);
        }
      });
  } else {
    logQueue.push(logEntry);
  }
}

// --- Gestion du stockage ---
async function getStorageData(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        logMessage(`Erreur getStorage: ${chrome.runtime.lastError.message}`, 'ERROR');
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

async function setStorageData(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        logMessage(`Erreur setStorage: ${chrome.runtime.lastError.message}`, 'ERROR');
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        if (data.apiKey !== undefined) {
          logMessage(`Clé API sauvegardée: ${data.apiKey ? '***' + data.apiKey.slice(-4) : 'vide'}`);
        }
        resolve();
      }
    });
  });
}

// --- Initialisation ---
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const defaults = {
      personas: {
        'casual_friend': {
          id: 'casual_friend',
          name: '😎 Ami Décontracté',
          prompt: 'Tu es un ami sympa et décontracté. Tu réponds de manière naturelle, avec un ton amical et détendu.',
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        }
      },
      apiKey: '',
      extensionSettings: {
        autoSave: true,
        maxMessages: 15,
        debugMode: false,
        responseLength: 'medium',
        totalGenerations: 0
      }
    };

    const data = await getStorageData(null);
    const updates = {};

    Object.keys(defaults).forEach(key => {
      if (!data[key]) {
        updates[key] = defaults[key];
      }
    });

    if (Object.keys(updates).length > 0) {
      await setStorageData(updates);
      logMessage('Données initialisées', 'SUCCESS');
    }
  } catch (error) {
    logMessage(`Erreur initialisation: ${error.message}`, 'ERROR');
  }
});

// --- Gestion des messages ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logMessage(`Message reçu: ${request.action || request.type}`, 'DEBUG');
  if (request.type === 'LOGS_PAGE_READY') {
    logsPageReady = true;
    while(logQueue.length > 0) {
      const msg = logQueue.shift();
      chrome.runtime.sendMessage({ type: 'LOG_MESSAGE', message: msg }).catch(() => {});
    }
    sendResponse({ success: true });
    return true;
  }

  const actionHandlers = {
    generateResponse: generateAIResponse,
    savePersona: savePersona,
    deletePersona: deletePersona,
    setActivePersona: setActivePersona,
    openLogs: openLogsWindow,
    
    saveSettings: async (data) => {
      if (data.apiKey !== undefined && typeof data.apiKey !== 'string') {
        throw new Error('La clé API doit être une chaîne de caractères');
      }
      await setStorageData(data);
      return { success: true };
    },
    
    getSettings: async (data) => {
      return await getStorageData(data.keys);
    }
  };

  const handler = actionHandlers[request.action];
  if (handler) {
    handler(request.data)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ 
        success: false, 
        error: error.message 
      }));
    return true;
  }
  
  sendResponse({ success: false, error: 'Action inconnue' });
  return false;
});

// --- Fonctions IA ---
async function generateAIResponse({ messages }) {
  logMessage('Début de la génération de réponse IA.', 'DEBUG');
  const { apiKey, personas, activePersonaId } = await getStorageData([
    'apiKey', 'personas', 'activePersonaId'
  ]);

  if (!apiKey) {
    logMessage("Clé API manquante", 'ERROR');
    throw new Error("Clé API manquante");
  }
  if (!activePersonaId || !personas[activePersonaId]) {
    logMessage("Persona actif invalide ou non trouvé", 'ERROR');
    throw new Error("Persona actif invalide");
  }

  const persona = personas[activePersonaId];
  logMessage(`Persona actif: ${persona.name}`, 'DEBUG');

  const prompt = buildPersonaPrompt(messages, persona);
  logMessage(`Prompt envoyé à Gemini:\n${prompt}`, 'DEBUG');

  const response = await callGeminiAPI(apiKey, prompt);
  logMessage(`Réponse brute de Gemini:\n${JSON.stringify(response, null, 2)}`, 'DEBUG');
  
  const suggestions = processGeminiResponse(response);
  logMessage(`Suggestions extraites: ${JSON.stringify(suggestions)}`, 'DEBUG');

  await updateUsageStats(activePersonaId);
  return suggestions;
}

function buildPersonaPrompt(messages, persona) {
  const lastMessage = messages[messages.length - 1];
  const previousMessages = messages.slice(-10, -1).map(m => `${m.author}: ${m.content}`).join('\n');

  let prompt = `Tu es un assistant IA pour Discord.

PERSONA :
${persona.prompt}

`;

  if (previousMessages) {
    prompt += `CONTEXTE DE LA CONVERSATION PRÉCÉDENTE :
${previousMessages}

`;
  }

  prompt += `DERNIER MESSAGE (auquel tu dois répondre) :
${lastMessage.author}: ${lastMessage.content}

Génère 4 suggestions de réponses courtes et variées, en te basant PRINCIPALEMENT sur le DERNIER MESSAGE, mais en tenant compte du CONTEXTE si pertinent.
Format attendu :
SUGG: suggestion 1
SUGG: suggestion 2
SUGG: suggestion 3
SUGG: suggestion 4`;
  
  logMessage(`Prompt construit: ${prompt.substring(0, 200)}...`, 'DEBUG'); // Log partiel pour éviter la surcharge
  return prompt;
}

async function callGeminiAPI(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
  logMessage(`Appel API Gemini à: ${url}`, 'DEBUG');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const errorMessage = error.error?.message || `Erreur API: ${response.status} ${response.statusText}`;
    logMessage(`Erreur réponse API Gemini: ${errorMessage}`, 'ERROR');
    throw new Error(errorMessage);
  }

  const data = await response.json();
  logMessage(`Réponse API Gemini reçue (partiel): ${JSON.stringify(data).substring(0, 200)}...`, 'DEBUG');
  return data;
}

function processGeminiResponse(data) {
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    logMessage('Réponse API invalide: Pas de texte candidat trouvé.', 'ERROR');
    throw new Error('Réponse API invalide');
  }

  const rawText = data.candidates[0].content.parts[0].text;
  logMessage(`Texte brut de la réponse Gemini:\n${rawText}`, 'DEBUG');

  const suggestions = rawText
    .split('\n')
    .filter(line => line.startsWith('SUGG:'))
    .map(line => line.replace('SUGG:', '').trim())
    .slice(0, 4);
  
  if (suggestions.length === 0) {
    logMessage('Aucune suggestion trouvée avec le préfixe "SUGG:".', 'WARN');
  }
  return suggestions;
}

// --- Gestion des Personas ---
async function savePersona({ id, name, prompt }) {
  if (!name?.trim() || !prompt?.trim()) {
    throw new Error('Nom et prompt requis');
  }

  const { personas } = await getStorageData(['personas']);
  const personaId = id || 'persona_' + Date.now();
  const persona = {
    id: personaId,
    name: name.trim(),
    prompt: prompt.trim(),
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString()
  };

  await setStorageData({
    personas: { ...personas, [personaId]: persona }
  });

  return persona;
}

async function deletePersona(personaId) {
  const { personas, activePersonaId } = await getStorageData(['personas', 'activePersonaId']);
  
  if (!personas[personaId]) throw new Error('Persona introuvable');
  if (Object.keys(personas).length <= 1) throw new Error('Impossible de supprimer le dernier persona');

  const newPersonas = { ...personas };
  delete newPersonas[personaId];

  const updates = { personas: newPersonas };
  if (activePersonaId === personaId) {
    updates.activePersonaId = Object.keys(newPersonas)[0];
  }

  await setStorageData(updates);
  return { deletedName: personas[personaId].name };
}

async function setActivePersona(personaId) {
  const { personas } = await getStorageData(['personas']);
  if (!personas[personaId]) throw new Error('Persona introuvable');

  await setStorageData({ 
    activePersonaId: personaId,
    personas: {
      ...personas,
      [personaId]: {
        ...personas[personaId],
        lastUsed: new Date().toISOString()
      }
    }
  });

  return personas[personaId];
}

// --- Statistiques ---
async function updateUsageStats(personaId) {
  const { extensionSettings } = await getStorageData(['extensionSettings']);
  await setStorageData({
    extensionSettings: {
      ...extensionSettings,
      totalGenerations: (extensionSettings.totalGenerations || 0) + 1,
      lastUsed: new Date().toISOString()
    }
  });
}
