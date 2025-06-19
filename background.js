/**
 * @typedef {Object} ClosedTab
 * @property {string} url - The URL of the closed tab
 * @property {number} timestamp - When the tab was closed
 */

// Track tab activity
const tabActivity = new Map();

/**
 * Update the activity timestamp for a tab
 * @param {number} tabId - The ID of the tab to update
 */
function updateTabActivity(tabId) {
  const timestamp = Date.now();
  tabActivity.set(tabId, timestamp);
  console.log(`Tab ${tabId} activity updated at:`, new Date(timestamp).toISOString());
}

/**
 * Get the last access time for a tab
 * @param {number} tabId - The ID of the tab
 * @returns {number} The last access time in milliseconds
 */
async function getTabLastAccess(tabId) {
  return tabActivity.get(tabId) || Date.now();
}

/**
 * Adds a closed tab to the history and shows a notification
 * @param {string} url - The URL of the closed tab
 * @param {string} type - The type of the tab (default: 'closed')
 */
async function addToHistory(url, type = 'closed') {
  try {
    const { closedTabs = [] } = await browser.storage.local.get({ closedTabs: [] });
    const { showNotifications = true } = await browser.storage.sync.get({ showNotifications: true });
    
    closedTabs.push({
      url,
      timestamp: Date.now(),
      type
    });
    
    // Keep only last 100 entries
    if (closedTabs.length > 100) {
      closedTabs.shift();
    }
    
    await browser.storage.local.set({ closedTabs });

    // Show notification if enabled
    if (showNotifications) {
      await browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('icons/icon-48.png'),
        title: type === 'unloaded' ? 'Tab Unloaded' : 'Tab Closed',
        message: `${type === 'unloaded' ? 'Unloaded' : 'Closed'} tab: ${url}`
      });
    }
  } catch (e) {
    console.error('Error adding to history:', e);
  }
}

/**
 * Initializes activity tracking for all existing tabs
 */
async function initializeTabActivity() {
  console.log('Initializing tab activity...');
  const tabs = await browser.tabs.query({});
  const currentTime = Date.now();
  
  tabs.forEach(tab => {
    tabActivity.set(tab.id, currentTime);
  });
  
  console.log('Tab activity initialized');
}

initializeTabActivity();

/**
 * @typedef {Object} Pattern
 * @property {string} pattern - URL pattern with wildcards
 * @property {('keep'|'duplicate'|'duplicate-no-query'|'duplicate-domain')} action - Action to take for matching URLs
 */

/**
 * Determines the action to take for a URL based on the first matching pattern
 * @param {string} url - The URL to check
 * @param {Pattern[]} patterns - List of patterns to check against
 * @returns {string|null} The action to take, or null if no pattern matches
 */
function getPatternAction(url, patterns) {
  // Always protect about: pages
  if (url.startsWith('about:')) {
    return 'keep';
  }

  for (const pattern of patterns) {
    try {
      if (url.match(new RegExp(pattern.pattern))) {
        return pattern.action;
      }
    } catch (e) {
      console.error('Invalid pattern:', pattern, e);
    }
  }
  return null;
}

/**
 * Returns the URL without query parameters
 * @param {string} url - The URL to process
 * @returns {string} URL without query parameters
 */
function getUrlWithoutQuery(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch (e) {
    return url;
  }
}

/**
 * Extracts the domain from a URL
 * @param {string} url - The URL to process
 * @returns {string} The domain name
 */
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return url;
  }
}

/**
 * @typedef {Object} TabSettings
 * @property {boolean} closeDuplicates - Whether to close exact duplicate tabs
 * @property {boolean} closeDuplicatesIgnoreQuery - Whether to close tabs that are duplicates when ignoring query parameters
 * @property {boolean} closeDuplicateDomains - Whether to close tabs with duplicate domains (keeping newest)
 * @property {('duplicate'|'duplicate-no-query'|'duplicate-domain'|'always'|'never')} defaultBehavior - Default behavior for tabs without a matching pattern
 */

/**
 * Check if a tab should be closed based on settings and patterns
 * @param {browser.tabs.Tab} tab - The tab to check
 * @param {TabSettings} settings - Current tab settings
 * @param {browser.tabs.Tab[]} allTabs - All open tabs
 * @returns {boolean} Whether the tab should be closed
 */
async function shouldCloseTab(tab, settings, allTabs) {
  // Skip about: URLs by default
  if (tab.url.startsWith('about:')) {
    return false;
  }

  // Check patterns first
  for (const pattern of settings.patterns) {
    if (matchesPattern(tab.url, pattern.pattern)) {
      switch (pattern.action) {
        case 'keep':
          return false;
        case 'duplicate':
          // Find the newest duplicate tab
          const exactDuplicates = allTabs.filter(t => t.id !== tab.id && t.url === tab.url);
          if (exactDuplicates.length > 0) {
            // Only close this tab if it's older than all duplicates
            return exactDuplicates.every(t => tab.lastAccessed < t.lastAccessed);
          }
          return false;
        case 'duplicate-no-query':
          const tabUrlNoQuery = getUrlWithoutQuery(tab.url);
          const queryDuplicates = allTabs.filter(t => 
            t.id !== tab.id && getUrlWithoutQuery(t.url) === tabUrlNoQuery
          );
          if (queryDuplicates.length > 0) {
            // Only close this tab if it's older than all duplicates
            return queryDuplicates.every(t => tab.lastAccessed < t.lastAccessed);
          }
          return false;
        case 'duplicate-domain':
          const tabDomain = getDomain(tab.url);
          const domainDuplicates = allTabs.filter(t => 
            t.id !== tab.id && getDomain(t.url) === tabDomain
          );
          if (domainDuplicates.length > 0) {
            // Only close this tab if it's older than all duplicates
            return domainDuplicates.every(t => tab.lastAccessed < t.lastAccessed);
          }
          return false;
      }
    }
  }

  // Apply default behavior if no patterns match
  switch (settings.defaultBehavior) {
    case 'duplicate':
      const exactDuplicates = allTabs.filter(t => t.id !== tab.id && t.url === tab.url);
      return exactDuplicates.length > 0 && exactDuplicates.every(t => tab.lastAccessed < t.lastAccessed);
    case 'duplicate-no-query':
      const tabUrlNoQuery = getUrlWithoutQuery(tab.url);
      const queryDuplicates = allTabs.filter(t => 
        t.id !== tab.id && getUrlWithoutQuery(t.url) === tabUrlNoQuery
      );
      return queryDuplicates.length > 0 && queryDuplicates.every(t => tab.lastAccessed < t.lastAccessed);
    case 'duplicate-domain':
      const tabDomain = getDomain(tab.url);
      const domainDuplicates = allTabs.filter(t => 
        t.id !== tab.id && getDomain(t.url) === tabDomain
      );
      return domainDuplicates.length > 0 && domainDuplicates.every(t => tab.lastAccessed < t.lastAccessed);
    default:
      return false;
  }
}

/**
 * Checks if a tab has a duplicate
 * @param {browser.tabs.Tab} tab - The tab to check
 * @param {browser.tabs.Tab[]} allTabs - All open tabs
 * @returns {boolean} Whether the tab has a duplicate
 */
function hasDuplicate(tab, allTabs) {
  return allTabs.some(t => t.id !== tab.id && t.url === tab.url);
}

/**
 * Checks if a tab has a duplicate ignoring query parameters
 * @param {browser.tabs.Tab} tab - The tab to check
 * @param {browser.tabs.Tab[]} allTabs - All open tabs
 * @returns {boolean} Whether the tab has a duplicate ignoring query parameters
 */
function hasDuplicateIgnoringQuery(tab, allTabs) {
  const tabUrlNoQuery = getUrlWithoutQuery(tab.url);
  return allTabs.some(t => t.id !== tab.id && getUrlWithoutQuery(t.url) === tabUrlNoQuery);
}

/**
 * Checks if a tab has a duplicate domain
 * @param {browser.tabs.Tab} tab - The tab to check
 * @param {browser.tabs.Tab[]} allTabs - All open tabs
 * @returns {boolean} Whether the tab has a duplicate domain
 */
function hasDuplicateDomain(tab, allTabs) {
  const tabDomain = getDomain(tab.url);
  const duplicateDomainTab = allTabs.find(t => t.id !== tab.id && getDomain(t.url) === tabDomain);
  return duplicateDomainTab && tab.lastAccessed < duplicateDomainTab.lastAccessed;
}

/**
 * Checks if a URL matches a pattern
 * @param {string} url - The URL to check
 * @param {string} pattern - The pattern to match against
 * @returns {boolean} Whether the URL matches the pattern
 */
function matchesPattern(url, pattern) {
  const patternRegex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*');
  return new RegExp(`^${patternRegex}$`).test(url);
}

/**
 * Gets the domain from a URL
 * @param {string} url - The URL to get the domain from
 * @returns {string} The domain
 */
function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Gets a URL without query parameters
 * @param {string} url - The URL to strip query parameters from
 * @returns {string} The URL without query parameters
 */
function getUrlWithoutQuery(url) {
  try {
    const urlObj = new URL(url);
    urlObj.search = '';
    return urlObj.toString();
  } catch {
    return url;
  }
}

// Track unloaded tabs and their timestamps
let unloadedTabs = new Map();

// Function to check and kill old unloaded tabs
async function checkAndKillUnloadedTabs() {
  console.log('Checking for old unloaded tabs...');
  const settings = await browser.storage.sync.get({ autoKillUnloaded: false });
  
  if (!settings.autoKillUnloaded) {
    console.log('Auto-kill unloaded tabs is disabled');
    return;
  }

  const now = Date.now();
  const KILL_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  for (const [tabId, unloadTime] of unloadedTabs.entries()) {
    if (now - unloadTime >= KILL_AFTER_MS) {
      try {
        const tab = await browser.tabs.get(tabId);
        if (tab && !tab.active && !tab.discarded) {
          console.log(`Killing old unloaded tab: ${tab.url}`);
          await browser.tabs.remove(tabId);
          await addToHistory(tab.url, 'killed');
        }
      } catch (error) {
        console.error(`Error killing tab ${tabId}:`, error);
      }
      unloadedTabs.delete(tabId);
    }
  }
}

// Add alarm for checking unloaded tabs
browser.alarms.create('checkUnloadedTabs', {
  periodInMinutes: 30 // Check every 30 minutes
});

// Update the alarm handler
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkUnloadTabs') {
    await checkAndKillUnloadedTabs();
  }
});

// Update the tab update listener to remove tabs from tracking when they become active
browser.tabs.onActivated.addListener(async (activeInfo) => {
  unloadedTabs.delete(activeInfo.tabId);
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    unloadedTabs.delete(tabId);
  }
});

// Listen for tab activation
browser.tabs.onActivated.addListener(activeInfo => {
  updateTabActivity(activeInfo.tabId);
});

// Listen for tab updates
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    updateTabActivity(tabId);
  }
});

// Listen for tab removal
browser.tabs.onRemoved.addListener(tabId => {
  tabActivity.delete(tabId);
});

// Listen for window focus changes
browser.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== browser.windows.WINDOW_ID_NONE) {
    const tabs = await browser.tabs.query({ active: true, windowId });
    if (tabs.length > 0) {
      updateTabActivity(tabs[0].id);
    }
  }
});

// Update active tab's last access time periodically
setInterval(async () => {
  try {
    const tabs = await browser.tabs.query({ active: true });
    tabs.forEach(tab => updateTabActivity(tab.id));
  } catch (error) {
    console.error('Error updating active tab timestamps:', error);
  }
}, 60000); // Update every minute

// Check and close inactive tabs
/**
 * Checks all tabs and closes them based on inactivity and duplicate rules
 * Handles both pattern-based rules and global duplicate settings
 */
async function checkInactiveTabs() {
  try {
    console.log('Starting inactive tabs check...');
    // Load settings with defaults
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

    if (!settings.enabled) {
      console.log('Extension is disabled, skipping check');
      return;
    }

    // Retrieve and integrate whitelist
    const { whitelist = [] } = await browser.storage.sync.get({ whitelist: [] });
    const transformedWhitelist = whitelist.map(pattern => ({ pattern, action: 'keep' }));
    settings.patterns = transformedWhitelist.concat(settings.patterns || []);

    const tabs = await browser.tabs.query({});
    const now = Date.now();
    const inactiveTime = settings.timeLimit * 60 * 1000;

    for (const tab of tabs) {
      const lastAccess = await getTabLastAccess(tab.id);
      const timeSinceLastAccess = now - lastAccess;
      const timeLeft = inactiveTime - timeSinceLastAccess;
      
      console.log(`Checking tab ${tab.id}: ${tab.url}`);
      console.log(`Last access: ${new Date(lastAccess).toISOString()}`);
      console.log(`Time since last access: ${Math.round(timeSinceLastAccess/1000)}s`);
      console.log(`Time left before close: ${Math.round(timeLeft/1000)}s`);
      
      // Skip pinned tabs
      if (tab.pinned) {
        console.log(`Skipping pinned tab ${tab.id}: ${tab.url}`);
        continue;
      }

      // Skip if tab is still within inactive time limit
      if (timeLeft > 0) {
        console.log(`Tab ${tab.id} still has ${Math.round(timeLeft/1000)}s left`);
        continue;
      }

      // Only check for duplicates if we're in a duplicate-based mode
      const isDuplicateMode = settings.defaultBehavior.startsWith('duplicate');
      const hasDuplicate = await shouldCloseTab(tab, settings, tabs);
      
      // For duplicate modes, only close if hasDuplicate is true
      // For non-duplicate modes, close if it's inactive
      const shouldClose = isDuplicateMode ? hasDuplicate : true;
      
      console.log(`Tab ${tab.id} - isDuplicateMode: ${isDuplicateMode}, hasDuplicate: ${hasDuplicate}, shouldClose: ${shouldClose}`);
      
      if (shouldClose) {
        console.log(`Closing tab ${tab.id}: ${tab.url}`);
        
        if (settings.showNotifications) {
          await browser.notifications.create({
            type: 'basic',
            iconUrl: browser.runtime.getURL('icons/icon-48.png'),
            title: 'Inactive Tab Closed',
            message: `Closed tab: ${tab.title}\nInactive for: ${Math.round((now - lastAccess) / 60000)} minutes`
          });
        }

        await addToHistory(tab.url);
        await browser.tabs.remove(tab.id);
        tabActivity.delete(tab.id);
      }
    }
    console.log('Finished checking inactive tabs');
  } catch (error) {
    console.error('Error checking inactive tabs:', error);
  }
}

// Listen for tab creation
browser.tabs.onCreated.addListener((tab) => {
  console.log("New tab created:", tab);
  updateTabActivity(tab.id);
});

// Set up periodic check
browser.alarms.create('checkInactiveTabs', {
  periodInMinutes: 1
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkInactiveTabs') {
    console.log("Checking inactive tabs...");
    checkInactiveTabs().catch(error => {
      console.error('Error checking inactive tabs:', error);
    });
  }
});

// Set up periodic check for unloading tabs
browser.alarms.create('checkUnloadTabs', {
  periodInMinutes: 1
});

// Track last unload time
let lastUnloadTime = 0;

// Unload (discard) all eligible tabs if unloadTimeout has passed
async function checkUnloadTabs() {
  try {
    console.log('Starting unload tabs check...');
    const settings = await browser.storage.sync.get({
      unloadTimeout: 30,
      enabled: true
    });
    if (!settings.enabled) {
      console.log('Extension is disabled, skipping unload check');
      return;
    }
    const now = Date.now();
    if (!lastUnloadTime) lastUnloadTime = now;
    const unloadInterval = (settings.unloadTimeout || 30) * 60 * 1000;
    if (now - lastUnloadTime < unloadInterval) {
      console.log(`Unload interval not yet passed. Time left: ${Math.round((unloadInterval - (now - lastUnloadTime)) / 60000)} minutes`);
      return;
    }
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.pinned || tab.active || tab.discarded) continue;
      // Only unload normal tabs
      try {
        await browser.tabs.discard(tab.id);
        console.log(`Unloaded tab ${tab.id}: ${tab.url}`);
        // Add unloaded tab to logs
        await addToHistory(tab.url, 'unloaded');
      } catch (e) {
        console.error('Error unloading tab:', tab.id, e);
      }
    }
    lastUnloadTime = now;
  } catch (e) {
    console.error('Error in checkUnloadTabs:', e);
  }
}

// Listen for alarms
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkInactiveTabs') {
    console.log("Checking inactive tabs...");
    checkInactiveTabs().catch(error => {
      console.error('Error checking inactive tabs:', error);
    });
  } else if (alarm.name === 'checkUnloadTabs') {
    checkUnloadTabs().catch(error => {
      console.error('Error checking unload tabs:', error);
    });
  }
});

// Initialize extension
initializeTabActivity().catch(error => {
  console.error('Error initializing tab activity:', error);
});

// Function to manually unload inactive tabs
async function manuallyUnloadInactiveTabs() {
  try {
    console.log('Manually unloading inactive tabs...');
    const settings = await browser.storage.sync.get({
      timeLimit: 2,
      enabled: true
    });

    if (!settings.enabled) {
      console.log('Extension is disabled, skipping manual unload');
      return;
    }

    const tabs = await browser.tabs.query({});
    const now = Date.now();
    const inactiveTime = settings.timeLimit * 60 * 1000;

    for (const tab of tabs) {
      if (tab.pinned || tab.active || tab.discarded) continue;
      
      const lastAccess = await getTabLastAccess(tab.id);
      const timeSinceLastAccess = now - lastAccess;
      
      if (timeSinceLastAccess >= inactiveTime) {
        try {
          await browser.tabs.discard(tab.id);
          console.log(`Manually unloaded tab ${tab.id}: ${tab.url}`);
          await addToHistory(tab.url, 'unloaded');
        } catch (e) {
          console.error('Error unloading tab:', tab.id, e);
        }
      }
    }
  } catch (e) {
    console.error('Error in manual unload:', e);
  }
}

// Listen for messages from popup
browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'unloadInactiveTabs') {
    manuallyUnloadInactiveTabs();
  }
});