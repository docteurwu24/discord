// background.js - Service Worker

// Initialisation au premier lancement
chrome.runtime.onInstalled.addListener(() => {
  console.log('🤖 Discord AI Assistant installé');
  // Initialise le stockage avec des valeurs vides pour éviter les erreurs
  chrome.storage.local.set({
    userProfiles: {},
    activeProfileId: null,
    apiKey: ''
  });
});

// Écoute les messages du content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateResponse') {
    generateAIResponse(request.data)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => {
        console.error('Erreur capturée dans le gestionnaire de messages:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Obligatoire pour une réponse asynchrone
  }
});

async function generateAIResponse(conversationData) {
  try {
    // **CHANGEMENT CLÉ** : On récupère les profils et l'ID du profil actif
    const storage = await chrome.storage.local.get(['apiKey', 'userProfiles', 'activeProfileId']);
    const { apiKey, userProfiles, activeProfileId } = storage;
    
    if (!apiKey) {
      throw new Error("Clé API Google Gemini non configurée. Veuillez l'ajouter dans les options de l'extension.");
    }

    if (!userProfiles || Object.keys(userProfiles).length === 0) {
      throw new Error("Aucun profil créé. Veuillez en créer un dans les options de l'extension.");
    }
    
    if (!activeProfileId || !userProfiles[activeProfileId]) {
      throw new Error("Aucun profil actif sélectionné. Veuillez en choisir un dans les options de l'extension.");
    }
    
    const activeProfile = userProfiles[activeProfileId];
    console.log(`🤖 Utilisation du profil actif : "${activeProfile.name}"`);

    const { messages } = conversationData;
    const { tone, expressions, responseLength, expertise } = activeProfile;

    // Construire le prompt pour Gemini
    const conversationHistory = messages.map(msg => `${msg.author}: ${msg.content}`).join('\n');

    let expertisePrompt = '';
    if (expertise && expertise.length > 0) {
      expertisePrompt = `L'utilisateur a une expertise dans : ${expertise.join(', ')}. Utilise cette information si c'est pertinent.`;
    }

    let expressionsPrompt = '';
    if (expressions && expressions.length > 0) {
        expressionsPrompt = `Intègre naturellement, si possible, des expressions comme : ${expressions.join(', ')}.`;
    }

    const fullPrompt = `Tu es un assistant IA pour Discord. Ton but est de générer 3 à 5 suggestions de réponses courtes, naturelles et pertinentes pour continuer une conversation.

Contexte de la conversation (les messages les plus récents sont à la fin) :
---
${conversationHistory}
---

Personnalité à adopter pour les réponses :
- Ton : ${tone}
- Longueur des réponses : ${responseLength}
- ${expressionsPrompt}
- ${expertisePrompt}

Instructions :
1.  **Concentre-toi sur les derniers messages** pour formuler des réponses directes et engageantes.
2.  Sois **humain et crédible**, évite le langage robotique ou trop formel, sauf si demandé.
3.  Ne fournis **AUCUNE explication**, préfixe, ou commentaire.
4.  Génère UNIQUEMENT les suggestions de réponse, chacune sur une nouvelle ligne.

Suggestions de réponses :`;

    console.log('✉️ Prompt envoyé à Gemini:', fullPrompt);

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        // Ajout de paramètres pour un meilleur contrôle
        generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 200
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erreur API Gemini:', errorData);
      throw new Error(`Erreur API Gemini: ${errorData.error.message || 'Réponse invalide'}`);
    }

    const data = await response.json();
    console.log('✅ Réponse brute de Gemini:', JSON.stringify(data, null, 2)); // Log détaillé de la réponse brute

    if (data.candidates && data.candidates.length > 0 && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
      const part = data.candidates[0].content.parts[0];
      if (part && part.text) {
        const textResponse = part.text;
        // Nettoyer la réponse : supprimer les puces, les numéros et les lignes vides.
      return textResponse.split('\n')
        .map(s => s.trim().replace(/^[-*]\s*|^\d+\.\s*/, '')) // Supprime les puces/numéros
        .filter(s => s.length > 0);
      } else {
        console.error("La partie de contenu de la réponse de l'IA est inattendue ou vide:", data);
        throw new Error("L'IA n'a pas pu générer de suggestions. La partie de contenu était vide ou mal formée. Réessayez.");
      }
    } else {
      console.error("La structure de la réponse de l'IA est inattendue ou vide:", data);
      throw new Error("L'IA n'a pas pu générer de suggestions. La réponse était vide ou mal formée. Réessayez.");
    }

  } catch (error) {
    console.error('❌ Erreur lors de la génération de la réponse IA:', error);
    throw error; // Propager l'erreur pour que content.js l'affiche
  }
}
