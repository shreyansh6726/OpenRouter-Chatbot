const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const OPEN_ROUTER_API = process.env.OPEN_ROUTER_API;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

app.use(cors());
app.use(express.json({ limit: '12mb' }));

const performWebSearch = async (query) => {
  try {
    // 1) DuckDuckGo Instant Answer (no key)
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const ddgRes = await fetch(ddgUrl, { headers: { Accept: 'application/json' } });
      if (ddgRes.ok) {
        const ddg = await ddgRes.json();
        const items = [];
        if (ddg.AbstractText) {
          items.push({ title: ddg.Heading || query, link: ddg.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`, snippet: ddg.AbstractText, source: 'DuckDuckGo' });
        }
        if (Array.isArray(ddg.RelatedTopics) && ddg.RelatedTopics.length) {
          for (const t of ddg.RelatedTopics.slice(0, 3)) {
            const text = t.Text || (t.Topics && t.Topics[0] && t.Topics[0].Text);
            const firstUrl = t.FirstURL || (t.Topics && t.Topics[0] && t.Topics[0].FirstURL) || null;
            if (text) items.push({ title: t.Name || ddg.Heading || query, link: firstUrl || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`, snippet: text, source: 'DuckDuckGo' });
          }
        }
        if (items.length) return items.slice(0, 3);
      }
    } catch (e) {
      console.warn('DuckDuckGo search failed:', e.message || e);
    }

    // 2) Wikipedia search (no key)
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3&srprop=snippet`;
      const wikiRes = await fetch(wikiUrl, { headers: { Accept: 'application/json', 'User-Agent': 'sample-chatbot/1.0' } });
      if (wikiRes.ok) {
        const wiki = await wikiRes.json();
        const hits = wiki.query?.search || [];
        if (hits.length) {
          return hits.map(h => ({ title: h.title, link: `https://en.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}`, snippet: (h.snippet || '').replace(/<[^>]+>/g, ''), source: 'Wikipedia' }));
        }
      }
    } catch (e) {
      console.warn('Wikipedia search failed:', e.message || e);
    }

    // 3) Reddit search (no key)
    try {
      const redditUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=3&type=link`;
      const redditRes = await fetch(redditUrl, { headers: { Accept: 'application/json', 'User-Agent': 'sample-chatbot/1.0' } });
      if (redditRes.ok) {
        const rd = await redditRes.json();
        const posts = rd.data?.children || [];
        if (posts.length) {
          return posts.map(p => ({ title: p.data.title, link: `https://reddit.com${p.data.permalink}`, snippet: (p.data.selftext || p.data.url || '').substring(0, 300), source: 'Reddit' }));
        }
      }
    } catch (e) {
      console.warn('Reddit search failed:', e.message || e);
    }

    return null;
  } catch (error) {
    console.error('Web search error:', error);
    return null;
  }
};

const isCurrentQuery = (text) => {
  const currentKeywords = [
    'today', 'now', 'current', 'latest', 'recent', 'tomorrow', 'yesterday',
    'this week', 'this month', 'this year', '2024', '2025', '2026',
    'breaking', 'new', 'update', 'what happened', 'latest news',
    'who won', 'how much', 'what is the price', 'stock price', 'weather'
  ];
  
  return currentKeywords.some(keyword => text.toLowerCase().includes(keyword));
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/chat', async (req, res) => {
  try {
    if (!OPEN_ROUTER_API) {
      return res.status(500).json({ error: 'Missing OpenRouter API key.' });
    }

    const { message, messages, model, image } = req.body || {};
    const conversation = Array.isArray(messages) && messages.length > 0
      ? messages
      : [{ role: 'user', content: String(message || '').trim() }];

    if (!conversation[0] || !conversation[0].content) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const userMessage = conversation[conversation.length - 1];
    const hasImage = typeof image === 'string' && image.startsWith('data:image/');
    const userText = typeof userMessage.content === 'string' ? userMessage.content : String(userMessage.content || '');
    
    let systemPrompt = 'You are a helpful chatbot. Your knowledge was last updated in October 2023. If the user includes an image, analyze the image carefully and answer the user\'s question using only what is visible and relevant.';
    let enrichedContext = '';
    
    let searchResults = null;
    if (isCurrentQuery(userText)) {
      searchResults = await performWebSearch(userText);
      if (searchResults && searchResults.length > 0) {
        enrichedContext = '\n\n=== Current Web Search Results ===\n' + 
          searchResults.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   Source: ${r.link}`).join('\n\n');
        systemPrompt += '\n\nYou have access to current web search results below. Use them to provide up-to-date information beyond your training cutoff.';
      }
    }

    const userContent = hasImage
      ? [
          {
            type: 'text',
            text: String(userMessage.content || '').trim() || 'Analyze this image.'
          },
          {
            type: 'image_url',
            image_url: {
              url: image
            }
          }
        ]
      : String(userMessage.content || '').trim();

    const formattedMessages = conversation.map((item, index) => {
      if (index !== conversation.length - 1 || !hasImage) {
        return item;
      }

      return {
        role: item.role,
        content: userContent
      };
    });

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPEN_ROUTER_API}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Sample Chatbot'
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: systemPrompt + enrichedContext
          },
          ...formattedMessages
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const apiMessage = data?.error?.message || data?.message || 'OpenRouter request failed.';
      return res.status(response.status).json({ error: apiMessage });
    }

    const reply = data?.choices?.[0]?.message?.content || '';
    return res.json({ reply, raw: data, hasSearchContext: enrichedContext !== '', searchResults });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unexpected server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});