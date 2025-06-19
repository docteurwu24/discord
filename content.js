// content.js - Script principal de l'extension
class DiscordAIAssistant {
  constructor() {
    this.isActive = false;
    this.currentChannel = null;
    this.conversationHistory = [];
    this.init();
  }

  init() {
    console.log('🤖 Discord AI Assistant initialisé (content.js)');
    this.waitForDiscord().then(() => {
      console.log('✅ Discord détecté et chargé.');
      this.setupUI();
      this.startMonitoring();
    }).catch(error => {
      console.error('❌ Erreur lors de l\'attente de Discord:', error);
    });
  }

  async waitForDiscord() {
    console.log('⏳ Attente du chargement de Discord...');
    return new Promise((resolve) => {
      const checkDiscord = () => {
        if (document.querySelector('[data-list-id="chat-messages"]') ||
            document.querySelector('.chatContent-a9vAAp')) {
          console.log('✅ Éléments de chat Discord trouvés.');
          resolve();
        } else {
          console.log('🔍 Éléments de chat Discord non trouvés, réessai dans 1s...');
          setTimeout(checkDiscord, 1000);
        }
      };
      checkDiscord();
    });
  }

  setupUI() {
    console.log('🎨 Configuration de l\'interface utilisateur...');
    this.createAIButton();
    this.createSuggestionPanel();
    console.log('✅ Interface utilisateur configurée.');
  }

  createAIButton() {
    const button = document.createElement('button');
    button.className = 'ai-assistant-btn';
    button.innerHTML = '🤖';
    button.title = 'Assistant IA Discord';
    button.addEventListener('click', () => this.toggleAssistant());
    document.body.appendChild(button);
    this.aiButton = button;
  }

  createSuggestionPanel() {
    const panel = document.createElement('div');
    panel.id = 'ai-suggestion-panel';
    panel.style.cssText = `
      position: fixed; top: 80px; right: 20px; width: 350px; max-height: 500px;
      background: #2f3136; border: 1px solid #40444b; border-radius: 8px;
      padding: 16px; z-index: 9999; font-family: Whitney, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
      color: #dcddde; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); display: none; overflow-y: auto;
    `;
    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0; color: #5865f2; font-size: 16px;">🤖 Assistant IA</h3>
        <button id="close-panel" style="background: none; border: none; color: #dcddde; cursor: pointer; font-size: 18px;">×</button>
      </div>
      <div id="conversation-context" style="background: #36393f; padding: 10px; border-radius: 4px; margin-bottom: 12px; font-size: 12px; max-height: 150px; overflow-y: auto;">
        <strong>Contexte de la conversation :</strong>
        <div id="context-content">Aucune conversation détectée</div>
      </div>
      <div id="suggestions-container">
        <div style="margin-bottom: 8px; font-size: 14px; font-weight: 600;">Suggestions de réponses :</div>
        <div id="suggestions-list"></div>
      </div>
      <div style="margin-top: 12px;">
        <button id="generate-suggestions" style="
          background: #5865f2; color: white; border: none; padding: 8px 16px;
          border-radius: 4px; cursor: pointer; width: 100%; font-size: 14px;
        ">✨ Générer des suggestions</button>
      </div>
    `;
    document.body.appendChild(panel);
    this.suggestionPanel = panel;
    panel.querySelector('#close-panel').addEventListener('click', () => this.toggleAssistant());
    panel.querySelector('#generate-suggestions').addEventListener('click', () => this.generateSuggestions());
  }

  startMonitoring() {
    console.log('📊 Démarrage de la surveillance...');
    setInterval(() => this.detectChannelChange(), 2000);
    const observeMessages = () => {
      const chatContainer = document.querySelector('[data-list-id="chat-messages"]') || document.querySelector('.chatContent-a9vAAp');
      if (chatContainer) {
        const observer = new MutationObserver(() => this.updateConversationContext());
        observer.observe(chatContainer, { childList: true, subtree: true });
        console.log('👀 Observation des messages Discord démarrée.');
      } else {
        setTimeout(observeMessages, 1000);
      }
    };
    observeMessages();
  }

  toggleAssistant() {
    this.isActive = !this.isActive;
    console.log(`💡 Assistant basculé. État actuel: ${this.isActive ? 'ACTIF' : 'INACTIF'}`);
    if (this.isActive) {
      this.aiButton.classList.add('active');
      this.suggestionPanel.style.display = 'block';
      this.updateConversationContext();
    } else {
      this.aiButton.classList.remove('active');
      this.suggestionPanel.style.display = 'none';
    }
  }

  detectChannelChange() {
    const currentUrl = window.location.href;
    if (currentUrl !== this.currentChannel) {
      this.currentChannel = currentUrl;
      this.conversationHistory = [];
      console.log('📱 Changement de channel détecté:', currentUrl);
      this.updateConversationContext();
    }
  }

  updateConversationContext() {
    if (!this.isActive) return;
    const messages = this.extractMessages();
    if (JSON.stringify(messages) === JSON.stringify(this.conversationHistory)) return;
    this.conversationHistory = messages;
    console.log(`📝 Contexte mis à jour avec ${messages.length} messages.`);
    const contextContainer = document.getElementById('context-content');
    if (contextContainer) {
      if (messages.length > 0) {
        const recentMessages = messages.slice(-5);
        contextContainer.innerHTML = recentMessages.map(msg =>
          `<div style="margin-bottom: 4px;"><strong>${msg.author}:</strong> ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}</div>`
        ).join('');
      } else {
        contextContainer.innerHTML = 'Aucun message détecté. Parlez pour commencer !';
      }
    }
  }

  extractMessages() {
    const messages = [];
    const messageSelectors = [
      '[data-list-id="chat-messages"] [id^="chat-messages-"]',
      '.chatContent-a9vAAp .messageListItem-1-HFuB',
      '.scroller-2FKFPG .messageListItem-1-HFuB'
    ];
    let messageElements = [];
    for (const selector of messageSelectors) {
      messageElements = document.querySelectorAll(selector);
      if (messageElements.length > 0) break;
    }
    messageElements.forEach(msgEl => {
      try {
        const authorEl = msgEl.querySelector('.username_c19a55');
        const contentEl = msgEl.querySelector('.markup__75297.messageContent_c19a55');
        if (authorEl && contentEl && contentEl.textContent.trim() !== '') {
          messages.push({
            author: authorEl.textContent.trim(),
            content: contentEl.textContent.trim(),
          });
        }
      } catch (e) {/* Ignore */}
    });
    return messages.slice(-20);
  }

  async generateSuggestions() {
    console.log('✨ Tentative de génération de suggestions...');
    const generateBtn = document.getElementById('generate-suggestions');
    const suggestionsList = document.getElementById('suggestions-list');

    generateBtn.textContent = '⏳ Génération...';
    generateBtn.disabled = true;
    suggestionsList.innerHTML = ''; // Clear previous suggestions/errors

    try {
      console.log('✉️ Envoi de la conversation au service worker...');
      const response = await chrome.runtime.sendMessage({
        action: 'generateResponse',
        data: { messages: this.conversationHistory }
      });

      if (response.success) {
        console.log('✅ Suggestions reçues du service worker.');
        const suggestions = response.data;
        if (suggestions && suggestions.length > 0) {
          suggestionsList.innerHTML = suggestions.map(suggestion => {
            const cleanSuggestion = suggestion.replace(/'/g, "\\'").replace(/"/g, '\\"');
            return `
              <div class="suggestion-item"
                   title="Cliquer pour copier"
                   onclick="navigator.clipboard.writeText('${cleanSuggestion}').then(() => {
                     this.classList.add('copied');
                     setTimeout(() => this.classList.remove('copied'), 1000);
                   }).catch(err => console.error('Erreur de copie: ', err))">
                ${suggestion}
              </div>`;
          }).join('');
        } else {
           suggestionsList.innerHTML = `<div class="error-message">Aucune suggestion n'a pu être générée. Essayez de reformuler.</div>`;
        }
      } else {
        // Handle structured error from background.js
        console.error('❌ Erreur structurée renvoyée par le service worker:', response.error);
        let displayMessage = "Une erreur est survenue lors de la génération.";
        const errorDetails = response.error;

        if (errorDetails && typeof errorDetails === 'object') {
          const errorType = errorDetails.errorType || 'UnknownError';
          const errorMessageText = errorDetails.message || "Pas de message d'erreur spécifique.";

          displayMessage = `Erreur (${errorType}): ${errorMessageText}`; // Default display

          if (errorType.includes('API') || errorMessageText.includes("Clé API invalide") || errorMessageText.includes("Gemini API key")) {
            displayMessage = `Erreur de clé API: ${errorMessageText}. Veuillez vérifier votre clé API dans les options de l'extension.`;
          } else if (errorType === 'ParsingError' || errorMessageText.includes("No valid suggestions") || errorMessageText.includes("malformée")) {
            displayMessage = `Erreur d'analyse de la réponse IA: ${errorMessageText}. Essayez de reformuler ou réessayez.`;
          } else if (errorType === 'SafetyBlock') {
            displayMessage = `Contenu bloqué: ${errorMessageText}. La requête ou la réponse a été bloquée par les filtres de sécurité de l'IA. Veuillez reformuler.`;
          }
          // Add more specific checks if needed based on errorType or message content
        } else if (typeof errorDetails === 'string') {
          // Fallback for simple error strings if background.js didn't send a structured error
          displayMessage = errorDetails;
          if (errorDetails.includes("Clé API invalide") || errorDetails.includes("Gemini API key")) {
            displayMessage = `Erreur de clé API: ${errorDetails}. Veuillez vérifier votre clé API.`;
          }
        }
        suggestionsList.innerHTML = `<div class="error-message">${displayMessage}</div>`;
      }

    } catch (error) {
      // Handles errors in communication with background.js or other unexpected errors in this function
      console.error('❌ Erreur inattendue dans generateSuggestions (content.js):', error);
      let displayMessage = `Erreur: ${error.message || 'Inconnue'}. Vérifiez la console (F12).`;

      if (error.message && error.message.includes('Extension context invalidated')) {
        displayMessage = `L'assistant a été déchargé ou mis à jour. Veuillez recharger la page Discord (Ctrl+R ou Cmd+R) pour réactiver l'assistant.`;
      } else if (error.name === 'TypeError' && error.message.includes('runtime.sendMessage')) {
         displayMessage = `Impossible de communiquer avec le script de fond de l'extension. Essayez de recharger l'extension ou le navigateur.`;
      }
      // No need to check for error.errorType here as this catch block is for content.js errors,
      // not for errors propagated from background.js (those are in the 'else' above).
      suggestionsList.innerHTML = `<div class="error-message">${displayMessage}</div>`;
    }

    generateBtn.textContent = '✨ Générer des suggestions';
    generateBtn.disabled = false;
  }
}

if (window.location.hostname === 'discord.com') {
  new DiscordAIAssistant();
}
