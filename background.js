// background.js - Service Worker Amélioré avec Personas

// Initialisation au premier lancement avec des personas par défaut
chrome.runtime.onInstalled.addListener(() => {
  console.log('🤖 Discord AI Assistant installé - Version Personas');

  // Vérifier si des données existent déjà avant d'initialiser
  chrome.storage.local.get(['personas', 'activePersonaId', 'apiKey', 'extensionSettings'], (result) => {
    console.log('onInstalled: Initial storage content:', JSON.parse(JSON.stringify(result)));
    const updates = {};

    if (!result.personas) {
      console.log('onInstalled: No existing personas found. Initializing default personas.');
      // Créer des personas par défaut si aucun n'existe
      const defaultPersonas = {
        'casual_friend': {
          id: 'casual_friend',
          name: '😎 Ami Décontracté',
          prompt: 'Tu es un ami sympa et décontracté. Tu réponds de manière naturelle, avec un ton amical et détendu. Tu utilises des expressions comme "salut", "cool", "sympa", "tranquille". Tu es toujours positif et encourageant.',
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        },
        'professional': {
          id: 'professional',
          name: '💼 Assistant Professionnel',
          prompt: 'Tu es un assistant professionnel et courtois. Tu réponds de manière formelle mais chaleureuse. Tu utilises un vocabulaire soutenu et précis. Tu restes toujours respectueux et constructif dans tes réponses.',
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        },
        'gamer': {
          id: 'gamer',
          name: '🎮 Gamer Passionné',
          prompt: 'Tu es un gamer passionné qui connaît bien l\'univers du gaming. Tu réponds avec enthousiasme et utilises le vocabulaire du gaming. Tu peux faire des références aux jeux populaires et comprends la culture gamer.',
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        },
        'funny': {
          id: 'funny',
          name: '😂 Comique',
          prompt: 'Tu es quelqu\'un de drôle et spirituel. Tu aimes faire des blagues et des jeux de mots. Tu réponds avec humour tout en restant approprié. Tu utilises des emojis et des expressions amusantes pour rendre la conversation plus légère.',
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        }
      };

      updates.personas = defaultPersonas;
      updates.activePersonaId = 'casual_friend';
    }

    if (!result.apiKey) {
      console.log('onInstalled: No existing API key found. Initializing with an empty API key.');
      updates.apiKey = '';
    }

    if (!result.extensionSettings) {
      console.log('onInstalled: No existing extension settings found. Initializing default settings.');
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
      chrome.storage.local.set(updates, () => {
        console.log('✅ onInstalled: Default data initialized for keys:', Object.keys(updates));
      });
    }
  });
});

// Écoute les messages du content script avec gestion d'erreurs améliorée
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message reçu:', request.action);

  if (request.action === 'generateResponse') {
    generateAIResponse(request.data)
      .then(response => {
        console.log('✅ Réponse générée avec succès');
        sendResponse({ success: true, data: response });
      })
      .catch(error => {
        console.error('❌ Erreur capturée dans le gestionnaire de messages:', error);
        sendResponse({
          success: false,
          error: error.message,
          errorType: error.name || 'GenerationError'
        });
      });
    return true; // Obligatoire pour une réponse asynchrone
  }

  // Actions pour la gestion des personas
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

  // Actions génériques pour les paramètres
  if (request.action === 'saveSettings') {
    if (request.data.hasOwnProperty('apiKey')) {
        const apiKeyToSave = request.data.apiKey;
        if (typeof apiKeyToSave !== 'string') {
            console.error('Error: API Key to save is not a string. Aborting saveSettings for this request. Value:', apiKeyToSave);
            sendResponse({ success: false, error: 'Invalid API Key format. Must be a string.' });
            return true; // Stop processing this message
        }
        // If it IS a string, even if empty, popup.js logic already handles trimming and the user might intend to clear it.
        // The original issue is about data *not saving when it should*, so preventing saving of valid empty strings is counterproductive.
        // The main goal here is to prevent saving *non-string* types for apiKey.
    }

    // Proceed with the original save logic if all checks pass or if apiKey was not in request.data
    chrome.storage.local.set(request.data, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Erreur lors de la sauvegarde des paramètres:', chrome.runtime.lastError);
        sendResponse({ success: false, error: 'Impossible de sauvegarder les paramètres: ' + chrome.runtime.lastError.message });
      } else {
        console.log('⚙️ Paramètres sauvegardés:', Object.keys(request.data));
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (request.action === 'getSettings') {
    chrome.storage.local.get(request.keys || null, (result) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Erreur lors de la récupération des paramètres:', chrome.runtime.lastError);
        sendResponse({ success: false, error: 'Impossible de récupérer les paramètres: ' + chrome.runtime.lastError.message });
      } else {
        console.log('📋 Paramètres récupérés:', Object.keys(result));
        sendResponse({ success: true, data: result });
      }
    });
    return true;
  }
});

async function generateAIResponse(conversationData) {
  try {
    console.log('🔄 Début de génération de réponse IA...');

    // Récupération des données avec validation
    const storage = await chrome.storage.local.get([
      'apiKey',
      'personas',
      'activePersonaId',
      'extensionSettings'
    ]);

    const { apiKey, personas, activePersonaId, extensionSettings } = storage;

    // Validations avec messages d'erreur plus précis
    if (!apiKey || apiKey.trim() === '') {
      throw new Error("❌ Clé API Google Gemini manquante. Configurez-la dans les options de l'extension (clic sur l'icône 🤖).");
    }

    if (!personas || Object.keys(personas).length === 0) {
      throw new Error("❌ Aucun persona trouvé. Créez un persona dans les options de l'extension.");
    }

    if (!activePersonaId || !personas[activePersonaId]) {
      throw new Error("❌ Persona actif introuvable. Sélectionnez un persona dans les options.");
    }

    const activePersona = personas[activePersonaId];
    console.log(`🎭 Utilisation du persona : "${activePersona.name}"`);

    const { messages } = conversationData;

    if (!messages || messages.length === 0) {
      throw new Error("❌ Aucun message à analyser. Participez à la conversation d'abord.");
    }

    // Construction du prompt avec le persona
    const improvedPrompt = buildPersonaPrompt(messages, activePersona, extensionSettings);

    console.log('📝 Prompt construit avec persona:', improvedPrompt.substring(0, 200) + '...');

    // Appel API avec paramètres optimisés
    const response = await callGeminiAPI(apiKey, improvedPrompt);

    // Traitement et nettoyage de la réponse
    const cleanedSuggestions = processGeminiResponse(response);

    // Mise à jour des statistiques d'utilisation
    await updateUsageStats(activePersonaId);

    console.log('✨ Suggestions finales:', cleanedSuggestions);
    return cleanedSuggestions;

  } catch (error) {
    console.error('💥 Erreur lors de la génération:', error);

    // Enregistrer l'erreur pour débuggage
    chrome.storage.local.get(['errorLog'], (result) => {
      const errorLog = result.errorLog || [];
      errorLog.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack,
        persona: activePersonaId
      });

      // Garder seulement les 10 dernières erreurs
      if (errorLog.length > 10) {
        errorLog.splice(0, errorLog.length - 10);
      }

      chrome.storage.local.set({ errorLog });
    });

    throw error;
  }
}

function buildPersonaPrompt(messages, persona, settings) {
  const maxMessages = settings?.maxMessages || 15;
  const responseLength = settings?.responseLength || 'medium';

  // Prendre les messages les plus récents
  const recentMessages = messages.slice(-maxMessages);
  const conversationHistory = recentMessages
    .map(msg => `${msg.author}: ${msg.content}`)
    .join('\n');

  // Paramètres de longueur
  const lengthInstructions = {
    'short': 'Réponses très courtes (5-15 mots maximum)',
    'medium': 'Réponses modérées (15-40 mots)',
    'long': 'Réponses détaillées (40-80 mots)'
  };

  return `Tu es un assistant IA qui génère des suggestions de réponses pour des conversations Discord.

PERSONA À INCARNER :
${persona.prompt}

CONTEXTE DE LA CONVERSATION :
${conversationHistory}

INSTRUCTIONS :
- Incarne parfaitement le persona décrit ci-dessus
- Génère EXACTEMENT 4 suggestions de réponses différentes
- ${lengthInstructions[responseLength]}
- Concentre-toi sur les 3 derniers messages pour la pertinence
- Chaque suggestion doit refléter la personnalité du persona
- Varie le style et l'approche entre les 4 suggestions
- Sois naturel et authentique selon le persona

RÈGLES DE FORMAT :
1. Une suggestion par ligne
2. Pas de numéros, tirets ou puces
3. Pas d'explications ou commentaires
4. EXACTEMENT 4 lignes de réponse

Génère maintenant 4 suggestions qui correspondent au persona :`;
}

async function savePersona(personaData) {
  return new Promise((resolve, reject) => {
    // Validate incoming personaData fields first
    const name = (typeof personaData.name === 'string') ? personaData.name.trim() : '';
    const prompt = (typeof personaData.prompt === 'string') ? personaData.prompt.trim() : '';

    if (!name) {
      const errorMsg = 'Persona name is required and must be a non-empty string.';
      console.error('Error saving persona:', errorMsg, 'Received data:', personaData);
      reject(new Error(errorMsg));
      return;
    }
    if (!prompt) {
      const errorMsg = 'Persona prompt is required and must be a non-empty string.';
      console.error('Error saving persona:', errorMsg, 'Received data:', personaData);
      reject(new Error(errorMsg));
      return;
    }

    chrome.storage.local.get(['personas'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Erreur lors de la récupération des personas pour sauvegarde:', chrome.runtime.lastError);
        reject(new Error('Impossible de récupérer les personas: ' + chrome.runtime.lastError.message));
        return;
      }

      const personas = result.personas || {};
      const personaId = personaData.id || 'persona_' + Date.now();

      let createdAtDate;
      if (personaData.id && personas[personaId] && personas[personaId].createdAt) {
        createdAtDate = personas[personaId].createdAt;
      } else if (personaData.createdAt) {
        createdAtDate = personaData.createdAt;
      } else {
        createdAtDate = new Date().toISOString();
      }

      const persona = {
        id: personaId,
        name: name, // Use the validated & trimmed name
        prompt: prompt, // Use the validated & trimmed prompt
        createdAt: createdAtDate,
        lastUsed: new Date().toISOString()
      };

      personas[personaId] = persona;

      chrome.storage.local.set({ personas }, () => {
        if (chrome.runtime.lastError) {
          console.error('❌ Erreur lors de la sauvegarde du persona:', chrome.runtime.lastError);
          reject(new Error('Impossible de sauvegarder le persona: ' + chrome.runtime.lastError.message));
        } else {
          console.log('✅ Persona sauvegardé:', persona.name, 'ID:', persona.id);
          resolve(persona);
        }
      });
    });
  });
}

async function deletePersona(personaId) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['personas', 'activePersonaId'], (result) => {
      const personas = result.personas || {};
      const activePersonaId = result.activePersonaId;

      if (!personas[personaId]) {
        reject(new Error('Persona introuvable'));
        return;
      }

      // Empêcher la suppression du dernier persona
      if (Object.keys(personas).length <= 1) {
        reject(new Error('Impossible de supprimer le dernier persona'));
        return;
      }

      const personaName = personas[personaId].name;
      delete personas[personaId];

      const updates = { personas };

      // Si c'était le persona actif, en sélectionner un autre
      if (activePersonaId === personaId) {
        const remainingIds = Object.keys(personas);
        updates.activePersonaId = remainingIds[0];
      }

      chrome.storage.local.set(updates, () => {
        if (chrome.runtime.lastError) {
          console.error('❌ Erreur lors de la suppression du persona:', chrome.runtime.lastError);
          reject(new Error('Impossible de supprimer le persona: ' + chrome.runtime.lastError.message));
        } else {
          console.log('🗑️ Persona supprimé:', personaName);
          resolve({ deletedName: personaName, newActive: updates.activePersonaId });
        }
      });
    });
  });
}

async function setActivePersona(personaId) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['personas'], (result) => {
      const personas = result.personas || {};

      if (!personas[personaId]) {
        reject(new Error('Persona introuvable'));
        return;
      }

      // Mettre à jour la date de dernière utilisation
      personas[personaId].lastUsed = new Date().toISOString();

      chrome.storage.local.set({
        activePersonaId: personaId,
        personas: personas
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('❌ Erreur lors de l\'activation du persona:', chrome.runtime.lastError);
          reject(new Error('Impossible d\'activer le persona: ' + chrome.runtime.lastError.message));
        } else {
          console.log('🎭 Persona actif changé:', personas[personaId].name);
          resolve(personas[personaId]);
        }
      });
    });
  });
}

async function callGeminiAPI(apiKey, prompt) {
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 300,
      topP: 0.9,
      topK: 40
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ]
  };

  console.log('🚀 Envoi de la requête à Gemini...');

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Discord-AI-Assistant-Personas/1.0'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('🔥 Erreur API Gemini:', errorData);

    if (response.status === 400) {
      throw new Error('Clé API invalide ou requête malformée. Vérifiez votre clé API.');
    } else if (response.status === 403) {
      throw new Error('Accès refusé. Vérifiez que votre clé API a les bonnes permissions.');
    } else if (response.status === 429) {
      throw new Error('Limite de taux dépassée. Attendez quelques minutes avant de réessayer.');
    } else {
      throw new Error(`Erreur API (${response.status}): ${errorData.error?.message || 'Erreur inconnue'}`);
    }
  }

  const data = await response.json();
  console.log('📥 Réponse brute Gemini reçue');
  return data;
}

  function processGeminiResponse(data) {
    // Enregistrer la réponse brute pour le débogage
    console.log('📥 Réponse brute Gemini pour traitement:', JSON.stringify(data, null, 2));

    // Vérifier les blocages de sécurité ou les raisons de fin
    if (data.promptFeedback && data.promptFeedback.blockReason) {
      const blockReason = data.promptFeedback.blockReason;
      console.error('🚫 Contenu bloqué par les filtres de sécurité Gemini:', blockReason);
      throw new Error(`La génération a été bloquée par les filtres de sécurité de l'IA. Raison: ${blockReason}. Veuillez reformuler votre message.`);
    }
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].finishReason) {
      const finishReason = data.candidates[0].finishReason;
      if (finishReason === 'SAFETY') {
        console.error('🚫 Contenu bloqué par les filtres de sécurité Gemini (finishReason):', finishReason);
        throw new Error(`La réponse a été bloquée par les filtres de sécurité de l'IA. Veuillez reformuler votre message.`);
      }
      if (finishReason === 'STOP') {
        // C'est une fin normale, pas une erreur
      }
      if (finishReason === 'MAX_TOKENS') {
        console.warn('⚠️ Génération arrêtée en raison de la limite de tokens.');
        // Pas une erreur critique, mais peut être notifié à l'utilisateur si nécessaire
      }
      // Autres finishReason peuvent être gérés ici si nécessaire
    }

    // Validation de la structure de réponse
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Aucune suggestion générée par l\'IA. Réessayez avec une conversation différente.');
    }

    const candidate = data.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('Réponse IA malformée ou vide. Réessayez.');
    }

    const textResponse = candidate.content.parts[0].text;
    if (!textResponse || textResponse.trim() === '') {
      throw new Error('Réponse IA vide. Réessayez.');
    }

    // Nettoyage et formatage amélioré
    const suggestions = textResponse
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Supprimer les préfixes courants
        return line.replace(/^[-*•]\s*|^\d+[\.)]\s*|^[►▸]\s*/, '');
      })
      .filter(line => {
        // Filtrer les lignes trop courtes ou qui semblent être des instructions
        return line.length >= 3 &&
               !line.toLowerCase().includes('suggestion') &&
               !line.toLowerCase().includes('réponse') &&
               !line.toLowerCase().includes('voici') &&
               !line.toLowerCase().includes('voilà');
      })
      .slice(0, 4); // Garder max 4 suggestions

    if (suggestions.length === 0) {
      throw new Error('Impossible d\'extraire des suggestions valides. Reformulez votre conversation.');
    }

    // Si moins de 4 suggestions, essayer de créer des variantes
    while (suggestions.length < 4 && suggestions.length > 0) {
      const baseSuggestion = suggestions[suggestions.length - 1];
      const variation = createVariation(baseSuggestion);
      if (variation && !suggestions.includes(variation)) {
        suggestions.push(variation);
      } else {
        break;
      }
    }

    return suggestions;
  }

function createVariation(original) {
  const variations = [
    text => `${text} 👍`,
    text => `Ah, ${text.toLowerCase()}`,
    text => `${text} !`,
    text => `Exactement ! ${text}`,
    text => text.endsWith('?') ? text.replace('?', ' ?') : `${text} ?`
  ];

  const randomVariation = variations[Math.floor(Math.random() * variations.length)];
  return randomVariation(original);
}

async function updateUsageStats(personaId) {
  try {
    const result = await chrome.storage.local.get(['usageStats', 'extensionSettings']);
    const stats = result.usageStats || {};
    const settings = result.extensionSettings || {};

    const today = new Date().toDateString();
    if (!stats[today]) {
      stats[today] = { total: 0, personas: {} };
    }

    stats[today].total += 1;
    stats[today].personas[personaId] = (stats[today].personas[personaId] || 0) + 1;

    // Mettre à jour les paramètres globaux
    settings.totalGenerations = (settings.totalGenerations || 0) + 1;
    settings.lastUsed = new Date().toISOString();

    // Garder seulement les 30 derniers jours
    const dates = Object.keys(stats).sort();
    if (dates.length > 30) {
      dates.slice(0, dates.length - 30).forEach(date => delete stats[date]);
    }

    await chrome.storage.local.set({
      usageStats: stats,
      extensionSettings: settings
    });
  } catch (error) {
    console.warn('⚠️ Impossible de mettre à jour les statistiques:', error);
  }
}
