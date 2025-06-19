document.addEventListener('DOMContentLoaded', async () => {
    // Éléments UI
    const apiKeyInput = document.getElementById('apiKey');
    const apiWarningDiv = document.getElementById('api-warning');
    const apiSuccessDiv = document.getElementById('api-success');
    const personaSelect = document.getElementById('persona-select');
    const personaNameInput = document.getElementById('persona-name');
    const personaPromptTextarea = document.getElementById('persona-prompt');
    const currentPersonaDisplay = document.getElementById('current-persona');
    const savePersonaBtn = document.getElementById('save-persona');
    const loadPersonaBtn = document.getElementById('load-persona');
    const deletePersonaBtn = document.getElementById('delete-persona');
    const newPersonaBtn = document.getElementById('new-persona');
  
    // Fonctions utilitaires
    function showStatus(message, type) {
      const statusEl = document.getElementById('status');
      statusEl.textContent = message;
      statusEl.className = `status ${type}`;
      statusEl.style.display = 'block';
      setTimeout(() => statusEl.style.display = 'none', 3000);
    }
  
    async function sendMessage(action, data) {
      try {
        const response = await chrome.runtime.sendMessage({ action, data });
        if (!response.success) throw new Error(response.error);
        return response.data;
      } catch (error) {
        showStatus(error.message, 'error');
        throw error;
      }
    }
  
    // Gestion API
    async function loadApiKey() {
      try {
        const { apiKey } = await sendMessage('getSettings', { keys: ['apiKey'] });
        apiKeyInput.value = apiKey || '';
        updateApiStatus(apiKey);
      } catch (error) {
        updateApiStatus('');
      }
    }
  
    function updateApiStatus(apiKey) {
      const isValid = apiKey && apiKey.trim() !== '';
      apiWarningDiv.style.display = isValid ? 'none' : 'block';
      apiSuccessDiv.style.display = isValid ? 'block' : 'none';
    }
  
    apiKeyInput.addEventListener('blur', async () => {
      try {
        await sendMessage('saveSettings', { apiKey: apiKeyInput.value.trim() });
        updateApiStatus(apiKeyInput.value.trim());
        showStatus('Clé API sauvegardée', 'success');
      } catch (error) {
        updateApiStatus(apiKeyInput.value.trim());
      }
    });
  
    // Gestion Personas
    async function loadPersonas() {
      const { personas, activePersonaId } = await sendMessage('getSettings', {
        keys: ['personas', 'activePersonaId']
      });
  
      // Mise à jour du selecteur
      personaSelect.innerHTML = '<option value="">-- Nouveau --</option>';
      Object.values(personas || {}).forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        personaSelect.appendChild(option);
      });
  
      // Mise à jour affichage persona actif
      if (activePersonaId && personas?.[activePersonaId]) {
        const p = personas[activePersonaId];
        currentPersonaDisplay.innerHTML = `
          <div class="persona-info">
            <div class="emoji">${p.emoji || '🤖'}</div>
            <div class="name">${p.name}</div>
          </div>
          <div class="persona-prompt">${p.prompt.substring(0, 60)}...</div>
        `;
        // Charger les détails du persona actif dans les champs de saisie
        personaSelect.value = p.id;
        personaNameInput.value = p.name;
        personaPromptTextarea.value = p.prompt;
      } else {
        currentPersonaDisplay.innerHTML = `
          <div class="persona-info">
            <div class="emoji">🤖</div>
            <div class="name">Aucun persona sélectionné</div>
          </div>
        `;
        personaSelect.value = '';
        personaNameInput.value = '';
        personaPromptTextarea.value = '';
      }
      // Activer/désactiver le bouton Supprimer
      deletePersonaBtn.disabled = !personaSelect.value;
    }
  
    // Événements
    savePersonaBtn.addEventListener('click', async () => {
      try {
        const persona = await sendMessage('savePersona', {
          id: personaSelect.value || undefined,
          name: personaNameInput.value.trim(),
          prompt: personaPromptTextarea.value.trim()
        });
        showStatus(`Persona "${persona.name}" sauvegardé`, 'success');
        await loadPersonas();
      } catch (error) {}
    });
  
    loadPersonaBtn.addEventListener('click', async () => {
      if (!personaSelect.value) return;
      try {
        const persona = await sendMessage('setActivePersona', {
          personaId: personaSelect.value
        });
        showStatus(`Persona "${persona.name}" chargé`, 'success');
        await loadPersonas();
      } catch (error) {}
    });
  
    deletePersonaBtn.addEventListener('click', async () => {
      if (!personaSelect.value) return;
      if (!confirm('Êtes-vous sûr de vouloir supprimer ce persona ?')) return;
      try {
        const { deletedName } = await sendMessage('deletePersona', personaSelect.value);
        showStatus(`Persona "${deletedName}" supprimé`, 'success');
        await loadPersonas();
      } catch (error) {}
    });
  
    newPersonaBtn.addEventListener('click', () => {
      personaSelect.value = '';
      personaNameInput.value = '';
      personaPromptTextarea.value = '';
      deletePersonaBtn.disabled = true;
      showStatus('Nouveau persona prêt à être créé', 'info');
    });
  
    personaSelect.addEventListener('change', async () => {
      const selectedPersonaId = personaSelect.value;
      if (selectedPersonaId) {
        const { personas } = await sendMessage('getSettings', { keys: ['personas'] });
        const selectedPersona = personas[selectedPersonaId];
        if (selectedPersona) {
          personaNameInput.value = selectedPersona.name;
          personaPromptTextarea.value = selectedPersona.prompt;
        }
      } else {
        personaNameInput.value = '';
        personaPromptTextarea.value = '';
      }
      deletePersonaBtn.disabled = !selectedPersonaId;
    });
  
    document.getElementById('open-logs-btn').addEventListener('click', () => {
      sendMessage('openLogs').catch(() => {});
    });
  
    // Initialisation
    await loadApiKey();
    await loadPersonas();
  });
