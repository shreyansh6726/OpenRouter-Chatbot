import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './App.css';

const starterMessages = [
  {
    role: 'assistant',
    content: 'Ask anything and I will answer through OpenRouter.'
  }
]

function App() {
  const [messages, setMessages] = useState(starterMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [lastSearchUsed, setLastSearchUsed] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const conversationCount = useMemo(
    () => messages.filter((message) => message.role === 'user').length,
    [messages]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();

    const messageText = input.trim();
    if ((!messageText && !selectedImage) || loading) {
      return;
    }

    const userDisplayText = messageText || 'Analyze this image.';
    const nextMessages = [
      ...messages,
      {
        role: 'user',
        content: userDisplayText,
        imageName: selectedImage?.name || null
      }
    ];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: messageText,
          messages: nextMessages,
          image: selectedImage?.dataUrl || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Chat request failed.');
      }

      setLastSearchUsed(data.hasSearchContext || false);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: 'assistant',
          content: data.reply || 'No response returned.',
          hasSearch: data.hasSearchContext || false,
          searchResults: data.searchResults || null
        }
      ]);
      setSelectedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedImage(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setSelectedImage({
        name: file.name,
        type: file.type,
        dataUrl: String(reader.result || '')
      });
      setError('');
    };

    reader.onerror = () => {
      setError('Could not read the selected image.');
    };

    reader.readAsDataURL(file);
  };

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Express + React + OpenRouter</p>
          <h1>Chatbot Studio</h1>
          <p className="subcopy">
            A compact full-stack chatbot wired with an Express API and a Create React App frontend.
          </p>
        </div>

        <div className="stats-row" aria-label="Conversation stats">
          <div className="stat-pill">
            <span className="stat-value">{conversationCount}</span>
            <span className="stat-label">messages</span>
          </div>
          <div className="stat-pill subtle">
            <span className="stat-value">{loading ? 'live' : 'ready'}</span>
            <span className="stat-label">status</span>
          </div>
        </div>
      </section>

      <section className="chat-panel" aria-label="Chatbot">
        <div className="messages" role="log" aria-live="polite">
          {messages.map((message, index) => (
            <article
              key={`${message.role}-${index}`}
              className={`message-bubble ${message.role}`}
            >
              <span className="message-role">{message.role === 'user' ? 'You' : 'Assistant'}</span>
              <div className="message-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ node, ...props }) => (
                      <a {...props} target="_blank" rel="noopener noreferrer" />
                    )
                  }}
                >
                  {String(message.content)}
                </ReactMarkdown>
              </div>
              {message.role === 'user' && message.imageName && (
                <div className="message-image-tag">Image attached: {message.imageName}</div>
              )}
              {message.role === 'assistant' && message.hasSearch && (
                <div className="message-search-tag">
                  <span>🔍</span> Web search used
                </div>
              )}

              {message.role === 'assistant' && message.searchResults && (
                <div className="search-result-list">
                  {message.searchResults.map((r, i) => (
                    <div key={`sr-${i}`} className="search-result-item">
                      <a href={r.link} target="_blank" rel="noreferrer" className="search-result-title">{r.title}</a>
                      <div className="search-result-snippet">{r.snippet}</div>
                      <div className="search-result-source">Source: {r.source || r.link}</div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}

          {loading && (
            <article className="message-bubble assistant typing">
              <span className="message-role">Assistant</span>
              <p>Thinking...</p>
            </article>
          )}

          <div ref={bottomRef} />
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form className="composer" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="chat-input">
            Message
          </label>
          <textarea
            id="chat-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type a message for the chatbot..."
            rows="3"
            disabled={loading}
          />

          <div className="composer-actions">
            <label className="image-picker" htmlFor="chat-image">
              <input
                ref={fileInputRef}
                id="chat-image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={loading}
              />
              <span>{selectedImage ? 'Change image' : 'Add image'}</span>
            </label>

            {selectedImage && (
              <div className="image-chip" title={selectedImage.name}>
                <span>{selectedImage.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  aria-label="Remove selected image"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          <button type="submit" disabled={loading || (!input.trim() && !selectedImage)}>
            {loading ? 'Sending...' : 'Send message'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default App;