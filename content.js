class DiscordAIAssistant {
  constructor() {
    this.isActive = false;
    this.currentChannel = null;
    this.conversationHistory = [];
    this.init();
  }

  init() {
    this.waitForDiscord().then(() => {
      this.setupUI();
      this.startMonitoring();
    }).catch(console.error);
  }

  async waitForDiscord() {
    return new Promise((resolve) => {
      const check = () => {
        if (document.querySelector('[data-list-id="chat-messages"]') || 
            document.querySelector('.chatContent-a9vAAp')) {
          resolve();
        } else {
          setTimeout(check, 1000);
        }
      };
      check();
    });
  }

  setupUI() {
    this.createAIButton();
    this.createSuggestionPanel();
  }

  createAIButton() {
    const button = document.createElement('button');
    button.className = 'ai-assistant-btn';
    button.innerHTML = '🤖';
    button.title = 'Assistant IA';
    button.addEventListener('click', () => this.toggleAssistant());
    document.body.appendChild(button);
    this.aiButton = button;
  }

  createSuggestionPanel() {
    const panel = document.createElement('div');
    panel.id = 'ai-suggestion-panel';
    panel.style.cssText = `
      position: fixed; top: 80px; right: 20px; width: 350px;
      background: #2f3136; border-radius: 8px; padding: 16px;
      z-index: 10001; display: none; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <h3 style="margin: 0; color: #5865f2;">🤖 Assistant IA</h3>
        <button id="close-panel" style="background: none; border: none; color: #dcddde; cursor: pointer;">×</button>
      </div>
      <div id="conversation-context" style="margin-bottom: 12px;">
        <strong>Contexte:</strong>
        <div id="context-content">Aucune conversation</div>
      </div>
      <div id="suggestions-list"></div>
      <button id="generate-suggestions" style="
        background: #5865f2; color: white; border: none; padding: 8px;
        border-radius: 4px; cursor: pointer; width: 100%; margin-top: 12px;
      ">✨ Générer des suggestions</button>
    `;
    document.body.appendChild(panel);
    panel.querySelector('#close-panel').addEventListener('click', () => this.toggleAssistant());
    panel.querySelector('#generate-suggestions').addEventListener('click', () => this.generateSuggestions());
    this.suggestionPanel = panel;
  }

  startMonitoring() {
    setInterval(() => this.detectChannelChange(), 2000);
    const observeMessages = () => {
      const chatContainer = document.querySelector('[data-list-id="chat-messages"]') || document.querySelector('.chatContent-a9vAAp');
      if (chatContainer) {
        const observer = new MutationObserver(() => {
          this.updateConversationContext();
        });
        observer.observe(chatContainer, { childList: true, subtree: true });
      } else {
        setTimeout(observeMessages, 1000);
      }
    };
    observeMessages();
  }

  toggleAssistant() {
    this.isActive = !this.isActive;
    this.aiButton.classList.toggle('active', this.isActive);
    this.suggestionPanel.style.display = this.isActive ? 'block' : 'none';
    if (this.isActive) this.updateConversationContext();
  }

  detectChannelChange() {
    const url = window.location.href;
    if (url !== this.currentChannel) {
      this.currentChannel = url;
      this.conversationHistory = [];
    }
  }

  updateConversationContext() {
    if (!this.isActive) return;
    const messages = this.extractMessages();
    if (JSON.stringify(messages) === JSON.stringify(this.conversationHistory)) return;
    
    this.conversationHistory = messages;
    const contextEl = document.getElementById('context-content');
    if (contextEl) {
      contextEl.innerHTML = messages.slice(-5)
        .map(m => `<div><strong>${m.author}:</strong> ${m.content.substring(0, 100)}</div>`)
        .join('');
    }
  }

  extractMessages() {
    const messages = [];
    const messageSelectors = [
      '[data-list-id="chat-messages"] [id^="chat-messages-"]',
      '.chatContent-a9vAAp .messageListItem-1-HFuB',
      '.scroller-2FKFPG .messageListItem-1-HFuB',
      '.contents_c19a55' // Ajout du sélecteur fourni par l'utilisateur
    ];
    
    let messageElements = [];
    for (const selector of messageSelectors) {
      messageElements = document.querySelectorAll(selector);
      if (messageElements.length > 0) break;
    }
    
    messageElements.forEach(msgEl => {
      try {
        const author = msgEl.querySelector('[class*="author"]')?.textContent?.trim() || msgEl.querySelector('.username_c19a55')?.textContent?.trim();
        const content = msgEl.querySelector('[class*="messageContent"]')?.textContent?.trim() || msgEl.querySelector('.markup__75297.messageContent_c19a55')?.textContent?.trim();
        
        if (author && content) {
          messages.push({ author, content });
        }
      } catch (e) {}
    });
    return messages.slice(-20);
  }

  async generateSuggestions() {
    const btn = document.getElementById('generate-suggestions');
    const list = document.getElementById('suggestions-list');
    
    btn.disabled = true;
    btn.textContent = '⏳ Génération...';
    list.innerHTML = '';

    try {
      console.log('content.js: Envoi du message "generateResponse" au service worker.', { messages: this.conversationHistory });
      const response = await chrome.runtime.sendMessage({
        action: 'generateResponse',
        data: { messages: this.conversationHistory }
      });

      if (response.success) {
        list.innerHTML = response.data.map(text => `
          <div class="suggestion-item" onclick="navigator.clipboard.writeText(this.textContent)">
            ${text}
          </div>
        `).join('');
      } else {
        list.innerHTML = `<div class="error-message">${response.error}</div>`;
      }
    } catch (error) {
      let errorMessage = `Erreur: ${error.message}`;
      if (error.message.includes('Extension context invalidated')) {
        errorMessage = `L'assistant a été déchargé. Veuillez recharger la page Discord (Ctrl+R ou Cmd+R) pour réactiver l'assistant.`;
      }
      list.innerHTML = `<div class="error-message">${errorMessage}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ Générer des suggestions';
    }
  }
}

if (window.location.hostname.includes('discord.com')) {
  new DiscordAIAssistant();
}
