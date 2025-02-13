import Fuse from "https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.esm.min.js";

function normalizeDomain(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch (e) {
    console.error("Invalid URL in normalizeDomain:", e);
    return '';
  }
}

function isDomainMatch(tabDomain, filterDomain) {
  if (!tabDomain || !filterDomain) return false;
  return tabDomain === filterDomain || tabDomain.endsWith('.' + filterDomain);
}

// Initialize chrome.storage
chrome.storage.local.get(['savedTabs'], (result) => {
  if (!result.savedTabs) {
    chrome.storage.local.set({ savedTabs: [] });
  }
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "searchTabs") {
	
    chrome.tabs.query({}, (tabs) => {

      let results = [];
      
      if (request.useRegex) {
        try {
          const regex = new RegExp(request.query, 'i');
          results = tabs.filter(tab => regex.test(tab.title) || regex.test(tab.url));
        } catch (e) {
          console.error("Invalid regex: ", e);
          sendResponse({ error: "Invalid regex syntax" });
          return;
        }
      } else {
        const fuse = new Fuse(tabs, { keys: ["title", "url"], threshold: 0.3 });
        results = fuse.search(request.query).map(result => result.item);
      }
      
      // Apply domain filter if specified
      if (request.domainFilter && request.domainFilter !== 'all') {
        const filterDomain = normalizeDomain('http://' + request.domainFilter);
        results = results.filter(tab => {
          const tabDomain = normalizeDomain(tab.url);
          return isDomainMatch(tabDomain, filterDomain);
        });
      }

      // Apply time filter if specified
      if (request.timeFilter && request.timeFilter !== 'all') {
        const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const now = Date.now();
        
        results = results.filter(tab => {
          if (request.timeFilter === 'recent') {
            return (now - tab.lastAccessed) <= ONE_DAY;
          } else if (request.timeFilter === 'older') {
            return (now - tab.lastAccessed) > ONE_DAY;
          }
          return true;
        });
      }
      
      sendResponse({ results });
    });
    return true;
  }
  
  if (request.action === "searchHistory") {
    chrome.history.search({ text: request.query, maxResults: 20 }, (historyItems) => {
      sendResponse({ results: historyItems });
    });
    return true;
  }
  
  if (request.action === "ungroupTabs") {
    chrome.tabGroups.query({}, async (groups) => {
      try {
        for (const group of groups) {
          const tabs = await chrome.tabs.query({ groupId: group.id });
          if (tabs.length > 0) {
            await chrome.tabs.ungroup(tabs.map(tab => tab.id));
          }
        }
        sendResponse({ success: true });
      } catch (err) {
        console.error("Error ungrouping tabs:", err);
        sendResponse({ error: err.message });
      }
    });
    return true;
  }

  if (request.action === "getAllTabs") {
    chrome.tabs.query({}, (tabs) => {
      try {
        sendResponse({ tabs });
      } catch (err) {
        console.error("Error getting all tabs:", err);
        sendResponse({ error: err.message });
      }
    });
    return true;
  }

  if (request.action === "getRecentTabs") {
    chrome.tabs.query({ active: false }, (tabs) => {
      try {
        const sortedTabs = tabs
          .sort((a, b) => b.lastAccessed - a.lastAccessed)
          .slice(0, 10);
        sendResponse({ tabs: sortedTabs });
      } catch (err) {
        console.error("Error getting recent tabs:", err);
        sendResponse({ error: err.message });
      }
    });
    return true;
  }

  if (request.action === "saveTabs") {
    try {
      chrome.storage.local.get(['savedTabs'], (result) => {
        const savedTabs = result.savedTabs || [];
        const updatedTabs = [...savedTabs, ...request.tabs];
        
        chrome.storage.local.set({ savedTabs: updatedTabs }, () => {
          sendResponse({ success: true, savedTabs: updatedTabs });
        });
      });
    } catch (err) {
      console.error("Error saving tabs:", err);
      sendResponse({ error: err.message });
    }
    return true;
  }

  if (request.action === "getSavedTabs") {
    try {
      chrome.storage.local.get(['savedTabs'], (result) => {
        sendResponse({ savedTabs: result.savedTabs || [] });
      });
    } catch (err) {
      console.error("Error getting saved tabs:", err);
      sendResponse({ error: err.message });
    }
    return true;
  }

  if (request.action === "unsaveTab") {
    try {
      chrome.storage.local.get(['savedTabs'], (result) => {
        const savedTabs = result.savedTabs || [];
        const updatedTabs = savedTabs.filter(tab => tab.url !== request.tab.url);
        
        chrome.storage.local.set({ savedTabs: updatedTabs }, () => {
          sendResponse({ success: true, savedTabs: updatedTabs });
        });
      });
    } catch (err) {
      console.error("Error unsaving tab:", err);
      sendResponse({ error: err.message });
    }
    return true;
  }

  if (request.action === "unsaveAllTabs") {
    try {
      chrome.storage.local.set({ savedTabs: [] }, () => {
        sendResponse({ success: true, savedTabs: [] });
      });
    } catch (err) {
      console.error("Error unsaving all tabs:", err);
      sendResponse({ error: err.message });
    }
    return true;
  }

  if (request.action === "groupTabs") {
    // Query all tabs and group them by domain
    chrome.tabs.query({}, async (tabs) => {
      try {
        // First, group tabs by domain into an object of tabIds arrays
        const domainGroups = tabs.reduce((acc, tab) => {
          try {
            const domain = new URL(tab.url).hostname;
            if (!domain) return acc; // Skip tabs without valid domains
            acc[domain] = acc[domain] || [];
            acc[domain].push(tab.id);
            return acc;
          } catch (err) {
            console.error("Error processing tab URL:", err);
            return acc;
          }
        }, {});

        const groupedTabs = {};
        
        // Define an array of colors for groups
        const colors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
        let colorIndex = 0;

        // Create tab groups for each domain
        for (const [domain, tabIds] of Object.entries(domainGroups)) {
          if (tabIds.length < 2) continue; // Skip domains with single tabs
          
          try {
            // Create a new tab group
            const groupId = await chrome.tabs.group({ tabIds });
            
            // Generate meaningful group name
            const parts = domain.split('.');
            let groupName = parts[parts.length - 2] || domain;
            if (parts.length > 2 && parts[0] !== 'www') {
              groupName = parts[0] + '.' + groupName;
            }

            // Update the group with title and color
            await chrome.tabGroups.update(groupId, {
              title: groupName,
              color: colors[colorIndex % colors.length]
            });
            
            // Store the group information
            groupedTabs[domain] = {
              groupId,
              tabIds,
              domain,
              title: groupName
            };

            colorIndex++;
          } catch (err) {
            console.error(`Error creating group for ${domain}:`, err);
          }
        }
        
        sendResponse({ groupedTabs });
      } catch (err) {
        console.error("Error in groupTabs:", err);
        sendResponse({ error: err.message });
      }
    });
    return true;
  }

  if (request.action === "searchInsideTabs") {
    chrome.tabs.query({}, (tabs) => {
      const results = [];
      let pending = tabs.length;

      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { action: "searchInsideContent", query: request.query }, (response) => {
          if (chrome.runtime.lastError || !response) {
            pending--;
            if (pending === 0) {
              sendResponse({ results });
            }
            return;
          }

          if (response.found) {
            results.push({
              tabId: tab.id,
              title: tab.title,
              matches: response.matches  // array of { snippet, index }
            });
          }
          pending--;
          if (pending === 0) {
            sendResponse({ results });
          }
        });
      });
    });
    return true;
  }
});
