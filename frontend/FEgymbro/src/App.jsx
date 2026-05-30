import { useState, useEffect, useRef } from 'react';
import { 
  Dumbbell, 
  Flame, 
  Trophy, 
  Send, 
  Trash2, 
  Plus, 
  Minus, 
  RotateCcw, 
  AlertCircle, 
  Activity, 
  TrendingUp, 
  Utensils,
  Coffee,
  Check,
  Menu,
  X,
  MessageSquare
} from 'lucide-react';
import './App.css';

// Base API Endpoint Configuration
const API_URL = 'http://localhost:8000/api/chat';

function App() {
  // --- STATE ---
  
  // Collapsible Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    // Default open on desktop, closed on mobile
    return window.innerWidth > 900;
  });

  // Multiple Sessions State
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('gymbro_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse sessions", e);
      }
    }
    return [
      {
        id: 'session-default',
        title: 'Workout Session 1',
        messages: []
      }
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = localStorage.getItem('gymbro_active_session_id');
    return saved || 'session-default';
  });

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamText, setCurrentStreamText] = useState('');
  const [error, setError] = useState(null);
  
  // Workout widgets state (Global or session-specific? Global makes sense for daily goals!)
  const [streak, setStreak] = useState(() => {
    const saved = localStorage.getItem('gymbro_streak');
    return saved ? parseInt(saved, 10) : 3;
  });
  
  const [prs, setPrs] = useState(() => {
    const saved = localStorage.getItem('gymbro_prs');
    return saved ? JSON.parse(saved) : { bench: 225, squat: 315, deadlift: 405 };
  });

  const [macros, setMacros] = useState(() => {
    const saved = localStorage.getItem('gymbro_macros');
    return saved ? JSON.parse(saved) : {
      proteinGoal: 180,
      proteinCurrent: 90,
      kcalGoal: 2800,
      kcalCurrent: 1650
    };
  });

  // Reference for auto-scrolling
  const messagesEndRef = useRef(null);

  // --- DERIVED STATE ---
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || {
    id: 'session-default',
    title: 'Workout Session 1',
    messages: []
  };
  const messages = activeSession.messages || [];

  // Handle window resizing to auto-collapse sidebar if below mobile threshold
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 900) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => {
    localStorage.setItem('gymbro_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('gymbro_active_session_id', activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    localStorage.setItem('gymbro_streak', streak.toString());
  }, [streak]);

  useEffect(() => {
    localStorage.setItem('gymbro_prs', JSON.stringify(prs));
  }, [prs]);

  useEffect(() => {
    localStorage.setItem('gymbro_macros', JSON.stringify(macros));
  }, [macros]);

  // Scroll to bottom effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamText]);

  // --- SESSIONS HANDLERS ---
  
  const createNewSession = () => {
    const newId = `session-${Date.now()}`;
    const newSession = {
      id: newId,
      title: `Chat Session ${sessions.length + 1}`,
      messages: []
    };
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newId);
    setError(null);
    setInput('');
    // Auto close sidebar on mobile when creating/switching sessions
    if (window.innerWidth <= 900) {
      setIsSidebarOpen(false);
    }
  };

  const deleteSession = (sessionId, e) => {
    e.stopPropagation(); // Avoid selecting the deleted session
    
    if (sessions.length === 1) {
      // If last session, just reset it
      setSessions([
        {
          id: 'session-default',
          title: 'Workout Session 1',
          messages: []
        }
      ]);
      setActiveSessionId('session-default');
      return;
    }

    const remainingSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(remainingSessions);
    
    if (activeSessionId === sessionId) {
      setActiveSessionId(remainingSessions[0].id);
    }
  };

  // --- CHAT HANDLERS ---

  // Helper to update active session messages
  const updateActiveSessionMessages = (newMessages) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: newMessages };
      }
      return s;
    }));
  };

  // Helper to update active session title (auto-rename on first message)
  const renameActiveSessionIfNeeded = (firstUserMessage) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId && (s.title.startsWith('Chat Session ') || s.title.startsWith('New Session'))) {
        // Auto-extract first 4 words
        const words = firstUserMessage.split(' ');
        const cleanTitle = words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');
        return { ...s, title: cleanTitle };
      }
      return s;
    }));
  };

  // Handle input submit
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);
    
    // Auto-rename session if it's the first message
    if (messages.length === 0) {
      renameActiveSessionIfNeeded(userMessage);
    }

    // Add user message to list
    const userMsgObj = {
      id: Date.now(),
      sender: 'user',
      text: userMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    const updatedMessages = [...messages, userMsgObj];
    updateActiveSessionMessages(updatedMessages);
    setIsStreaming(true);
    setCurrentStreamText('');

    try {
      // Connect to FastAPI backend
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage })
      });

      if (!response.ok) {
        throw new Error(`Server returned code ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamAccumulator = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        streamAccumulator += chunk;
        setCurrentStreamText(streamAccumulator);
      }

      // Finish streaming, add gymbro response to history
      const gymBroMsgObj = {
        id: Date.now() + 1,
        sender: 'gymbro',
        text: streamAccumulator || "Crushing it! (No response token)",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      updateActiveSessionMessages([...updatedMessages, gymBroMsgObj]);
      setCurrentStreamText('');
      
      // Increment streak occasionally as positive reinforcement
      if (Math.random() > 0.6) {
        setStreak(prev => prev + 1);
      }

    } catch (err) {
      console.error(err);
      setError("GymBro is taking a water break (Backend is offline). Spin up the FastAPI server to start chatting!");
    } finally {
      setIsStreaming(false);
    }
  };

  // Trigger quick suggestion chip
  const handleSuggestionClick = (suggestionText) => {
    if (isStreaming) return;
    setInput(suggestionText);
    setTimeout(() => {
      const form = document.getElementById('chat-form');
      form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }, 50);
  };

  // Reset chat history
  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear this workout session log?")) {
      updateActiveSessionMessages([]);
      setError(null);
    }
  };

  // PR update helper
  const handlePrChange = (lift, value) => {
    const parsedVal = parseInt(value, 10);
    setPrs(prev => ({
      ...prev,
      [lift]: isNaN(parsedVal) ? 0 : parsedVal
    }));
  };

  // Macro logging helper
  const adjustMacro = (type, amount) => {
    setMacros(prev => {
      if (type === 'protein') {
        return {
          ...prev,
          proteinCurrent: Math.max(0, prev.proteinCurrent + amount)
        };
      } else {
        return {
          ...prev,
          kcalCurrent: Math.max(0, prev.kcalCurrent + amount)
        };
      }
    });
  };

  const resetMacros = () => {
    setMacros(prev => ({
      ...prev,
      proteinCurrent: 0,
      kcalCurrent: 0
    }));
  };

  // --- SIMPLE MARKDOWN PARSING ENGINE ---
  const parseInlineMarkdown = (text, key) => {
    if (!text) return '';
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={`${key}-bold-${i}`}>{part}</strong>;
      }
      
      const subParts = part.split(/`([^`]+)`/g);
      return subParts.map((subPart, j) => {
        if (j % 2 === 1) {
          return <code key={`${key}-code-${i}-${j}`}>{subPart}</code>;
        }
        return subPart;
      });
    });
  };

  const parseMarkdown = (text) => {
    if (!text) return '';
    
    const lines = text.split('\n');
    let inList = false;
    let listItems = [];
    const elements = [];
    
    lines.forEach((line, index) => {
      const bulletMatch = line.match(/^[-*]\s+(.*)/);
      if (bulletMatch) {
        if (!inList) {
          inList = true;
          listItems = [];
        }
        listItems.push(parseInlineMarkdown(bulletMatch[1], `li-${index}`));
      } else {
        if (inList) {
          elements.push(
            <ul key={`ul-${index}`}>
              {listItems.map((li, i) => <li key={i}>{li}</li>)}
            </ul>
          );
          inList = false;
        }
        
        if (line.trim() === '') {
          return;
        }
        
        elements.push(
          <p key={`p-${index}`}>
            {parseInlineMarkdown(line, `inline-${index}`)}
          </p>
        );
      }
    });
    
    if (inList) {
      elements.push(
        <ul key="ul-end">
          {listItems.map((li, i) => <li key={i}>{li}</li>)}
        </ul>
      );
    }
    
    return elements;
  };

  // --- RENDER ---
  return (
    <div className="app-container">
      
      {/* MOBILE BACKDROP OVERLAY */}
      {isSidebarOpen && window.innerWidth <= 900 && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* SIDEBAR: DASHBOARD & CHAT SESSIONS */}
      <aside className={`sidebar ${isSidebarOpen ? 'expanded' : 'collapsed'}`}>
        
        {/* LOGO & CLOSE BUTTON FOR MOBILE */}
        <div className="logo-area" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="logo-section">
              <Dumbbell className="logo-icon" size={32} strokeWidth={2.5} />
              <h1>GYMBRO.AI</h1>
            </div>
            <div className="logo-subtitle">Fuel the Gains</div>
          </div>
          {window.innerWidth <= 900 && (
            <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)}>
              <X size={20} />
            </button>
          )}
        </div>

        {/* WORKOUT CHAT SESSIONS */}
        <div className="widget-card sessions-widget">
          <div className="widget-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={16} />
              <span>Chat Sessions</span>
            </div>
            <button className="new-session-btn" onClick={createNewSession} title="New Workout Log">
              <Plus size={16} />
            </button>
          </div>

          <div className="sessions-list">
            {sessions.map(s => (
              <div 
                key={s.id} 
                className={`session-item ${s.id === activeSessionId ? 'active' : ''}`}
                onClick={() => {
                  setActiveSessionId(s.id);
                  if (window.innerWidth <= 900) {
                    setIsSidebarOpen(false);
                  }
                }}
              >
                <MessageSquare size={14} className="session-icon" />
                <span className="session-title">{s.title}</span>
                <button 
                  className="session-delete-btn" 
                  onClick={(e) => deleteSession(s.id, e)} 
                  title="Delete Log"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* STREAK WIDGET */}
        <div className="widget-card streak-widget">
          <div className="streak-count">
            <span className="streak-number">{streak}</span>
            <div>
              <div className="streak-label">Active Streak</div>
              <div className="streak-label" style={{color: 'var(--accent-lime)', fontSize: '0.7rem', fontWeight: 700}}>CRUSHING IT</div>
            </div>
          </div>
          <Flame className="streak-fire-icon" size={32} fill="var(--accent-orange)" strokeWidth={1} />
        </div>

        {/* PROTEIN & MACROS TARGET */}
        <div className="widget-card">
          <div className="widget-title">
            <Utensils size={16} />
            <span>Daily Fuel Target</span>
          </div>
          
          <div className="macro-grid">
            <div className="macro-item">
              <div className="macro-header">
                <span>Protein Goal</span>
                <span className="macro-val protein">{macros.proteinCurrent}g / {macros.proteinGoal}g</span>
              </div>
              <div className="macro-progress-bg">
                <div 
                  className="macro-progress-fill protein" 
                  style={{ width: `${Math.min(100, (macros.proteinCurrent / macros.proteinGoal) * 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="macro-item">
              <div className="macro-header">
                <span>Energy Intake</span>
                <span className="macro-val kcal">{macros.kcalCurrent} kcal / {macros.kcalGoal} kcal</span>
              </div>
              <div className="macro-progress-bg">
                <div 
                  className="macro-progress-fill kcal" 
                  style={{ width: `${Math.min(100, (macros.kcalCurrent / macros.kcalGoal) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="macro-controls">
            <button className="macro-btn" onClick={() => { adjustMacro('protein', 30); adjustMacro('kcal', 150); }}>
              <Plus size={12} /> Shake (+30g P)
            </button>
            <button className="macro-btn" onClick={() => { adjustMacro('protein', 40); adjustMacro('kcal', 650); }}>
              <Plus size={12} /> Chicken (+40g P)
            </button>
            <button className="macro-btn" onClick={resetMacros} title="Reset Macros">
              <RotateCcw size={12} />
            </button>
          </div>
        </div>

        {/* PERSONAL RECORDS (PR) */}
        <div className="widget-card">
          <div className="widget-title">
            <Trophy size={16} />
            <span>Personal Records</span>
          </div>
          
          <div className="pr-grid">
            <div className="pr-item">
              <span className="pr-name">Bench Press 🏋️</span>
              <div className="pr-input-wrapper">
                <input 
                  type="number" 
                  className="pr-input" 
                  value={prs.bench} 
                  onChange={(e) => handlePrChange('bench', e.target.value)} 
                />
                <span className="pr-unit">lbs</span>
              </div>
            </div>

            <div className="pr-item">
              <span className="pr-name">Squat 🦵</span>
              <div className="pr-input-wrapper">
                <input 
                  type="number" 
                  className="pr-input" 
                  value={prs.squat} 
                  onChange={(e) => handlePrChange('squat', e.target.value)} 
                />
                <span className="pr-unit">lbs</span>
              </div>
            </div>

            <div className="pr-item">
              <span className="pr-name">Deadlift 🚀</span>
              <div className="pr-input-wrapper">
                <input 
                  type="number" 
                  className="pr-input" 
                  value={prs.deadlift} 
                  onChange={(e) => handlePrChange('deadlift', e.target.value)} 
                />
                <span className="pr-unit">lbs</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{marginTop: 'auto', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)'}}>
          GymBro AI Client v1.2
        </div>
      </aside>

      {/* CHAT MAIN INTERFACE AREA */}
      <main className="chat-area">
        
        {/* CHAT HEADER */}
        <header className="chat-header">
          <div className="chat-header-info">
            <button 
              className="sidebar-toggle-btn" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? "Collapse Dashboard" : "Expand Dashboard"}
            >
              <Menu size={20} />
            </button>
            <div className="coach-status-dot"></div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="coach-name">GymBro AI</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-orange)', fontWeight: 700 }}>• {activeSession.title}</span>
              </div>
              <div className="coach-status-text">Active & Motivated</div>
            </div>
          </div>
          {messages.length > 0 && (
            <button className="clear-chat-btn" onClick={handleClearChat}>
              <Trash2 size={14} /> Clear Log
            </button>
          )}
        </header>

        {/* CHAT BUBBLES */}
        <section className="messages-container">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-icon-box">
                <Coffee size={40} />
              </div>
              <h2>WELCOME TO THE <span>GAINS ZONE</span></h2>
              <p>
                I am your coach <strong>GymBro</strong>. Tell me your workout plans, ask me about macros, or let's break down your plateau. No sugarcoating, just pure gains. What are we lifting today?
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`message-row ${msg.sender}`}>
                <div className="message-bubble">
                  {msg.sender === 'gymbro' ? parseMarkdown(msg.text) : <p>{msg.text}</p>}
                  <span className="message-meta">{msg.timestamp}</span>
                </div>
              </div>
            ))
          )}

          {/* ACTIVE STREAM */}
          {currentStreamText && (
            <div className="message-row gymbro">
              <div className="message-bubble">
                {parseMarkdown(currentStreamText)}
                <span className="message-meta">Streaming...</span>
              </div>
            </div>
          )}

          {/* LOADING STATE */}
          {isStreaming && !currentStreamText && (
            <div className="message-row gymbro">
              <div className="message-bubble" style={{padding: '0.75rem 1rem'}}>
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </section>

        {/* INPUT AREA */}
        <section className="input-section">
          
          {error && (
            <div className="error-banner">
              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
              <button className="error-banner-btn" onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}

          {!isStreaming && (
            <div className="suggestion-container">
              <button 
                className="suggestion-chip" 
                onClick={() => handleSuggestionClick("Give me a fast, intense 45-min Push routine")}
              >
                💪 Push Routine
              </button>
              <button 
                className="suggestion-chip" 
                onClick={() => handleSuggestionClick("How do I compute my daily target protein amount?")}
              >
                🍗 Target Protein
              </button>
              <button 
                className="suggestion-chip" 
                onClick={() => handleSuggestionClick("Stuck on my Bench Press PR of 225lbs. Help me break it.")}
              >
                🏋️ Break PR Plateau
              </button>
              <button 
                className="suggestion-chip" 
                onClick={() => handleSuggestionClick("I don't feel like lifting today. Hypeme up right now!")}
              >
                🔥 Motivational Spark
              </button>
            </div>
          )}

          <form id="chat-form" className="chat-form" onSubmit={handleSubmit}>
            <div className="input-wrapper">
              <input 
                type="text" 
                className="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your coach anything... (e.g. 'Push day plan', 'How to squat')"
                disabled={isStreaming}
                autoFocus
              />
            </div>
            <button type="submit" className="send-btn" disabled={isStreaming || !input.trim()}>
              <Send size={18} />
            </button>
          </form>
          
        </section>

      </main>

    </div>
  );
}

export default App;
