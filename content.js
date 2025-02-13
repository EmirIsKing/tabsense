// content.js

// Check if current URL is restricted (browser internal page)
function isRestrictedUrl(url) {
  const restrictedPatterns = [
    /^chrome:\/\//i,
    /^about:/i
  ];
  return restrictedPatterns.some(pattern => pattern.test(url));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Early check for restricted URLs
  if (isRestrictedUrl(window.location.href)) {
    sendResponse({ error: "Cannot perform operations on browser internal pages" });
    return true;
  }

  if (request.action === "searchInsideContent") {
    const pageText = document.body.innerText || "";
    
    let regex;
    try {
      // Use global and case-insensitive flags
      regex = new RegExp(request.query, "gi");
    } catch (e) {
      sendResponse({ error: "Invalid regex syntax" });
      return;
    }
    
    let match;
    const matches = [];
    
    // Loop through all matches and record a snippet for each
    while ((match = regex.exec(pageText)) !== null) {
      const index = match.index;
      // Extract a snippet: 50 characters before and after the match
      const snippet = pageText.substring(Math.max(0, index - 50), index + match[0].length + 50);
      matches.push({ snippet, index });
    }
    
    sendResponse({ found: matches.length > 0, matches });
    return true;
  }
  
  // New action: scroll to a specific match occurrence
  if (request.action === "scrollToMatch") {
    // Clear any existing selection and scroll to the top of the page
    window.getSelection().removeAllRanges();
    window.scrollTo(0, 0);
    
    // Use window.find() repeatedly until the desired occurrence is reached.
    // Note: window.find() finds the next occurrence each time it's called.
    let count = 0;
    let found = false;
    while (count < request.matchNumber + 1) { // if matchNumber is 0, need 1 call.
      found = window.find(request.query, false, false, false, false, false, false);
      if (!found) break;
      count++;
    }
    sendResponse({ scrolled: found });
    return true;
  }
  
  return true;
});
