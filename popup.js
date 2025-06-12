/**
 * @typedef {Object} ExtensionSettings
 * @property {boolean} enabled - Whether the extension is enabled
 * @property {number} timeLimit - Inactivity time limit in minutes
 * @property {number} unloadTimeout - Inactivity time limit in minutes
 * @property {string} defaultBehavior - Default behavior for inactive tabs
 * @property {boolean} showNotifications - Whether to show notifications
 * @property {Pattern[]} patterns - URL patterns and their actions
 */

/**
 * Get all patterns from the UI
 * @returns {Array} Array of pattern objects
 */
function getPatterns() {
  const patterns = [];
  document.querySelectorAll('.pattern-entry').forEach(entry => {
    patterns.push({
      pattern: entry.querySelector('.pattern-input').value,
      action: entry.querySelector('.pattern-action').value,
      isPreset: entry.dataset.preset === 'true'
    });
  });
  return patterns;
}

/**
 * Add a new pattern entry to the UI
 * @param {Object} pattern - Pattern object with pattern and action
 */
function addPatternEntry(pattern) {
  const entry = document.createElement('div');
  entry.className = 'pattern-entry';
  if (pattern.isPreset) {
    entry.dataset.preset = 'true';
  }

  const patternInput = document.createElement('input');
  patternInput.type = 'text';
  patternInput.className = 'pattern-input';
  patternInput.value = pattern.pattern;
  patternInput.placeholder = 'Enter URL pattern (e.g., *.example.com/*)';
  patternInput.addEventListener('input', saveSettings);

  const actionSelect = document.createElement('select');
  actionSelect.className = 'pattern-action';
  ['keep', 'close'].forEach(action => {
    const option = document.createElement('option');
    option.value = action;
    option.textContent = action.charAt(0).toUpperCase() + action.slice(1);
    actionSelect.appendChild(option);
  });
  actionSelect.value = pattern.action;
  actionSelect.addEventListener('change', saveSettings);

  const removeButton = document.createElement('button');
  removeButton.className = 'remove-pattern';
  removeButton.textContent = '×';
  if (!pattern.isPreset) {
    removeButton.addEventListener('click', () => {
      entry.remove();
      saveSettings();
    });
  } else {
    removeButton.disabled = true;
    removeButton.title = 'Cannot remove preset patterns';
  }

  entry.appendChild(patternInput);
  entry.appendChild(actionSelect);
  entry.appendChild(removeButton);

  const patternList = document.getElementById('patternList');
  patternList.appendChild(entry);
}

/**
 * Loads and displays recently closed tabs
 */
async function loadHistory() {
  const { closedTabs = [] } = await browser.storage.local.get({ closedTabs: [] });
  const historyContainer = document.getElementById('history');
  historyContainer.innerHTML = '';
  
  const recentTabs = closedTabs.slice(-10).reverse();
  
  if (recentTabs.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No tabs have been closed yet.';
    historyContainer.appendChild(emptyState);
    return;
  }
  
  recentTabs.forEach((tab, index) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const url = document.createElement('div');
    url.className = 'history-url';
    url.textContent = tab.url;
    url.title = tab.url; // Add tooltip for long URLs
    
    const time = document.createElement('div');
    time.className = 'history-time';
    time.textContent = new Date(tab.timestamp).toLocaleString();
    
    const type = document.createElement('div');
    type.className = 'history-type';
    type.textContent = tab.type === 'unloaded' ? 'Unloaded' : 'Closed';
    
    item.appendChild(url);
    item.appendChild(time);
    item.appendChild(type);
    historyContainer.appendChild(item);
    
    // Add staggered animation
    item.style.opacity = '0';
    item.style.transform = 'translateY(10px)';
    setTimeout(() => {
      item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      item.style.opacity = '1';
      item.style.transform = 'translateY(0)';
    }, 50 * index);
  });
}

/**
 * Save current settings to storage
 */
async function saveSettings() {
  try {
    const settings = {
      enabled: document.getElementById('enabled').checked,
      timeLimit: parseInt(document.getElementById('timeLimit').value, 10) || 2,
      unloadTimeout: parseInt(document.getElementById('unloadTimeout').value, 10) || 30,
      defaultBehavior: document.getElementById('defaultBehavior').value,
      showNotifications: document.getElementById('showNotifications').checked,
      autoKillUnloaded: document.getElementById('autoKillUnloaded').checked,
      patterns: getPatterns()
    };

    await browser.storage.sync.set(settings);
    
    const status = document.getElementById('status');
    status.textContent = 'Saved';
    status.style.display = 'block';
    status.style.opacity = '1';
    
    setTimeout(() => {
      status.style.opacity = '0';
      setTimeout(() => {
        status.style.display = 'none';
      }, 300);
    }, 1000);
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Initialize UI when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const settings = await browser.storage.local.get(['enabled', 'timeLimit', 'unloadTimeout', 'defaultBehavior', 'autoKillUnloaded']);
    document.getElementById('enabled').checked = settings.enabled ?? true;
    document.getElementById('timeLimit').value = settings.timeLimit ?? 2;
    document.getElementById('unloadTimeout').value = settings.unloadTimeout ?? 30;
    document.getElementById('defaultBehavior').value = settings.defaultBehavior ?? 'duplicate-no-query';
    document.getElementById('autoKillUnloaded').checked = settings.autoKillUnloaded ?? true;
    document.getElementById('showNotifications').checked = settings.showNotifications ?? true;

    // Add input validation for timeLimit and unloadTimeout
    document.getElementById('timeLimit').addEventListener('change', (e) => {
      const value = parseInt(e.target.value, 10);
      if (isNaN(value) || value < 1) {
        e.target.value = 2;
      }
    });
    document.getElementById('unloadTimeout').addEventListener('change', (e) => {
      const value = parseInt(e.target.value, 10);
      if (isNaN(value) || value < 1) {
        e.target.value = 30;
      }
    });

    // Update UI state based on enabled status
    const updateEnabledState = () => {
      const enabled = document.getElementById('enabled').checked;
      const disabledMessage = document.getElementById('disabled-message');
      disabledMessage.style.display = enabled ? 'none' : 'block';

      const formControls = document.querySelectorAll('input:not(#enabled), select');
      formControls.forEach(control => {
        control.classList.toggle('disabled', !enabled);
        control.disabled = false;
      });
    };

    // Setup pattern list
    const patternList = document.getElementById('patternList');
    patternList.innerHTML = '';
    settings.patterns.forEach(pattern => addPatternEntry(pattern));

    // Add event listeners
    document.getElementById('enabled').addEventListener('change', () => {
      updateEnabledState();
      saveSettings();
    });

    ['timeLimit', 'unloadTimeout', 'defaultBehavior', 'showNotifications', 'autoKillUnloaded'].forEach(id => {
      const element = document.getElementById(id);
      element.addEventListener('change', saveSettings);
      if (id === 'timeLimit') {
        element.addEventListener('input', saveSettings);
      }
    });

    // Add new pattern button handler
    document.getElementById('addPattern').addEventListener('click', () => {
      addPatternEntry({
        pattern: '',
        action: 'keep',
        isPreset: false
      });
    });

    // Add unloadTimeout listeners
    const unloadTimeoutElement = document.getElementById('unloadTimeout');
    unloadTimeoutElement.addEventListener('change', saveSettings);
    unloadTimeoutElement.addEventListener('input', saveSettings);

    // Initial UI update
    updateEnabledState();
    loadHistory();

    // Load settings
    const localSettings = await browser.storage.local.get(['enabled', 'timeLimit', 'unloadTimeout', 'defaultBehavior', 'autoKillUnloaded']);
    document.getElementById('enabled').checked = localSettings.enabled ?? true;
    document.getElementById('timeLimit').value = localSettings.timeLimit ?? 2;
    document.getElementById('unloadTimeout').value = localSettings.unloadTimeout ?? 30;
    document.getElementById('defaultBehavior').value = localSettings.defaultBehavior ?? 'duplicate-no-query';
    document.getElementById('autoKillUnloaded').checked = localSettings.autoKillUnloaded ?? true;

    // Load history
    loadHistory();

    // Add event listeners
    document.getElementById('enabled').addEventListener('change', saveSettings);
    document.getElementById('timeLimit').addEventListener('change', saveSettings);
    document.getElementById('unloadTimeout').addEventListener('change', saveSettings);
    document.getElementById('defaultBehavior').addEventListener('change', saveSettings);
    document.getElementById('autoKillUnloaded').addEventListener('change', saveSettings);
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('unloadInactive').addEventListener('click', unloadInactiveTabs);
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
});

/**
 * Get all patterns from the UI
 * @returns {Array} Array of pattern objects
 */
function getPatterns() {
  const patterns = [];
  document.querySelectorAll('.pattern-entry').forEach(entry => {
    patterns.push({
      pattern: entry.querySelector('.pattern-input').value,
      action: entry.querySelector('.pattern-action').value,
      isPreset: entry.dataset.preset === 'true'
    });
  });
  return patterns;
}

/**
 * Add a new pattern entry to the UI
 * @param {Object} pattern - Pattern object with pattern and action
 */
function addPatternEntry(pattern) {
  const entry = document.createElement('div');
  entry.className = 'pattern-entry';
  if (pattern.isPreset) {
    entry.dataset.preset = 'true';
  }

  const patternInput = document.createElement('input');
  patternInput.type = 'text';
  patternInput.className = 'pattern-input';
  patternInput.value = pattern.pattern;
  patternInput.placeholder = 'Enter URL pattern (e.g., *.example.com/*)';
  patternInput.addEventListener('input', saveSettings);

  const actionSelect = document.createElement('select');
  actionSelect.className = 'pattern-action';
  ['keep', 'close'].forEach(action => {
    const option = document.createElement('option');
    option.value = action;
    option.textContent = action.charAt(0).toUpperCase() + action.slice(1);
    actionSelect.appendChild(option);
  });
  actionSelect.value = pattern.action;
  actionSelect.addEventListener('change', saveSettings);

  const removeButton = document.createElement('button');
  removeButton.className = 'remove-pattern';
  removeButton.textContent = '×';
  removeButton.addEventListener('click', () => {
    entry.remove();
    saveSettings();
  });

  entry.appendChild(patternInput);
  entry.appendChild(actionSelect);
  entry.appendChild(removeButton);

  const patternList = document.getElementById('patternList');
  patternList.appendChild(entry);
}

// Add new pattern button handler
document.getElementById('addPattern').addEventListener('click', () => {
  addPatternEntry({
    pattern: '',
    action: 'keep',
    isPreset: false
  });
});

/**
 * @typedef {Object} ClosedTab
 * @property {string} url - The URL of the closed tab
 * @property {number} timestamp - When the tab was closed
 */

/**
 * Loads and displays the last 10 closed tabs in the history section
 */
async function loadHistory() {
  const { closedTabs = [] } = await browser.storage.local.get({ closedTabs: [] });
  const historyContainer = document.getElementById('history');
  historyContainer.innerHTML = '';
  
  const recentTabs = closedTabs.slice(-10).reverse();
  
  if (recentTabs.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No tabs have been closed yet.';
    historyContainer.appendChild(emptyState);
    return;
  }
  
  recentTabs.forEach((tab, index) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const url = document.createElement('div');
    url.className = 'history-url';
    url.textContent = tab.url;
    url.title = tab.url; // Add tooltip for long URLs
    
    const time = document.createElement('div');
    time.className = 'history-time';
    time.textContent = new Date(tab.timestamp).toLocaleString();
    
    const type = document.createElement('div');
    type.className = 'history-type';
    type.textContent = tab.type === 'unloaded' ? 'Unloaded' : 'Closed';
    
    item.appendChild(url);
    item.appendChild(time);
    item.appendChild(type);
    historyContainer.appendChild(item);
    
    // Add staggered animation
    item.style.opacity = '0';
    item.style.transform = 'translateY(10px)';
    setTimeout(() => {
      item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      item.style.opacity = '1';
      item.style.transform = 'translateY(0)';
    }, 50 * index);
  });
}

/**
 * Adds a new pattern entry to the UI
 * @param {Pattern} pattern - The pattern to add, defaults to empty pattern with 'keep' action
 */
function addPatternEntry(pattern = { pattern: '', action: 'keep', isPreset: false }) {
  const patternList = document.getElementById('patternList');
  
  const entry = document.createElement('div');
  entry.className = 'pattern-entry';
  if (pattern.isPreset) {
    entry.classList.add('preset-pattern');
  }
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'pattern-input';
  input.placeholder = 'e.g., *.example.com';
  input.value = pattern.pattern;
  
  const select = document.createElement('select');
  select.className = 'pattern-action';
  
  const actions = [
    { value: 'keep', text: 'Don\'t close tab' },
    { value: 'duplicate', text: 'Close if duplicate' },
    { value: 'duplicate-no-query', text: 'Close if duplicate (ignore query)' },
    { value: 'duplicate-domain', text: 'Close if duplicate domain' }
  ];
  
  actions.forEach(action => {
    const option = document.createElement('option');
    option.value = action.value;
    option.textContent = action.text;
    if (action.value === pattern.action) {
      option.selected = true;
    }
    select.appendChild(option);
  });
  
  const removeButton = document.createElement('button');
  removeButton.className = 'remove-pattern';
  removeButton.textContent = '×';
  removeButton.setAttribute('aria-label', 'Remove pattern');
  
  if (pattern.isPreset) {
    removeButton.classList.add('preset');
    removeButton.setAttribute('title', 'This is a preset pattern');
  }
  
  removeButton.addEventListener('click', () => {
    entry.classList.add('fade-out');
    setTimeout(() => {
      patternList.removeChild(entry);
    }, 300);
  });
  
  entry.appendChild(input);
  entry.appendChild(select);
  entry.appendChild(removeButton);
  
  patternList.appendChild(entry);
  
  // Add animation
  entry.style.opacity = '0';
  entry.style.transform = 'translateY(10px)';
  setTimeout(() => {
    entry.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    entry.style.opacity = '1';
    entry.style.transform = 'translateY(0)';
  }, 10);
}

// Add event listeners
document.getElementById('save').addEventListener('click', saveSettings);
document.getElementById('addPattern').addEventListener('click', () => addPatternEntry());

async function unloadInactiveTabs() {
  try {
    const button = document.getElementById('unloadInactive');
    button.disabled = true;
    button.textContent = 'Unloading...';
    
    await browser.runtime.sendMessage({ action: 'unloadInactiveTabs' });
    
    button.textContent = 'Unloaded!';
    setTimeout(() => {
      button.textContent = 'Unload Inactive Tabs';
      button.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('Error unloading tabs:', error);
    const button = document.getElementById('unloadInactive');
    button.textContent = 'Error!';
    button.disabled = false;
    setTimeout(() => {
      button.textContent = 'Unload Inactive Tabs';
    }, 2000);
  }
}
