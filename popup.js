document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const apiWarningDiv = document.getElementById('api-warning');
    const apiSuccessDiv = document.getElementById('api-success');

    const currentPersonaDisplay = document.getElementById('current-persona');
    const currentPersonaEmoji = currentPersonaDisplay.querySelector('.emoji');
    const currentPersonaName = currentPersonaDisplay.querySelector('.name');
    const currentPersonaPrompt = currentPersonaDisplay.querySelector('.persona-prompt');

    const personaSelect = document.getElementById('persona-select');
    const loadPersonaBtn = document.getElementById('load-persona');
    const newPersonaBtn = document.getElementById('new-persona');
    const savePersonaBtn = document.getElementById('save-persona');
    const deletePersonaBtn = document.getElementById('delete-persona');
    const quickSwitchBtn = document.getElementById('quick-switch');
    const editPersonaBtn = document.getElementById('edit-persona');

    const personaNameInput = document.getElementById('persona-name');
    const personaPromptTextarea = document.getElementById('persona-prompt');
    const promptCounterSpan = document.getElementById('prompt-counter');

    const totalRequestsSpan = document.getElementById('total-requests');
    const tokensUsedSpan = document.getElementById('tokens-used'); // Ce n'est pas géré par background.js, je vais le laisser à 0 ou le supprimer.
    const resetStatsBtn = document.getElementById('reset-stats');

    const statusMessageDiv = document.getElementById('status');
    const newPersonaOptionValue = "";

    let allPersonas = {};
    let activePersonaId = null;
    let extensionSettings = {};

    function showStatus(message, type) {
        statusMessageDiv.textContent = message;
        statusMessageDiv.className = `status ${type}`;
        statusMessageDiv.style.display = 'block';
        setTimeout(() => { statusMessageDiv.style.display = 'none'; }, 3000);
    }

    // Fonction utilitaire pour envoyer des messages au service worker
    async function sendMessageToBackground(action, data = {}) {
        try {
            const response = await chrome.runtime.sendMessage({ action, data });
            if (!response.success) {
                throw new Error(response.error || `Erreur inconnue lors de l'action ${action}`);
            }
            return response.data;
        } catch (error) {
            console.error(`Erreur lors de l'envoi du message ${action}:`, error);
            showStatus(`Erreur: ${error.message}`, 'error');
            throw error;
        }
    }

    // --- Gestion de la clé API ---
    async function loadApiKey() {
        const result = await sendMessageToBackground('getSettings', { keys: ['apiKey'] });
        const apiKey = result.apiKey || '';
        apiKeyInput.value = apiKey;
        updateApiStatus(apiKey);
    }

    function updateApiStatus(apiKey) {
        if (apiKey && apiKey.trim() !== '') {
            apiWarningDiv.style.display = 'none';
            apiSuccessDiv.style.display = 'block';
        } else {
            apiWarningDiv.style.display = 'block';
            apiSuccessDiv.style.display = 'none';
        }
    }

    apiKeyInput.addEventListener('input', async (event) => {
        const newKey = event.target.value.trim();
        try {
            await sendMessageToBackground('saveSettings', { apiKey: newKey });
            updateApiStatus(newKey);
            showStatus('Clé API sauvegardée !', 'success');
        } catch (error) {
            // showStatus is already called by sendMessageToBackground in case of error
            // but we might want to update the UI differently or log specifically here if needed.
            // For now, relying on sendMessageToBackground's error handling is fine.
            updateApiStatus(newKey); // Update status even if save failed to reflect input
            console.error("Erreur spécifique lors de la sauvegarde de la clé API depuis l'input:", error);
        }
    });

    // --- Gestion des Personas ---
    async function loadPersonas() {
        const result = await sendMessageToBackground('getSettings', { keys: ['personas', 'activePersonaId'] });
        allPersonas = result.personas || {};
        activePersonaId = result.activePersonaId || null;
        
        populatePersonaSelector();
        updateCurrentPersonaDisplay();
        loadPersonaToForm(activePersonaId); // Charger le persona actif dans le formulaire d'édition
    }

    function populatePersonaSelector() {
        const currentSelection = personaSelect.value;
        personaSelect.innerHTML = `<option value="${newPersonaOptionValue}">-- Nouveau Persona --</option>`;
        Object.keys(allPersonas).forEach(id => {
            const persona = allPersonas[id];
            const option = document.createElement('option');
            option.value = id;
            option.textContent = persona.name;
            personaSelect.appendChild(option);
        });
        
        // Tenter de re-sélectionner le persona actif ou celui qui était sélectionné
        const finalSelection = activePersonaId || currentSelection;
        if (finalSelection && allPersonas[finalSelection]) {
            personaSelect.value = finalSelection;
        } else {
            personaSelect.value = newPersonaOptionValue;
        }
        updateUIForPersonaSelection();
    }

    function updateCurrentPersonaDisplay() {
        if (activePersonaId && allPersonas[activePersonaId]) {
            const persona = allPersonas[activePersonaId];
            currentPersonaEmoji.textContent = persona.name.split(' ')[0] || '🤖'; // Extraire l'emoji si présent
            currentPersonaName.textContent = persona.name;
            currentPersonaPrompt.textContent = persona.prompt;
        } else {
            currentPersonaEmoji.textContent = '❓';
            currentPersonaName.textContent = 'Aucun Persona Actif';
            currentPersonaPrompt.textContent = 'Veuillez créer ou sélectionner un persona.';
        }
    }

    function loadPersonaToForm(personaId) {
        if (personaId && allPersonas[personaId]) {
            const persona = allPersonas[personaId];
            personaNameInput.value = persona.name || '';
            personaPromptTextarea.value = persona.prompt || '';
        } else {
            resetPersonaFields();
        }
        updatePromptCounter();
    }

    function resetPersonaFields() {
        personaNameInput.value = '';
        personaPromptTextarea.value = '';
        personaSelect.value = newPersonaOptionValue;
        updateUIForPersonaSelection();
        updatePromptCounter();
    }
    
    function updateUIForPersonaSelection() {
        const selectedId = personaSelect.value;
        deletePersonaBtn.style.display = selectedId !== newPersonaOptionValue ? 'inline-block' : 'none';
        savePersonaBtn.textContent = selectedId !== newPersonaOptionValue ? '💾 Mettre à jour le persona' : '💾 Sauvegarder comme nouveau persona';
        loadPersonaBtn.style.display = selectedId !== newPersonaOptionValue ? 'inline-block' : 'none';
    }

    function updatePromptCounter() {
        const currentLength = personaPromptTextarea.value.length;
        promptCounterSpan.textContent = currentLength;
    }

    personaPromptTextarea.addEventListener('input', updatePromptCounter);

    // Événements des boutons de gestion des personas
    savePersonaBtn.addEventListener('click', async () => {
        const personaName = personaNameInput.value.trim();
        const personaPrompt = personaPromptTextarea.value.trim();

        if (!personaName) {
            showStatus('Le nom du persona est obligatoire.', 'error');
            return;
        }
        if (!personaPrompt) {
            showStatus('Le prompt du persona est obligatoire.', 'error');
            return;
        }

        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showStatus('La clé API est obligatoire pour utiliser l\'assistant.', 'error');
            return;
        }
        
        const personaId = personaSelect.value === newPersonaOptionValue ? null : personaSelect.value; // null pour nouveau persona
        
        try {
            const savedPersona = await sendMessageToBackground('savePersona', { 
                id: personaId,
                name: personaName,
                prompt: personaPrompt
            });
            
            // Mettre à jour l'ID actif si c'est un nouveau persona ou si on met à jour l'actif
            if (!personaId || savedPersona.id === activePersonaId) {
                activePersonaId = savedPersona.id;
            }
            
            await loadPersonas(); // Recharger toutes les personas et mettre à jour l'affichage
            personaSelect.value = savedPersona.id; // Sélectionner le persona sauvegardé
            updateUIForPersonaSelection();
            updateCurrentPersonaDisplay();
            showStatus(`Persona "${savedPersona.name}" sauvegardé et activé !`, 'success');
        } catch (error) {
            // showStatus est déjà appelé par sendMessageToBackground
        }
    });

    deletePersonaBtn.addEventListener('click', async () => {
        const selectedPersonaId = personaSelect.value;
        if (selectedPersonaId && allPersonas[selectedPersonaId]) {
            const personaName = allPersonas[selectedPersonaId].name;
            if (!confirm(`Êtes-vous sûr de vouloir supprimer le persona "${personaName}" ?`)) return;

            try {
                const result = await sendMessageToBackground('deletePersona', { personaId: selectedPersonaId });
                activePersonaId = result.newActive; // Mettre à jour le persona actif après suppression
                await loadPersonas();
                resetPersonaFields();
                showStatus(`Persona "${result.deletedName}" supprimé.`, 'success');
            } catch (error) {
                // showStatus est déjà appelé par sendMessageToBackground
            }
        }
    });

    newPersonaBtn.addEventListener('click', () => {
        resetPersonaFields();
        showStatus('Nouveau persona prêt à être créé.', 'info');
    });

    loadPersonaBtn.addEventListener('click', async () => {
        const selectedPersonaId = personaSelect.value;
        if (selectedPersonaId && selectedPersonaId !== newPersonaOptionValue) {
            try {
                const persona = await sendMessageToBackground('setActivePersona', { personaId: selectedPersonaId });
                activePersonaId = persona.id;
                updateCurrentPersonaDisplay();
                showStatus(`Persona "${persona.name}" activé.`, 'success');
            } catch (error) {
                // showStatus est déjà appelé par sendMessageToBackground
            }
        } else {
            showStatus('Veuillez sélectionner un persona à charger.', 'info');
        }
    });

    quickSwitchBtn.addEventListener('click', async () => {
        // Logique pour basculer rapidement entre les personas
        // Pour l'instant, cela pourrait ouvrir le sélecteur ou une modale de sélection rapide
        // Pour simplifier, je vais juste basculer vers le prochain persona disponible
        const personaIds = Object.keys(allPersonas);
        if (personaIds.length === 0) {
            showStatus('Aucun persona à basculer.', 'info');
            return;
        }
        const currentIndex = personaIds.indexOf(activePersonaId);
        const nextIndex = (currentIndex + 1) % personaIds.length;
        const nextPersonaId = personaIds[nextIndex];

        if (nextPersonaId) {
            try {
                const persona = await sendMessageToBackground('setActivePersona', { personaId: nextPersonaId });
                activePersonaId = persona.id;
                updateCurrentPersonaDisplay();
                populatePersonaSelector(); // Mettre à jour le sélecteur pour refléter le changement
                showStatus(`Persona basculé vers "${persona.name}".`, 'success');
            } catch (error) {
                // showStatus est déjà appelé par sendMessageToBackground
            }
        }
    });

    editPersonaBtn.addEventListener('click', () => {
        if (activePersonaId && allPersonas[activePersonaId]) {
            personaSelect.value = activePersonaId;
            loadPersonaToForm(activePersonaId);
            updateUIForPersonaSelection();
            showStatus('Persona actif chargé pour modification.', 'info');
        } else {
            showStatus('Aucun persona actif à modifier.', 'info');
        }
    });

    personaSelect.addEventListener('change', () => {
        const selectedId = personaSelect.value;
        loadPersonaToForm(selectedId);
        updateUIForPersonaSelection();
    });

    // --- Gestion des Paramètres et Statistiques ---
    async function loadExtensionSettings() {
        const result = await sendMessageToBackground('getSettings', { keys: ['extensionSettings', 'usageStats'] });
        extensionSettings = result.extensionSettings || {};
        const usageStats = result.usageStats || {};

        // Afficher les statistiques
        totalRequestsSpan.textContent = extensionSettings.totalGenerations || 0;
        tokensUsedSpan.textContent = 'N/A'; // Pas de suivi des tokens pour l'instant
    }

    resetStatsBtn.addEventListener('click', async () => {
        if (!confirm('Êtes-vous sûr de vouloir réinitialiser toutes les statistiques d\'utilisation ?')) return;
        try {
            await sendMessageToBackground('saveSettings', { usageStats: {}, extensionSettings: { ...extensionSettings, totalGenerations: 0 } });
            await loadExtensionSettings();
            showStatus('Statistiques réinitialisées.', 'success');
        } catch (error) {
            // showStatus est déjà appelé par sendMessageToBackground
        }
    });

    // --- Initialisation ---
    async function initializePopup() {
        await loadApiKey();
        await loadPersonas();
        await loadExtensionSettings();
    }

    initializePopup();
});
