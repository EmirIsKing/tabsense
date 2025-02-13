// Helper function to populate domain filter
async function populateDomainFilter() {
  const domainFilter = document.getElementById('domainFilter');
  const tabs = await chrome.tabs.query({});
  
  // Extract unique domains
  const domains = new Set(tabs.map(tab => {
    try {
      return new URL(tab.url).hostname;
    } catch (e) {
      return null;
    }
  }).filter(Boolean));
  
  // Clear existing options except "All Domains"
  while (domainFilter.options.length > 1) {
    domainFilter.remove(1);
  }
  
  // Add domain options
  domains.forEach(domain => {
    const option = document.createElement('option');
    option.value = domain;
    option.textContent = domain;
    domainFilter.appendChild(option);
  });
}

// Helper functions for displaying content
function displayTabs(tabs, sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  
  section.innerHTML = '';
  
  if (sectionId.includes('allTabs')) {
    const tabActions = document.createElement('div');
    tabActions.className = 'tab-actions';
    
    const saveAllButton = document.createElement('button');
    saveAllButton.textContent = 'Save All Tabs';
    saveAllButton.onclick = () => {
      chrome.runtime.sendMessage({ 
        action: "saveTabs", 
        tabs: tabs
      }, (response) => {
        if (response.success) {
          saveAllButton.textContent = 'Saved All Tabs';
          saveAllButton.disabled = true;
        }
      });
    };
    
    tabActions.appendChild(saveAllButton);
    section.appendChild(tabActions);
  } else if (sectionId.includes('savedTabs')) {
    const tabActions = document.createElement('div');
    tabActions.className = 'tab-actions';
    
    const unsaveAllButton = document.createElement('button');
    unsaveAllButton.textContent = 'Unsave All Tabs';
    unsaveAllButton.className = 'unsave-all-button';
    unsaveAllButton.onclick = () => {
      chrome.runtime.sendMessage({ 
        action: "unsaveAllTabs"
      }, (response) => {
        if (response.success) {
          section.innerHTML = '';
          const emptyMessage = document.createElement('div');
          emptyMessage.className = 'empty-message';
          emptyMessage.textContent = 'No tabs found';
          section.appendChild(emptyMessage);
        }
      });
    };
    
    tabActions.appendChild(unsaveAllButton);
    section.appendChild(tabActions);
  }
  
  if (!tabs.length) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'No tabs found';
    section.appendChild(emptyMessage);
    return;
  }

  tabs.forEach(tab => {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab-item';
    
    const favicon = document.createElement('img');
    favicon.src = tab.favIconUrl || 'default-favicon.png';
    favicon.className = 'tab-favicon';
    
    const title = document.createElement('span');
    title.textContent = tab.title;
    title.className = 'tab-title';
    
    tabElement.appendChild(favicon);
    tabElement.appendChild(title);
    
    if (sectionId.includes('allTabs') || sectionId.includes('recentTabs')) {
      const saveButton = document.createElement('button');
      saveButton.textContent = 'Save';
      saveButton.className = 'save-button';
      saveButton.onclick = () => {
        chrome.runtime.sendMessage({ 
          action: "saveTabs", 
          tabs: [tab]
        }, (response) => {
          if (response.success) {
            saveButton.textContent = 'Saved';
            saveButton.disabled = true;
          }
        });
      };
      tabElement.appendChild(saveButton);
    } else if (sectionId.includes('savedTabs')) {
      const unsaveButton = document.createElement('button');
      unsaveButton.textContent = 'Unsave';
      unsaveButton.className = 'unsave-button';
      unsaveButton.onclick = (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ 
          action: "unsaveTab", 
          tab: tab
        }, (response) => {
          if (response.success) {
            tabElement.remove();
            if (!section.querySelector('.tab-item')) {
              const emptyMessage = document.createElement('div');
              emptyMessage.className = 'empty-message';
              emptyMessage.textContent = 'No tabs found';
              section.appendChild(emptyMessage);
            }
          }
        });
      };
      tabElement.appendChild(unsaveButton);
    }
    
    tabElement.onclick = (e) => {
      if (!e.target.classList.contains('save-button')) {
        chrome.tabs.update(tab.id, { active: true });
      }
    };
    
    section.appendChild(tabElement);
  });
}

function displayHistory(historyItems, sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  
  section.innerHTML = '';
  
  if (!historyItems.length) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'No history items found';
    section.appendChild(emptyMessage);
    return;
  }

  historyItems.forEach(item => {
    const historyElement = document.createElement('div');
    historyElement.className = 'history-item';
    
    const title = document.createElement('span');
    title.textContent = item.title || item.url;
    title.className = 'history-title';
    
    const time = document.createElement('span');
    time.textContent = new Date(item.lastVisitTime).toLocaleString();
    time.className = 'history-time';
    
    historyElement.appendChild(title);
    historyElement.appendChild(time);
    
    historyElement.onclick = () => {
      chrome.tabs.create({ url: item.url });
    };
    
    section.appendChild(historyElement);
  });
}

function displayResultSection(title, items) {
  const resultsList = document.getElementById('results');
  const header = document.createElement('li');
  header.textContent = title;
  header.className = 'header-item';
  resultsList.appendChild(header);
  
  items.forEach(item => {
    const li = document.createElement('li');
    li.setAttribute('tabindex', '0');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');

    if (title === 'Tab Content' && item.snippet) {
      // For tab content results, create a container with title and snippet
      const titleElement = document.createElement('div');
      titleElement.className = 'result-title';
      titleElement.textContent = item.title || item.url;
      
      const snippetElement = document.createElement('div');
      snippetElement.className = 'result-snippet';
      
      // Handle highlighted snippet if available
      if (item.highlightedSnippet) {
        snippetElement.innerHTML = item.highlightedSnippet;
      } else {
        snippetElement.textContent = item.snippet;
      }
      
      // Add match count if available
      if (item.matchCount > 1) {
        const matchCount = document.createElement('div');
        matchCount.className = 'match-count';
        matchCount.textContent = `${item.matchCount} matches found`;
        li.appendChild(titleElement);
        li.appendChild(snippetElement);
        li.appendChild(matchCount);
      } else {
        li.appendChild(titleElement);
        li.appendChild(snippetElement);
      }
    } else {
      // For other result types, just show title/url
      li.textContent = item.title || item.url;
    }

    li.onclick = () => {
      if (item.id) {
        chrome.tabs.update(item.id, { active: true });
      } else if (item.url) {
        chrome.tabs.create({ url: item.url });
      }
    };
    
    resultsList.appendChild(li);
  });
}

// Focus search input when popup opens
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search');
  searchInput.focus();

  // Initialize domain filter
  populateDomainFilter();

  // Add filter change event listeners
  const domainFilter = document.getElementById('domainFilter');
  const timeFilter = document.getElementById('timeFilter');

  domainFilter.addEventListener('change', () => {
    const event = new Event('input');
    searchInput.dispatchEvent(event);
  });

  timeFilter.addEventListener('change', () => {
    const event = new Event('input');
    searchInput.dispatchEvent(event);
  });

  // Load saved search preferences
  chrome.storage.local.get({
    searchPreferences: {
      openTabs: true,
      history: false,
      savedTabs: false,
      tabContent: false
    }
  }, (result) => {
    document.getElementById('searchOpenTabs').checked = result.searchPreferences.openTabs;
    document.getElementById('searchHistory').checked = result.searchPreferences.history;
    document.getElementById('searchSavedTabs').checked = result.searchPreferences.savedTabs;
  });

  // Add event listeners for search preference checkboxes
  const searchOptions = ['searchOpenTabs', 'searchHistory', 'searchSavedTabs'];
  searchOptions.forEach(optionId => {
    document.getElementById(optionId).addEventListener('change', function() {
      chrome.storage.local.get({ searchPreferences: {} }, (result) => {
        const preferences = result.searchPreferences;
        const key = optionId.replace('search', '').toLowerCase();
        preferences[key] = this.checked;
        chrome.storage.local.set({ searchPreferences: preferences });
      });
    });
  });
  
  // Load recent tabs by default
  chrome.runtime.sendMessage({ action: "getRecentTabs" }, (response) => {
    if (response.tabs) {
      displayTabs(response.tabs, 'recentTabs');
    }
  });
});

document.getElementById('search').addEventListener('input', function () {
  let query = this.value;
  const resultsList = document.getElementById('results');
  const tabSections = document.getElementById('tabSections');
  
  // Show/hide dropdown sections based on search state
  if (query.trim()) {
    tabSections.style.display = 'none';
  } else {
    tabSections.style.display = 'block';
    resultsList.innerHTML = '';
    return;
  }

  // Clear previous results
  resultsList.innerHTML = '';

  chrome.storage.local.get({
    searchPreferences: {
      openTabs: true,
      history: false,
      savedTabs: false,
      tabContent: false
    }
  }, (result) => {
    const prefs = result.searchPreferences;
    prefs.tabContent = document.getElementById('searchInsideTabs').checked;
    let pendingResponses = 0;
    let allResults = {
      tabs: [],
      history: [],
      savedTabs: [],
      tabContent: []
    };

    const displayAllResults = () => {
      if (pendingResponses > 0) return;
      if (Object.values(allResults).every(arr => arr.length === 0)) {
        let emptyMessage = document.createElement('li');
        emptyMessage.textContent = 'No results found';
        emptyMessage.className = 'empty-message';
        resultsList.appendChild(emptyMessage);
        return;
      }
      if (prefs.openTabs && allResults.tabs.length) {
        displayResultSection('Open Tabs', allResults.tabs);
      }
      if (prefs.history && allResults.history.length) {
        displayResultSection('History', allResults.history);
      }
      if (prefs.savedTabs && allResults.savedTabs.length) {
        displayResultSection('Saved Tabs', allResults.savedTabs);
      }
      if (prefs.tabContent && allResults.tabContent.length) {
        displayResultSection('Tab Content', allResults.tabContent);
      }
    };

    if (prefs.openTabs) {
      pendingResponses++;
      const domainFilter = document.getElementById('domainFilter').value;
      const timeFilter = document.getElementById('timeFilter').value;
      chrome.runtime.sendMessage({ 
        action: 'searchTabs', 
        query,
        domainFilter,
        timeFilter 
      }, (response) => {
        allResults.tabs = response.results || [];
        pendingResponses--;
        displayAllResults();
      });
    }

    if (prefs.history) {
      pendingResponses++;
      chrome.runtime.sendMessage({ action: 'searchHistory', query }, (response) => {
        allResults.history = response.results || [];
        pendingResponses--;
        displayAllResults();
      });
    }

    if (prefs.savedTabs) {
      pendingResponses++;
      chrome.runtime.sendMessage({ action: 'searchSavedTabs', query }, (response) => {
        allResults.savedTabs = response.results || [];
        pendingResponses--;
        displayAllResults();
      });
    }

    if (prefs.tabContent) {
      pendingResponses++;
      chrome.runtime.sendMessage({ action: 'searchInsideTabs', query }, (response) => {
        allResults.tabContent = response.results || [];
        pendingResponses--;
        displayAllResults();
      });
    }

    // If no searches were initiated, show empty message
    if (pendingResponses === 0) {
      let emptyMessage = document.createElement('li');
      emptyMessage.textContent = 'No search areas selected';
      emptyMessage.className = 'empty-message';
      resultsList.appendChild(emptyMessage);
    }
  });
});

document.getElementById('groupTabs').addEventListener('click', function () {
  chrome.runtime.sendMessage({ action: "groupTabs" }, (response) => {
    console.log("Grouped Tabs:", response.groupedTabs);
  });
});

// Add event listeners for new buttons
document.getElementById('ungroupTabs')?.addEventListener('click', function() {
  chrome.runtime.sendMessage({ action: "ungroupTabs" }, (response) => {
    if (response.success) {
      console.log("Tabs ungrouped successfully");
    } else if (response.error) {
      console.error("Error ungrouping tabs:", response.error);
    }
  });
});

document.getElementById('allTabs')?.addEventListener('click', function() {
  chrome.runtime.sendMessage({ action: "getAllTabs" }, (response) => {
    if (response.tabs) {
      displayTabs(response.tabs, 'allTabs');
    }
  });
});

document.getElementById('recentTabs')?.addEventListener('click', function() {
  chrome.runtime.sendMessage({ action: "getRecentTabs" }, (response) => {
    if (response.tabs) {
      displayTabs(response.tabs, 'recentTabs');
    }
  });
});

document.getElementById('savedTabs')?.addEventListener('click', function() {
  chrome.runtime.sendMessage({ action: "getSavedTabs" }, (response) => {
    if (response.savedTabs) {
      displayTabs(response.savedTabs, 'savedTabs');
    }
  });
});

document.getElementById('history')?.addEventListener('click', function() {
  chrome.runtime.sendMessage({ 
    action: "searchHistory",
    query: "" // Empty query to get recent history
  }, (response) => {
    if (response.results) {
      displayHistory(response.results, 'history');
    }
  });
});

// Add collapsible section functionality
document.addEventListener('DOMContentLoaded', () => {
  const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
  collapsibleHeaders.forEach(header => {
    const contentId = header.getAttribute('aria-controls');
    const content = document.getElementById(contentId);
    
    if (content) {
      content.style.display = 'none'; // Initialize content as hidden
    }
    
    header.addEventListener('click', () => {
      const isExpanded = header.getAttribute('aria-expanded') === 'true';
      header.setAttribute('aria-expanded', (!isExpanded).toString());
      
      if (content) {
        content.style.display = !isExpanded ? 'block' : 'none';
        
        if (!isExpanded) {
          // Dynamically load content based on section
          const sectionType = contentId.replace('Section', '');
          switch(sectionType) {
            case 'allTabs':
              chrome.runtime.sendMessage({ action: 'getAllTabs' }, (response) => {
                if (response.tabs) {
                  displayTabs(response.tabs, contentId);
                }
              });
              break;
            case 'recentTabs':
              chrome.runtime.sendMessage({ action: 'getRecentTabs' }, (response) => {
                if (response.tabs) {
                  displayTabs(response.tabs, contentId);
                }
              });
              break;
            case 'savedTabs':
              chrome.runtime.sendMessage({ action: 'getSavedTabs' }, (response) => {
                if (response.savedTabs) {
                  displayTabs(response.savedTabs, contentId);
                }
              });
              break;
            case 'history':
              chrome.runtime.sendMessage({ 
                action: 'searchHistory',
                query: '' // Empty query to get recent history
              }, (response) => {
                if (response.results) {
                  displayHistory(response.results, contentId);
                }
              });
              break;
          }
        }
      }
    });
  });
});

const searchQuery = document.getElementById('search');
const searchInsideCheckbox = document.getElementById('searchInsideTabs');
const contentResults = document.getElementById('results');

// Function to run content search
function runContentSearch() {
  const query = searchQuery.value.trim();
  if (!query) {
    contentResults.innerHTML = "";
    return;
  }
  chrome.runtime.sendMessage({ action: "searchInsideTabs", query }, (response) => {
    contentResults.innerHTML = "";
    response.results.forEach(result => {
      // Create a list item for the tab title
      let li = document.createElement('li');
      li.textContent = result.title;
      
      // Create a sub-list for all match snippets
      let ul = document.createElement('ul');
      result.matches.forEach((match, occurrenceIndex) => {
        let snippetLi = document.createElement('li');
        snippetLi.textContent = match.snippet;
        snippetLi.style.cursor = "pointer";
        
        snippetLi.addEventListener('click', function() {
          // Send a message to scroll to the specific match occurrence
          chrome.tabs.sendMessage(result.tabId, { action: "scrollToMatch", query, matchNumber: occurrenceIndex }, (resp) => {
            if (resp && resp.scrolled) {
              console.log("Scrolled to match");
            } else {
              console.error("Failed to scroll to match");
            }
          });
        });
        ul.appendChild(snippetLi);
      });
      
      li.appendChild(ul);
      // Clicking the tab title brings that tab into focus
      li.onclick = () => chrome.tabs.update(result.tabId, { active: true });
      contentResults.appendChild(li);
    });
  });
}

// When the checkbox is toggled, run or clear the search
searchInsideCheckbox.addEventListener('change', function () {
  if (this.checked) {
    runContentSearch();
  } else {
    contentResults.innerHTML = "";
  }
});

// Also listen for input changes; if the checkbox is checked, run the search on query update
searchQuery.addEventListener('input', function () {
  if (searchInsideCheckbox.checked) {
    runContentSearch();
  }
});


