// background.js - Service Worker Amélioré

// Initialisation au premier lancement avec des valeurs par défaut plus robustes
chrome.runtime.onInstalled.addListener(() => {
  console.log('🤖 Discord AI Assistant installé - Version améliorée');
  
  // Vérifier si des données existent déjà avant d'initialiser
  chrome.storage.local.get(['userProfiles', 'activeProfileId', 'apiKey'], (result) => {
    const updates = {};
    
    if (!result.userProfiles) {
      // Créer un profil par défaut si aucun n'existe
      const defaultProfileId = 'default_' + Date.now();
      updates.userProfiles = {
        [defaultProfileId]: {
          id: defaultProfileId,
          name: 'Profil par défaut',
          tone: 'casual',
          responseLength: 'medium',
          expressions: ['ok', 'cool', 'sympa'],
          expertise: ['général'],
          createdAt: new Date().toISOString()
        }
      };
      updates.activeProfileId = defaultProfileId;
    }
    
    if (!result.apiKey) {
      updates.apiKey = '';
    }
    
    // Ajouter des paramètres d'extension
    updates.extensionSettings = {
      autoSave: true,
      maxMessages: 20,
      debugMode: false,
      lastUsed: new Date().toISOString()
    };
    
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates, () => {
        console.log('✅ Paramètres initialisés:', updates);
      });
    }
  });
});

// Écoute les messages du content script avec gestion d'erreurs améliorée
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message reçu:', request);
  
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
  
  // Nouvelle action pour sauvegarder les paramètres
  if (request.action === 'saveSettings') {
    chrome.storage.local.set(request.data, () => {
      console.log('⚙️ Paramètres sauvegardés:', request.data);
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Nouvelle action pour récupérer les paramètres
  if (request.action === 'getSettings') {
    chrome.storage.local.get(request.keys || null, (result) => {
      console.log('📋 Paramètres récupérés:', result);
      sendResponse({ success: true, data: result });
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
      'userProfiles', 
      'activeProfileId', 
      'extensionSettings'
    ]);
    
    const { apiKey, userProfiles, activeProfileId, extensionSettings } = storage;
    
    // Validations avec messages d'erreur plus précis
    if (!apiKey || apiKey.trim() === '') {
      throw new Error("❌ Clé API Google Gemini manquante. Configurez-la dans les options de l'extension (clic sur l'icône 🤖).");
    }

    if (!userProfiles || Object.keys(userProfiles).length === 0) {
      throw new Error("❌ Aucun profil trouvé. Créez un profil dans les options de l'extension.");
    }
    
    if (!activeProfileId || !userProfiles[activeProfileId]) {
      throw new Error("❌ Profil actif introuvable. Sélectionnez un profil dans les options.");
    }
    
    const activeProfile = userProfiles[activeProfileId];
    console.log(`🎭 Utilisation du profil : "${activeProfile.name}"`);

    const { messages } = conversationData;
    
    if (!messages || messages.length === 0) {
      throw new Error("❌ Aucun message à analyser. Participez à la conversation d'abord.");
    }

    // Construction du prompt amélioré
    const improvedPrompt = buildImprovedPrompt(messages, activeProfile, extensionSettings);
    
    console.log('📝 Prompt construit:', improvedPrompt.substring(0, 200) + '...');

    // Appel API avec paramètres optimisés
    const response = await callGeminiAPI(apiKey, improvedPrompt);
    
    // Traitement et nettoyage de la réponse
    const cleanedSuggestions = processGeminiResponse(response);
    
    // Mise à jour des statistiques d'utilisation
    await updateUsageStats(activeProfileId);
    
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
        stack: error.stack
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

function buildImprovedPrompt(messages, profile, settings) {
  const { tone, expressions, responseLength, expertise } = profile;
  const maxMessages = settings?.maxMessages || 15;
  
  // Prendre les messages les plus récents
  const recentMessages = messages.slice(-maxMessages);
  const conversationHistory = recentMessages
    .map(msg => `${msg.author}: ${msg.content}`)
    .join('\n');

  // Construction du contexte d'expertise
  let expertiseContext = '';
  if (expertise && expertise.length > 0) {
    expertiseContext = `Tu as des connaissances dans : ${expertise.join(', ')}. Utilise cette expertise quand c'est pertinent pour la conversation.`;
  }

  // Construction du contexte d'expressions
  let expressionContext = '';
  if (expressions && expressions.length > 0) {
    expressionContext = `Intègre naturellement ces expressions dans tes réponses : ${expressions.join(', ')}. Ne les force pas, utilise-les seulement si elles s'intègrent bien.`;
  }

  // Paramètres de longueur
  const lengthInstructions = {
    'short': 'Réponses très courtes (5-15 mots maximum)',
    'medium': 'Réponses modérées (15-40 mots)',
    'long': 'Réponses détaillées (40-80 mots)'
  };

  // Paramètres de ton
  const toneInstructions = {
    'casual': 'Ton décontracté et naturel, comme entre amis',
    'formal': 'Ton poli et respectueux, langage soutenu',
    'friendly': 'Ton chaleureux et bienveillant',
    'professional': 'Ton professionnel et compétent',
    'sarcastic': 'Ton ironique et piquant (avec subtilité)',
    'humorous': 'Ton amusant et léger',
    'serious': 'Ton sérieux et réfléchi'
  };

  return `Tu es un assistant IA spécialisé dans les conversations Discord. Ta mission est de générer exactement 4 suggestions de réponses pertinentes pour continuer une conversation naturellement.

CONTEXTE DE LA CONVERSATION :
${conversationHistory}

PERSONNALITÉ À ADOPTER :
- Ton : ${toneInstructions[tone] || toneInstructions.casual}
- Longueur : ${lengthInstructions[responseLength] || lengthInstructions.medium}
- ${expertiseContext}
- ${expressionContext}

RÈGLES STRICTES :
1. Génère EXACTEMENT 4 suggestions, ni plus ni moins
2. Chaque suggestion sur une nouvelle ligne
3. Pas de numéros, tirets ou puces
4. Pas d'explications ou commentaires
5. Concentre-toi sur les 3 derniers messages pour la pertinence
6. Sois authentique et humain, évite le langage robotique
7. Varie le style entre les 4 suggestions
8. Assure-toi que chaque réponse peut logiquement suivre la conversation

FORMATS INTERDITS :
❌ 1. Première réponse
❌ - Première réponse  
❌ • Première réponse

FORMAT CORRECT :
✅ Première réponse
✅ Deuxième réponse
✅ Troisième réponse
✅ Quatrième réponse

Génère maintenant 4 suggestions de réponses :`;
}

async function callGeminiAPI(apiKey, prompt) {
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{ 
      parts: [{ text: prompt }] 
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 300,
      topP: 0.8,
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
      'User-Agent': 'Discord-AI-Assistant/1.0'
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
  console.log('📥 Réponse brute Gemini:', JSON.stringify(data, null, 2));
  return data;
}

function processGeminiResponse(data) {
  // Validation de la structure de réponse
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('Aucune suggestion générée par l\'IA. Réessayez avec une conversation différente.');
  }

  const candidate = data.candidates[0];
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    throw new Error('Réponse IA malformée. Réessayez.');
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
             !line.toLowerCase().includes('réponse');
    })
    .slice(0, 4); // Garder max 4 suggestions

  if (suggestions.length === 0) {
    throw new Error('Impossible d\'extraire des suggestions valides. Reformulez votre conversation.');
  }

  // Si moins de 4 suggestions, on peut essayer de générer des variantes
  while (suggestions.length < 4 && suggestions.length > 0) {
    const lastSuggestion = suggestions[suggestions.length - 1];
    // Ajouter une variante simple si pas assez de suggestions
    if (suggestions.length < 2) {
      suggestions.push(addVariation(lastSuggestion));
    } else {
      break; // Arrêter si on ne peut pas générer plus naturellement
    }
  }

  return suggestions;
}

function addVariation(original) {
  const variations = [
    text => `Ah ${text.toLowerCase()}`,
    text => `${text} 👍`,
    text => `Exactement, ${text.toLowerCase()}`,
    text => `${text} !`
  ];
  
  const randomVariation = variations[Math.floor(Math.random() * variations.length)];
  return randomVariation(original);
}

async function updateUsageStats(profileId) {
  try {
    const result = await chrome.storage.local.get(['usageStats']);
    const stats = result.usageStats || {};
    
    const today = new Date().toDateString();
    if (!stats[today]) {
      stats[today] = { total: 0, profiles: {} };
    }
    
    stats[today].total += 1;
    stats[today].profiles[profileId] = (stats[today].profiles[profileId] || 0) + 1;
    
    // Garder seulement les 30 derniers jours
    const dates = Object.keys(stats).sort();
    if (dates.length > 30) {
      dates.slice(0, dates.length - 30).forEach(date => delete stats[date]);
    }
    
    await chrome.storage.local.set({ usageStats: stats });
  } catch (error) {
    console.warn('⚠️ Impossible de mettre à jour les statistiques:', error);
  }
}