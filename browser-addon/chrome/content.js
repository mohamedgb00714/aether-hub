/**
 * aethermsaid hub Browser Addon - Content Script
 * Runs in the context of web pages
 */

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getPageContent':
      sendResponse(getPageContent());
      break;
    case 'getSelection':
      sendResponse({ text: window.getSelection().toString() });
      break;
  }
  return true;
});

/**
 * Extract main content from the page
 */
function getPageContent() {
  // Try to get main content area
  const selectors = [
    'main',
    'article',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
    '.markdown-body',
    '.prose'
  ];
  
  let contentElement = null;
  for (const selector of selectors) {
    contentElement = document.querySelector(selector);
    if (contentElement) break;
  }
  
  // Fall back to body
  if (!contentElement) {
    contentElement = document.body;
  }
  
  // Clone and clean up
  const clone = contentElement.cloneNode(true);
  
  // Remove scripts, styles, and hidden elements
  const removeSelectors = [
    'script', 'style', 'noscript', 'iframe', 
    'nav', 'header', 'footer', 'aside',
    '[hidden]', '[aria-hidden="true"]',
    '.ad', '.advertisement', '.sidebar',
    '.comments', '.comment', '.share-buttons',
    '.social-share', '.newsletter', '.popup',
    '.modal', '.overlay', '.cookie-banner'
  ];
  
  removeSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });
  
  // Get clean text content
  const text = clone.textContent
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50000); // Limit to 50k chars
  
  return {
    content: text,
    title: document.title,
    url: window.location.href,
    description: document.querySelector('meta[name="description"]')?.content || '',
    author: document.querySelector('meta[name="author"]')?.content || ''
  };
}

console.log('🟢 aethermsaid hub content script loaded');
