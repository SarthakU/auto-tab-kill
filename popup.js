/**
 * @typedef {Object} ExtensionSettings
 * @property {boolean} enabled - Whether the extension is enabled
 * @property {number} timeLimit - Inactivity time limit in minutes
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
  try {
    const { closedTabs = [] } = await browser.storage.local.get({ closedTabs: [] });
    const historyContainer = document.getElementById('history');

    if (closedTabs.length === 0) {
      historyContainer.innerHTML = '<div class="empty-state">No tabs have been closed yet</div>';
      return;
    }

    const recentTabs = closedTabs.slice(-10).reverse();
    historyContainer.innerHTML = '';

    recentTabs.forEach(tab => {
      const tabEntry = document.createElement('div');
      tabEntry.className = 'history-entry';
      const timeDiff = Math.round((Date.now() - tab.timestamp) / 60000);
      
      const title = document.createElement('div');
      title.className = 'history-title';
      title.textContent = tab.title || 'Untitled';
      
      const url = document.createElement('div');
      url.className = 'history-url';
      url.textContent = tab.url;
      
      const time = document.createElement('div');
      time.className = 'history-time';
      time.textContent = `${timeDiff} minutes ago`;
      
      const reopenButton = document.createElement('button');
      reopenButton.className = 'btn btn-small';
      reopenButton.textContent = 'Reopen';
      reopenButton.addEventListener('click', async () => {
        try {
          await browser.tabs.create({ url: tab.url });
        } catch (error) {
          console.error('Error reopening tab:', error);
        }
      });
      
      tabEntry.appendChild(title);
      tabEntry.appendChild(url);
      tabEntry.appendChild(time);
      tabEntry.appendChild(reopenButton);
      
      historyContainer.appendChild(tabEntry);
    });
  } catch (error) {
    console.error('Error loading history:', error);
    const historyContainer = document.getElementById('history');
    historyContainer.innerHTML = '<div class="empty-state">Error loading history</div>';
  }
}

/**
 * Save current settings to storage
 */
async function saveSettings() {
  try {
    const settings = {
      enabled: document.getElementById('enabled').checked,
      timeLimit: parseInt(document.getElementById('timeLimit').value, 10) || 2,
      defaultBehavior: document.getElementById('defaultBehavior').value,
      showNotifications: document.getElementById('showNotifications').checked,
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
    const settings = await browser.storage.sync.get({
      enabled: true,
      timeLimit: 2,
      defaultBehavior: 'duplicate-no-query',
      showNotifications: true,
      patterns: [
        {
          pattern: 'about:*',
          action: 'keep',
          isPreset: true
        }
      ]
    });

    // Set initial values
    document.getElementById('enabled').checked = settings.enabled;
    document.getElementById('timeLimit').value = settings.timeLimit || 2;
    document.getElementById('defaultBehavior').value = settings.defaultBehavior;
    document.getElementById('showNotifications').checked = settings.showNotifications;

    // Add input validation for timeLimit
    document.getElementById('timeLimit').addEventListener('change', (e) => {
      const value = parseInt(e.target.value, 10);
      if (isNaN(value) || value < 1) {
        e.target.value = 2;
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

    ['timeLimit', 'defaultBehavior', 'showNotifications'].forEach(id => {
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

    // Initial UI update
    updateEnabledState();
    loadHistory();
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
    
    item.appendChild(url);
    item.appendChild(time);
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
