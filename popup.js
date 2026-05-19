let currentMarkdown = '';
let currentSite = null;

// Default configuration
const defaultConfig = {
  username: 'Utilisateur',
  includeSources: false,
  includeThoughtProcess: false
};

document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  const extractBtn = document.getElementById('extractBtn');
  const copyBtn = document.getElementById('copyBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const preview = document.getElementById('preview');
  const errorDiv = document.getElementById('error');
  const usernameInput = document.getElementById('username');
  const includeSourcesCheckbox = document.getElementById('includeSources');
  const includeThoughtProcessCheckbox = document.getElementById('includeThoughtProcess');
  const sourcesOptionDiv = document.getElementById('sourcesOption');
  const thoughtProcessOptionDiv = document.getElementById('thoughtProcessOption');
  const siteInstructionsDiv = document.getElementById('siteInstructions');

  let currentCapabilities = {};

  // Load saved configuration
  try {
    const result = await chrome.storage.sync.get(['username', 'includeSources', 'includeThoughtProcess']);
    if (result.username) usernameInput.value = result.username;
    if (result.includeSources !== undefined) includeSourcesCheckbox.checked = result.includeSources;
    if (result.includeThoughtProcess !== undefined) includeThoughtProcessCheckbox.checked = result.includeThoughtProcess;
  } catch (err) {
    console.log('No saved config, using defaults');
  }

  // Save configuration on change
  const saveConfig = async () => {
    await chrome.storage.sync.set({
      username: usernameInput.value || defaultConfig.username,
      includeSources: includeSourcesCheckbox.checked,
      includeThoughtProcess: includeThoughtProcessCheckbox.checked
    });
  };

  usernameInput.addEventListener('change', saveConfig);
  includeSourcesCheckbox.addEventListener('change', saveConfig);
  includeThoughtProcessCheckbox.addEventListener('change', saveConfig);

  // Vérifier le site actuel
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  try {
    console.log('[Popup] Sending detect message to tab:', tab.id, 'URL:', tab.url);
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'detect' });
    console.log('[Popup] Received response:', response);
    
    if (response.supported) {
      currentSite = response.site;
      currentCapabilities = response.capabilities || {};
      statusDiv.textContent = `Site supporté: ${response.site}`;
      statusDiv.className = 'supported';
      extractBtn.disabled = false;

      // Show/hide options based on site capabilities
      if (currentCapabilities.sources) {
        sourcesOptionDiv.style.display = 'flex';
      } else {
        sourcesOptionDiv.style.display = 'none';
        includeSourcesCheckbox.checked = false;
      }

      if (currentCapabilities.thoughtProcess) {
        thoughtProcessOptionDiv.style.display = 'flex';
      } else {
        thoughtProcessOptionDiv.style.display = 'none';
        includeThoughtProcessCheckbox.checked = false;
      }

      // Show instructions if required
      if (currentCapabilities.sidebarInstructions) {
        siteInstructionsDiv.textContent = `ℹ️ ${currentCapabilities.sidebarInstructions}`;
        siteInstructionsDiv.style.display = 'block';
      } else {
        siteInstructionsDiv.style.display = 'none';
      }
    } else {
      statusDiv.textContent = 'Site non supporté';
      statusDiv.className = 'unsupported';
      extractBtn.disabled = true;
      sourcesOptionDiv.style.display = 'none';
      thoughtProcessOptionDiv.style.display = 'none';
      siteInstructionsDiv.style.display = 'none';
    }
  } catch (err) {
    console.error('[Popup] Error communicating with page:', err);
    statusDiv.innerHTML = `Impossible de communiquer avec la page<br><small>${err.message}</small>`;
    statusDiv.className = 'unsupported';
    extractBtn.disabled = true;
  }

  // Extraire la conversation
  extractBtn.addEventListener('click', async () => {
    try {
      errorDiv.textContent = '';
      
      // Get current configuration
      const config = {
        username: usernameInput.value || defaultConfig.username,
        includeSources: includeSourcesCheckbox.checked,
        includeThoughtProcess: includeThoughtProcessCheckbox.checked
      };
      
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'extract',
        config: config
      });
      
      if (response.error) {
        errorDiv.textContent = response.error;
        return;
      }

      currentMarkdown = response.markdown;
      
      // Afficher les boutons d'action
      copyBtn.style.display = 'block';
      downloadBtn.style.display = 'block';
      
      // Afficher l'aperçu
      preview.style.display = 'block';
      preview.textContent = currentMarkdown.substring(0, 500) + 
        (currentMarkdown.length > 500 ? '\n\n...' : '');
      
      // Sauvegarder automatiquement la conversation
      await chrome.storage.local.set({
        lastConversation: {
          markdown: currentMarkdown,
          site: currentSite,
          date: new Date().toISOString()
        }
      });
      
    } catch (err) {
      errorDiv.textContent = 'Erreur lors de l\'extraction: ' + err.message;
    }
  });

  // Copier dans le presse-papiers
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(currentMarkdown);
      copyBtn.textContent = 'Copié!';
      setTimeout(() => copyBtn.textContent = 'Copier le Markdown', 2000);
    } catch (err) {
      errorDiv.textContent = 'Erreur lors de la copie';
    }
  });

  // Télécharger le fichier
  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([currentMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${currentSite || 'unknown'}-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    
    downloadBtn.textContent = 'Téléchargé!';
    setTimeout(() => downloadBtn.textContent = 'Télécharger .md', 2000);
  });
});
