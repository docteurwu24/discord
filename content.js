// content.js - Script principal de l'extension
class DiscordAIAssistant {
  constructor() {
    this.isActive = false;
    this.currentChannel = null;
    this.conversationHistory = [];
    // L'état du profil actif sera géré par background.js
    
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
    // Le code de cette fonction est bon, pas de changement nécessaire.
    // Pour la concision, je ne le recopie pas ici. Collez votre fonction existante.
    const style = document.createElement('style');
    style.textContent = `
      .ai-assistant-btn {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #5865f2, #3b82f6);
        border: none;
        border-radius: 50%;
        cursor: pointer;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(88, 101, 242, 0.3);
        transition: all 0.3s ease;
        font-size: 18px;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .ai-assistant-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(88, 101, 242, 0.4);
      }
      
      .ai-assistant-btn.active {
        background: linear-gradient(135deg, #00d4aa, #01a3ff);
      }
    `;
    document.head.appendChild(style);

    const button = document.createElement('button');
    button.className = 'ai-assistant-btn';
    button.innerHTML = '🤖';
    button.title = 'Assistant IA Discord';
    
    button.addEventListener('click', () => {
      this.toggleAssistant();
    });
    
    document.body.appendChild(button);
    this.aiButton = button;
  }

  createSuggestionPanel() {
    // Le code de cette fonction est bon, pas de changement nécessaire.
    // Pour la concision, je ne le recopie pas ici. Collez votre fonction existante.
    const panel = document.createElement('div');
    panel.id = 'ai-suggestion-panel';
    panel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      width: 350px;
      max-height: 500px;
      background: #2f3136;
      border: 1px solid #40444b;
      border-radius: 8px;
      padding: 16px;
      z-index: 9999;
      font-family: Whitney, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
      color: #dcddde;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      display: none;
      overflow-y: auto;
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
          background: #5865f2;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          width: 100%;
          font-size: 14px;
        ">✨ Générer des suggestions</button>
      </div>
    `;
    
    document.body.appendChild(panel);
    this.suggestionPanel = panel;
    
    panel.querySelector('#close-panel').addEventListener('click', () => {
      this.toggleAssistant();
    });
    
    panel.querySelector('#generate-suggestions').addEventListener('click', () => {
      this.generateSuggestions();
    });
  }

  startMonitoring() {
    console.log('📊 Démarrage de la surveillance...');
    setInterval(() => {
      this.detectChannelChange();
    }, 2000);

    const observeMessages = () => {
      const chatContainer = document.querySelector('[data-list-id="chat-messages"]') || document.querySelector('.chatContent-a9vAAp');
      if (chatContainer) {
        console.log('🎯 Conteneur de chat trouvé pour observation des messages.');
        const observer = new MutationObserver(() => {
          this.updateConversationContext();
        });
        observer.observe(chatContainer, { childList: true, subtree: true });
        console.log('👀 Observation des messages Discord démarrée.');
      } else {
        console.log('⏳ Conteneur de chat non trouvé, réessai...');
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
    if (JSON.stringify(messages) === JSON.stringify(this.conversationHistory)) {
      return; // Pas de changement, on ne fait rien
    }

    this.conversationHistory = messages;
    console.log(`📝 Contexte mis à jour avec ${messages.length} messages.`);
    
    const contextContainer = document.getElementById('context-content');
    if (contextContainer && messages.length > 0) {
      const recentMessages = messages.slice(-5);
      contextContainer.innerHTML = recentMessages.map(msg => 
        `<div style="margin-bottom: 4px;"><strong>${msg.author}:</strong> ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}</div>`
      ).join('');
    } else if (contextContainer) {
      contextContainer.innerHTML = 'Aucun message détecté. Parlez pour commencer !';
    }
  }

  extractMessages() {
    // Le code de cette fonction est bon, pas de changement nécessaire.
    // Pour la concision, je ne le recopie pas ici. Collez votre fonction existante.
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
        // Utiliser les nouvelles sélecteurs pour l'auteur et le contenu
        const authorEl = msgEl.querySelector('.username_c19a55');
        const contentEl = msgEl.querySelector('.markup__75297.messageContent_c19a55');
        
        if (authorEl && contentEl && contentEl.textContent.trim() !== '') {
          messages.push({
            author: authorEl.textContent.trim(),
            content: contentEl.textContent.trim(),
          });
        }
      } catch (e) {
        // Ignorer les erreurs de parsing d'éléments non-messages
      }
    });
    return messages.slice(-20); // Garder les 20 derniers messages
  }

  async generateSuggestions() {
    console.log('✨ Tentative de génération de suggestions...');
    const generateBtn = document.getElementById('generate-suggestions');
    const suggestionsList = document.getElementById('suggestions-list');
    
    generateBtn.textContent = '⏳ Génération...';
    generateBtn.disabled = true;
    suggestionsList.innerHTML = '';
    
    try {
      console.log('✉️ Envoi de la conversation au service worker...');
      
      // **CHANGEMENT CLÉ** : On n'envoie plus de style. background.js s'en occupe.
      const response = await chrome.runtime.sendMessage({
        action: 'generateResponse',
        data: {
          messages: this.conversationHistory,
        }
      });

      if (response.success) {
        console.log('✅ Suggestions reçues du service worker.');
        const suggestions = response.data;
        suggestionsList.innerHTML = suggestions.map((suggestion, index) => {
          // Échapper les apostrophes et les guillemets pour l'attribut onclick
          const cleanSuggestion = suggestion.replace(/'/g, "\\'").replace(/"/g, '\\"');
          return `
            <div class="suggestion-item" 
                 title="Cliquer pour copier"
                 onclick="navigator.clipboard.writeText('${cleanSuggestion}').then(() => {
                   this.classList.add('copied');
                   setTimeout(() => this.classList.remove('copied'), 1000);
                 })">
              ${suggestion}
            </div>`;
        }).join('');
        this.addSuggestionStyles();
      } else {
        console.error('❌ Erreur renvoyée par le service worker:', response.error);
        suggestionsList.innerHTML = `<div class="error-message">${response.error}</div>`;
      }
      
    } catch (error) {
      console.error('❌ Erreur inattendue lors de la communication:', error);
      let errorMessage = `Erreur: ${error.message}. Vérifiez la console (F12) pour plus de détails.`;
      if (error.message.includes('Extension context invalidated')) {
        errorMessage = `L'assistant a été déchargé. Veuillez recharger la page Discord (Ctrl+R ou Cmd+R) pour réactiver l'assistant.`;
      }
      suggestionsList.innerHTML = `<div class="error-message">${errorMessage}</div>`;
    }
    
    generateBtn.textContent = '✨ Générer des suggestions';
    generateBtn.disabled = false;
  }

  addSuggestionStyles() {
      if (document.getElementById('suggestion-styles')) return;

      const style = document.createElement('style');
      style.id = 'suggestion-styles';
      style.textContent = `
          .suggestion-item {
              background: #40444b;
              padding: 10px;
              margin: 6px 0;
              border-radius: 4px;
              cursor: pointer;
              transition: background 0.2s, transform 0.1s;
              border-left: 3px solid #5865f2;
          }
          .suggestion-item:hover {
              background: #4f545c;
          }
          .suggestion-item:active {
              transform: scale(0.98);
          }
          .suggestion-item.copied {
              background: #43b581;
              border-left-color: #fff;
          }
          .error-message {
              color: #f04747;
              background: rgba(240, 71, 71, 0.1);
              padding: 8px;
              border-radius: 4px;
          }
      `;
      document.head.appendChild(style);
  }

  // Fonctions non utilisées supprimées pour la clarté :
  // - loadUserData, saveUserData, learnUserStyle
}

if (window.location.hostname === 'discord.com') {
new DiscordAIAssistant();
}
