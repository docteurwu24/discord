document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const profileSelect = document.getElementById('profileSelect');
    // Les boutons 'Charger' et 'Supprimer' sont maintenant plus contextuels
    const deleteProfileBtn = document.getElementById('deleteProfileBtn');
    const profileNameInput = document.getElementById('profileName');
    const toneSelect = document.getElementById('tone');
    const responseLengthSelect = document.getElementById('responseLength');
    const expressionsTextarea = document.getElementById('expressions');
    const expertiseInput = document.getElementById('expertise');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const resetSettingsBtn = document.getElementById('resetSettings');
    const statusMessageDiv = document.getElementById('status');
    const newProfileOptionValue = "";

    let userProfiles = {};
    let activeProfileId = null;

    function showStatus(message, type) {
        statusMessageDiv.textContent = message;
        statusMessageDiv.className = `status ${type}`;
        statusMessageDiv.style.display = 'block';
        setTimeout(() => { statusMessageDiv.style.display = 'none'; }, 3000);
    }

    function loadProfilesIntoSelector() {
        const currentSelection = profileSelect.value;
        profileSelect.innerHTML = `<option value="${newProfileOptionValue}">-- Nouveau Profil --</option>`;
        Object.keys(userProfiles).forEach(id => {
            const profile = userProfiles[id];
            const option = document.createElement('option');
            option.value = id;
            option.textContent = profile.name;
            profileSelect.appendChild(option);
        });
        
        // Essayer de re-sélectionner le profil actif ou celui qui était sélectionné
        const finalSelection = activeProfileId || currentSelection;
        if (finalSelection && userProfiles[finalSelection]) {
            profileSelect.value = finalSelection;
        }
        
        updateUIForSelection();
    }

    function loadProfileToForm(profileId) {
        if (profileId && userProfiles[profileId]) {
            const profile = userProfiles[profileId];
            profileNameInput.value = profile.name || '';
            toneSelect.value = profile.tone || 'casual';
            responseLengthSelect.value = profile.responseLength || 'medium';
            expressionsTextarea.value = profile.expressions?.join(', ') || '';
            expertiseInput.value = profile.expertise?.join(', ') || '';
        } else {
            resetProfileFields();
        }
    }

    function resetProfileFields() {
        profileNameInput.value = '';
        toneSelect.value = 'casual';
        responseLengthSelect.value = 'medium';
        expressionsTextarea.value = '';
        expertiseInput.value = '';
        profileSelect.value = newProfileOptionValue;
        updateUIForSelection();
    }
    
    function updateUIForSelection() {
        const selectedId = profileSelect.value;
        deleteProfileBtn.style.display = selectedId !== newProfileOptionValue ? 'inline-block' : 'none';
        saveProfileBtn.textContent = selectedId !== newProfileOptionValue ? '💾 Mettre à jour le profil' : '💾 Sauvegarder comme nouveau profil';
    }

    // Charger tous les paramètres
    chrome.storage.local.get(['apiKey', 'userProfiles', 'activeProfileId'], (result) => {
        apiKeyInput.value = result.apiKey || '';
        userProfiles = result.userProfiles || {};
        activeProfileId = result.activeProfileId || null;
        loadProfilesIntoSelector();
    });

    // Fonction pour sauvegarder la clé API
    function saveApiKey(key) {
        chrome.storage.local.set({ apiKey: key }, () => {
            console.log('Clé API sauvegardée:', key);
            showStatus('Clé API sauvegardée !', 'success');
        });
    }

    // Événement pour sauvegarder la clé API dès qu'elle est modifiée
    apiKeyInput.addEventListener('input', (event) => {
        saveApiKey(event.target.value.trim());
    });

    // Événement pour sauvegarder le Profil
    saveProfileBtn.addEventListener('click', () => {
        const profileName = profileNameInput.value.trim();
        if (!profileName) {
            showStatus('Le nom du profil est obligatoire.', 'error');
            return;
        }

        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
             showStatus('La clé API est obligatoire pour utiliser l\'assistant.', 'error');
            return;
        }
        
        // Sauvegarder la clé API aussi lors de la sauvegarde du profil
        saveApiKey(apiKey);

        const profileId = profileSelect.value || Date.now().toString();
        
        userProfiles[profileId] = {
            id: profileId,
            name: profileName,
            tone: toneSelect.value,
            responseLength: responseLengthSelect.value,
            expressions: expressionsTextarea.value.split(',').map(e => e.trim()).filter(Boolean),
            expertise: expertiseInput.value.split(',').map(e => e.trim()).filter(Boolean)
        };
        
        activeProfileId = profileId; // Le profil sauvegardé/mis à jour devient l'actif

        chrome.storage.local.set({ userProfiles, activeProfileId }, () => {
            loadProfilesIntoSelector();
            showStatus(`Profil "${profileName}" sauvegardé et activé !`, 'success');
        });
    });

    // Événement pour supprimer un profil
    deleteProfileBtn.addEventListener('click', () => {
        const selectedProfileId = profileSelect.value;
        if (selectedProfileId && userProfiles[selectedProfileId]) {
            const profileName = userProfiles[selectedProfileId].name;
            if (!confirm(`Êtes-vous sûr de vouloir supprimer le profil "${profileName}" ?`)) return;

            delete userProfiles[selectedProfileId];
            
            const newSettings = { userProfiles };
            if (activeProfileId === selectedProfileId) {
                activeProfileId = null; // Désactiver si le profil supprimé était l'actif
                newSettings.activeProfileId = null;
            }
            
            chrome.storage.local.set(newSettings, () => {
                resetProfileFields();
                loadProfilesIntoSelector();
                showStatus(`Profil "${profileName}" supprimé.`, 'success');
            });
        }
    });

    resetSettingsBtn.addEventListener('click', () => {
        if (!confirm('Attention, cela supprimera votre clé API et tous vos profils. Continuer ?')) return;
        chrome.storage.local.clear(() => {
            apiKeyInput.value = '';
            userProfiles = {};
            activeProfileId = null;
            resetProfileFields();
            loadProfilesIntoSelector();
            showStatus('Tous les paramètres ont été réinitialisés.', 'success');
        });
    });

    // Mettre à jour le formulaire quand on change la sélection
    profileSelect.addEventListener('change', () => {
        const selectedId = profileSelect.value;
        loadProfileToForm(selectedId);
        updateUIForSelection();
        
        // Rendre le profil sélectionné actif immédiatement
        if (selectedId !== newProfileOptionValue) {
            activeProfileId = selectedId;
            chrome.storage.local.set({ activeProfileId: selectedId }, () => {
               showStatus(`Profil "${userProfiles[selectedId].name}" activé.`, 'success');
            });
        }
    });
});
