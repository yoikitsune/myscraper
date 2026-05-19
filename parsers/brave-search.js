/**
 * Parser for Brave Search Ask conversations
 * URL pattern: search.brave.com/ask
 */

class BraveSearchParser {
  constructor() {
    this.name = 'Brave Search Ask';
    this.urlPattern = /search\.brave\.com\/ask/;
    this.capabilities = {
      thoughtProcess: false,
      sources: true,
      requiresSidebarOpen: false
    };
  }

  isMatch(url) {
    return this.urlPattern.test(url);
  }

  extract() {
    const messages = [];
    
    // Find conversation rounds - each round has a user query and AI response
    const rounds = document.querySelectorAll('.tap-round.is-complete, .tap-round.is-first.is-complete');
    
    rounds.forEach((round, index) => {
      // Extract user query
      const userBubble = round.querySelector('.user-bubble');
      const userMessage = round.querySelector('.message.user');
      
      let userText = '';
      if (userBubble) {
        userText = this.cleanText(userBubble.innerText);
      } else if (userMessage) {
        userText = this.cleanText(userMessage.innerText);
      }

      // Extract AI response
      const assistantMessage = round.querySelector('.message.assistant');
      const assistantQuickAnswer = round.querySelector('.message.quick-answer');
      
      let assistantText = '';
      let assistantType = 'assistant';
      
      if (assistantMessage) {
        assistantText = this.cleanText(assistantMessage.innerText);
      } else if (assistantQuickAnswer) {
        assistantText = this.cleanText(assistantQuickAnswer.innerText);
        assistantType = 'quick-answer';
      }

      // Add user message
      if (userText) {
        messages.push({
          role: 'user',
          content: userText,
          index: index
        });
      }

      // Extract sources from the assistant message and enrichment carousel
      let sources = [];
      const assistantElement = assistantMessage || assistantQuickAnswer;
      
      // Look for sources within the message itself
      if (assistantElement) {
        const sourceLinks = assistantElement.querySelectorAll('a[href]');
        sourceLinks.forEach(link => {
          const url = link.href;
          const title = this.cleanText(link.innerText) || url;
          if (url && !url.includes('brave.com') && !sources.find(s => s.url === url)) {
            sources.push({ title, url });
          }
        });
      }
      
      // Look for enrichment carousel (Brave Search sources) associated with this round
      const enrichmentCarousel = round.querySelector('.enrichment-carousel, [class*="enrichment"]');
      if (enrichmentCarousel) {
        const carouselLinks = enrichmentCarousel.querySelectorAll('a[href]');
        carouselLinks.forEach(link => {
          const url = link.href;
          const title = this.cleanText(link.innerText) || url;
          if (url && !url.includes('brave.com') && !sources.find(s => s.url === url)) {
            sources.push({ title, url });
          }
        });
      }
      
      // Alternative: look for all links in the round that are not in user messages
      const roundLinks = round.querySelectorAll('a[href]');
      roundLinks.forEach(link => {
        const url = link.href;
        if (link.closest('.user-bubble, .message.user')) return;
        if (url && !url.includes('brave.com') && !sources.find(s => s.url === url)) {
          const title = this.cleanText(link.innerText) || url;
          sources.push({ title, url });
        }
      });

      // Add assistant message
      if (assistantText) {
        messages.push({
          role: 'assistant',
          content: assistantText,
          type: assistantType,
          index: index,
          sources: sources
        });
      }
    });

    // If no rounds found, try alternative selectors
    if (messages.length === 0) {
      return this.extractAlternative();
    }

    return {
      site: this.name,
      url: window.location.href,
      title: document.title,
      date: new Date().toISOString(),
      messages: messages
    };
  }

  extractAlternative() {
    const messages = [];
    
    // Try finding all message elements directly
    const allMessages = document.querySelectorAll('.message');
    let index = 0;
    
    allMessages.forEach((msg) => {
      const isUser = msg.classList.contains('user');
      const isAssistant = msg.classList.contains('assistant') || msg.classList.contains('llm-output');
      
      if (isUser) {
        messages.push({
          role: 'user',
          content: this.cleanText(msg.innerText),
          index: index++
        });
      } else if (isAssistant) {
        // Extract sources from message and surrounding context
        const sources = [];
        
        // Links within the message
        const sourceLinks = msg.querySelectorAll('a[href]');
        sourceLinks.forEach(link => {
          const url = link.href;
          const title = this.cleanText(link.innerText) || url;
          if (url && !url.includes('brave.com') && !sources.find(s => s.url === url)) {
            sources.push({ title, url });
          }
        });
        
        // Look for enrichment carousel as sibling or within parent
        const parentRound = msg.closest('.tap-round');
        if (parentRound) {
          const enrichmentLinks = parentRound.querySelectorAll('.enrichment-carousel a[href], [class*="enrichment"] a[href]');
          enrichmentLinks.forEach(link => {
            const url = link.href;
            const title = this.cleanText(link.innerText) || url;
            if (url && !url.includes('brave.com') && !sources.find(s => s.url === url)) {
              sources.push({ title, url });
            }
          });
        }

        messages.push({
          role: 'assistant',
          content: this.cleanText(msg.innerText),
          type: msg.classList.contains('quick-answer') ? 'quick-answer' : 'assistant',
          index: index,
          sources: sources
        });
      }
    });

    return {
      site: this.name,
      url: window.location.href,
      title: document.title,
      date: new Date().toISOString(),
      messages: messages
    };
  }

  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/\n\s*\n/g, '\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();
  }

  toMarkdown(data, config = {}) {
    const username = config.username || 'Utilisateur';
    const includeSources = config.includeSources || false;
    
    let md = `# ${data.title}\n\n`;
    md += `**Site**: ${data.site}\n`;
    md += `**URL**: ${data.url}\n`;
    md += `**Date**: ${data.date}\n\n`;
    md += `---\n\n`;

    data.messages.forEach((msg) => {
      if (msg.role === 'user') {
        md += `## ${username}\n\n${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        md += `## Brave AI${msg.type === 'quick-answer' ? ' (Réponse rapide)' : ''}\n\n${msg.content}\n\n`;
        
        // Include sources if enabled and available
        if (includeSources && msg.sources && msg.sources.length > 0) {
          md += `### Sources\n\n`;
          msg.sources.forEach((source, index) => {
            md += `${index + 1}. [${source.title}](${source.url})\n`;
          });
          md += `\n`;
        }
      }
      md += `---\n\n`;
    });

    return md;
  }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BraveSearchParser;
}
