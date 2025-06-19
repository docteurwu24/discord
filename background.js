// background.js - Service Worker Amélioré avec Personas

// Initialisation au premier lancement avec des personas par défaut
chrome.runtime.onInstalled.addListener(() => {
  console.log('🤖 Discord AI Assistant installé - Version Personas');

  chrome.storage.local.get(['personas', 'activePersonaId', 'apiKey', 'extensionSettings'], (result) => {
    console.log('onInstalled: Checking for existing data...', result);
    const updates = {};

    if (!result.personas) {
      const defaultPersonas = {
        'casual_friend': { id: 'casual_friend', name: '😎 Ami Décontracté', prompt: 'Tu es un ami sympa et décontracté. Tu réponds de manière naturelle, avec un ton amical et détendu. Tu utilises des expressions comme "salut", "cool", "sympa", "tranquille". Tu es toujours positif et encourageant.', createdAt: new Date().toISOString(), lastUsed: new Date().toISOString() },
        'professional': { id: 'professional', name: '💼 Assistant Professionnel', prompt: 'Tu es un assistant professionnel et courtois. Tu réponds de manière formelle mais chaleureuse. Tu utilises un vocabulaire soutenu et précis. Tu restes toujours respectueux et constructif dans tes réponses.', createdAt: new Date().toISOString(), lastUsed: new Date().toISOString() },
        'gamer': { id: 'gamer', name: '🎮 Gamer Passionné', prompt: 'Tu es un gamer passionné qui connaît bien l\'univers du gaming. Tu réponds avec enthousiasme et utilises le vocabulaire du gaming. Tu peux faire des références aux jeux populaires et comprends la culture gamer.', createdAt: new Date().toISOString(), lastUsed: new Date().toISOString() },
        'funny': { id: 'funny', name: '😂 Comique', prompt: 'Tu es quelqu\'un de drôle et spirituel. Tu aimes faire des blagues et des jeux de mots. Tu réponds avec humour tout en restant approprié. Tu utilises des emojis et des expressions amusantes pour rendre la conversation plus légère.', createdAt: new Date().toISOString(), lastUsed: new Date().toISOString() }
      };
      updates.personas = defaultPersonas;
      updates.activePersonaId = 'casual_friend';
    }

    if (!result.apiKey) {
      updates.apiKey = '';
    }

    if (!result.extensionSettings) {
      updates.extensionSettings = {
        autoSave: true,
        maxMessages: 20,
        debugMode: false,
        responseLength: 'medium',
        lastUsed: new Date().toISOString(),
        totalGenerations: 0
      };
    }

    if (Object.keys(updates).length > 0) {
      console.log('onInstalled: Applying default settings:', updates);
      chrome.storage.local.set(updates, () => {
        if (chrome.runtime.lastError) {
            console.error('onInstalled: Error applying default settings:', chrome.runtime.lastError);
        } else {
            console.log('✅ Personas et paramètres par défaut initialisés:', Object.keys(updates));
        }
      });
    } else {
      console.log('onInstalled: Existing data found, no default settings applied.');
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message reçu:', request.action, 'Données:', request.data);

  if (request.action === 'generateResponse') {
    generateAIResponse(request.data)
      .then(response => {
        console.log('✅ Réponse générée avec succès pour generateResponse');
        sendResponse({ success: true, data: response });
      })
      .catch(error => {
        console.error('❌ Erreur capturée dans le gestionnaire de messages pour generateResponse:', error);
        sendResponse({ success: false, error: error });
      });
    return true;
  }

  if (request.action === 'savePersona') {
    savePersona(request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'deletePersona') {
    deletePersona(request.data.personaId)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'setActivePersona') {
    setActivePersona(request.data.personaId)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'saveSettings') {
    console.log('Attempting to save settings:', request.data);
    chrome.storage.local.set(request.data, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Erreur lors de la sauvegarde des paramètres (saveSettings):', chrome.runtime.lastError.message, request.data);
        sendResponse({ success: false, error: 'Impossible de sauvegarder les paramètres: ' + chrome.runtime.lastError.message });
      } else {
        console.log('⚙️ Settings successfully saved:', request.data);
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (request.action === 'getSettings') {
    console.log('Attempting to get settings for keys:', request.keys);
    chrome.storage.local.get(request.keys || null, (result) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Erreur lors de la récupération des paramètres (getSettings):', chrome.runtime.lastError.message, request.keys);
        sendResponse({ success: false, error: 'Impossible de récupérer les paramètres: ' + chrome.runtime.lastError.message });
      } else {
        console.log('📋 Settings successfully retrieved:', result);
        sendResponse({ success: true, data: result });
      }
    });
    return true;
  }
});

async function generateAIResponse(conversationData) {
  let activePersonaIdForError = 'N/A';
  let currentExtensionSettings = { debugMode: false };

  try {
    console.log('🔄 Début de génération de réponse IA...');
    const storage = await chrome.storage.local.get(['apiKey', 'personas', 'activePersonaId', 'extensionSettings']);
    activePersonaIdForError = storage.activePersonaId;
    currentExtensionSettings = storage.extensionSettings || currentExtensionSettings;

    const { apiKey, personas, activePersonaId } = storage;

    if (!apiKey || apiKey.trim() === '') throw new Error("❌ Clé API Google Gemini manquante. Configurez-la dans les options de l'extension (clic sur l'icône 🤖).");
    if (!personas || Object.keys(personas).length === 0) throw new Error("❌ Aucun persona trouvé. Créez un persona dans les options de l'extension.");
    if (!activePersonaId || !personas[activePersonaId]) throw new Error("❌ Persona actif introuvable. Sélectionnez un persona dans les options.");

    const activePersona = personas[activePersonaId];
    console.log(`🎭 Utilisation du persona : "${activePersona.name}"`);
    const { messages } = conversationData;
    if (!messages || messages.length === 0) throw new Error("❌ Aucun message à analyser. Participez à la conversation d'abord.");

    const improvedPrompt = buildPersonaPrompt(messages, activePersona, currentExtensionSettings);
    console.log('📝 Prompt construit avec persona:', improvedPrompt.substring(0, 200) + '...');
    const response = await callGeminiAPI(apiKey, improvedPrompt);
    const cleanedSuggestions = processGeminiResponse(response);
    await updateUsageStats(activePersonaId);
    console.log('✨ Suggestions finales:', cleanedSuggestions);
    return cleanedSuggestions;

  } catch (error) {
    console.error('💥 Erreur lors de la génération:', error.message, error);
    if (!currentExtensionSettings.hasOwnProperty('debugMode')) {
        try {
            const settingsFallback = await chrome.storage.local.get('extensionSettings');
            currentExtensionSettings = settingsFallback.extensionSettings || { debugMode: false };
        } catch (e) { console.warn("Impossible de récupérer extensionSettings dans le bloc catch principal:", e); }
    }
     if (activePersonaIdForError === 'N/A') {
        try {
            const personaIdFallback = await chrome.storage.local.get('activePersonaId');
            activePersonaIdForError = personaIdFallback.activePersonaId || 'N/A';
        } catch (e) { console.warn("Impossible de récupérer activePersonaId dans le bloc catch principal:", e); }
    }
    const errorForLogging = {
      timestamp: new Date().toISOString(),
      message: error.message,
      errorType: error.name || 'GenerationError',
      persona: activePersonaIdForError,
    };
    if (currentExtensionSettings.debugMode && error.stack) errorForLogging.stack = error.stack;
    chrome.storage.local.get(['errorLog'], (result) => {
      const errorLog = (result.errorLog || []).slice(-9);
      errorLog.push(errorForLogging);
      chrome.storage.local.set({ errorLog });
    });
    const errorForResponse = { message: error.message, errorType: error.name || 'GenerationError' };
    if (currentExtensionSettings.debugMode && error.stack) errorForResponse.stack = error.stack;
    throw errorForResponse;
  }
}

function buildPersonaPrompt(messages, persona, settings) {
  const maxMessages = settings?.maxMessages || 15;
  const responseLength = settings?.responseLength || 'medium';
  const recentMessages = messages.slice(-maxMessages);
  const conversationHistory = recentMessages.map(msg => `${msg.author}: ${msg.content}`).join('\n');
  const lengthInstructions = {
    'short': 'Réponses très courtes (5-15 mots maximum)',
    'medium': 'Réponses modérées (15-40 mots)',
    'long': 'Réponses détaillées (40-80 mots)'
  };
  return `Tu es un assistant IA qui génère des suggestions de réponses pour des conversations Discord. ...`; // Truncated for brevity
}

async function callGeminiAPI(apiKey, prompt) {
  console.log('Attempting to call Gemini API');
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
  const requestBody = { /* ... */ }; // Truncated for brevity
  console.log('🚀 Envoi de la requête à Gemini...');
  const response = await fetch(GEMINI_API_URL, { /* ... */ }); // Truncated for brevity
  if (!response.ok) {
    const rawErrorBody = await response.text();
    console.error('🔥 Erreur API Gemini (corps brut):', rawErrorBody);
    let errorData = {}; try { errorData = JSON.parse(rawErrorBody); } catch (e) { console.warn('⚠️ Impossible de parser le corps de l\'erreur JSON:', e, rawErrorBody); }
    console.error('🔥 Erreur API Gemini (données parsées potentielles):', errorData);
    const messageDetail = (errorData && errorData.error && errorData.error.message) ? errorData.error.message : rawErrorBody;
    if (response.status === 400) throw new Error(`Erreur 400 (Mauvaise requête): Clé API invalide ou requête malformée. Gemini dit: "${messageDetail}"`);
    else if (response.status === 403) throw new Error(`Erreur 403 (Interdit): Accès refusé. Vérifiez les permissions de votre clé API. Gemini dit: "${messageDetail}"`);
    else if (response.status === 429) throw new Error(`Erreur 429 (Trop de requêtes): Limite de taux dépassée. Attendez avant de réessayer. Gemini dit: "${messageDetail}"`);
    else throw new Error(`Erreur API (${response.status}): ${messageDetail}`);
  }
  const data = await response.json();
  console.log('📥 Réponse brute Gemini reçue');
  return data;
}

function processGeminiResponse(data) {
  try {
    console.log('⚙️ Entrée de processGeminiResponse (données brutes API):', JSON.stringify(data, null, 2));
    if (data.promptFeedback && data.promptFeedback.blockReason) { /* ... */ } // Truncated
    const candidate = data.candidates && data.candidates.length > 0 ? data.candidates[0] : null;
    if (!candidate) { /* ... */ throw new Error('Aucune suggestion (candidate) générée par l\'IA...'); } // Truncated
    if (candidate.finishReason) { /* ... */ } else if (candidate.safetyRatings) { /* ... */ } // Truncated
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) { /* ... */ throw new Error('Réponse IA (candidate.content.parts) malformée ou vide...'); } // Truncated
    const textResponse = candidate.content.parts[0].text;
    console.log('📄 Texte brut de la réponse IA (textResponse):', textResponse);
    if (!textResponse || textResponse.trim() === '') { /* ... */ throw new Error('Réponse IA (textResponse) vide...');} // Truncated
    let suggestions = textResponse.split('\n').map(line => line.trim().replace(/^[-*•]\s*|^\d+[\.)]\s*|^[►▸]\s*/, '')).filter(line => line.length >= 3 && !/suggestion|réponse|voici|voilà/i.test(line)).slice(0, 4);
    if (suggestions.length > 0 && suggestions.length < 4) { /* ... */ } // Truncated for brevity (variation logic)
    if (suggestions.length === 0) { /* ... */ throw new Error('No valid suggestions could be extracted from the AI response.');} // Truncated
    console.log('✨ Suggestions finales après traitement:', suggestions);
    return suggestions;
  } catch (error) { console.error('💥 Erreur dans processGeminiResponse. Données d\'entrée (data):', JSON.stringify(data, null, 2), 'Erreur:', error); throw error; }
}

function createVariation(original) { /* ... */ return ""; } // Truncated

async function savePersona(personaData) {
  console.log('Attempting to save persona:', personaData);
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['personas'], (result) => {
      const personas = result.personas || {};
      const personaId = personaData.id || 'persona_' + Date.now();
      const persona = {
        id: personaId, name: personaData.name || 'Nouveau Persona',
        prompt: personaData.prompt || 'Tu es un assistant amical.',
        createdAt: personaData.createdAt || new Date().toISOString(),
        lastUsed: new Date().toISOString()
      };
      personas[personaId] = persona;
      chrome.storage.local.set({ personas }, () => {
        if (chrome.runtime.lastError) {
          console.error('❌ Erreur lors de la sauvegarde du persona (savePersona):', chrome.runtime.lastError.message, personaData);
          reject(new Error('Impossible de sauvegarder le persona: ' + chrome.runtime.lastError.message));
        } else {
          console.log('✅ Persona successfully saved/updated. All personas:', personas);
          resolve(persona);
        }
      });
    });
  });
}

async function deletePersona(personaId) {
  console.log('Attempting to delete persona:', personaId); // Added log
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['personas', 'activePersonaId'], (result) => {
      let { personas, activePersonaId } = result;
      personas = personas || {};
      if (!personas[personaId]) return reject(new Error('Persona introuvable'));
      if (Object.keys(personas).length <= 1) return reject(new Error('Impossible de supprimer le dernier persona'));
      const personaName = personas[personaId].name;
      delete personas[personaId];
      const updates = { personas };
      if (activePersonaId === personaId) updates.activePersonaId = Object.keys(personas)[0];
      chrome.storage.local.set(updates, () => {
        if (chrome.runtime.lastError) {
          console.error('❌ Erreur lors de la suppression du persona:', chrome.runtime.lastError.message, personaId);
          reject(new Error('Impossible de supprimer le persona: ' + chrome.runtime.lastError.message));
        } else {
          console.log('🗑️ Persona successfully deleted. Name:', personaName, "New active ID (if changed):", updates.activePersonaId);
          resolve({ deletedName: personaName, newActive: updates.activePersonaId });
        }
      });
    });
  });
}

async function setActivePersona(personaId) {
  console.log('Attempting to set active persona:', personaId);
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['personas'], (result) => {
      const personas = result.personas || {};
      if (!personas[personaId]) return reject(new Error('Persona introuvable'));
      personas[personaId].lastUsed = new Date().toISOString();
      chrome.storage.local.set({ activePersonaId: personaId, personas: personas }, () => {
        if (chrome.runtime.lastError) {
          console.error('❌ Erreur lors de l\'activation du persona:', chrome.runtime.lastError.message, personaId);
          reject(new Error('Impossible d\'activer le persona: ' + chrome.runtime.lastError.message));
        } else {
          console.log('🎭 Active persona set. ID:', personaId, 'All personas:', personas);
          resolve(personas[personaId]);
        }
      });
    });
  });
}

async function updateUsageStats(personaId) { /* ... */ } // Truncated, no logging changes requested here
