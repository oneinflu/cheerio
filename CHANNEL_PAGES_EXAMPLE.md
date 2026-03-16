# Channel Pages - Implementation Examples

## Complete Integration Example

### 1. Main App Router Setup

```jsx
// App.jsx or Router.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import io from 'socket.io-client';

// Import channel pages
import TelegramPage from './components/TelegramPage';
import InstagramPage from './components/InstagramPage';
import DashboardPage from './components/DashboardPage';
import InboxPage from './components/InboxPage';

function App() {
  const [socket, setSocket] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [teamId, setTeamId] = useState(null);

  // Initialize Socket.io
  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  // Load user data
  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch('/api/user');
        const data = await res.json();
        setCurrentUser(data.user);
        setTeamId(data.user.teamIds?.[0]);
      } catch (err) {
        console.error('Failed to load user:', err);
      }
    };

    loadUser();
  }, []);

  if (!currentUser || !teamId) {
    return <div>Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage teamId={teamId} />} />
        <Route 
          path="/inbox" 
          element={<InboxPage socket={socket} currentUser={currentUser} teamId={teamId} />} 
        />
        <Route 
          path="/telegram" 
          element={<TelegramPage socket={socket} currentUser={currentUser} teamId={teamId} />} 
        />
        <Route 
          path="/instagram" 
          element={<InstagramPage socket={socket} currentUser={currentUser} teamId={teamId} />} 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### 2. Navigation Component

```jsx
// Navigation.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { MessageCircle, Instagram, Inbox, Home } from 'lucide-react';

export function Navigation() {
  return (
    <nav className="bg-white border-r border-slate-200 w-64 h-screen flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900">Messaging Hub</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-600'
                : 'text-slate-600 hover:bg-slate-50'
            }`
          }
        >
          <Home size={20} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/inbox"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-50 text-blue-600'
                : 'text-slate-600 hover:bg-slate-50'
            }`
          }
        >
          <Inbox size={20} />
          <span>All Conversations</span>
        </NavLink>

        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-500 px-4 mb-2">CHANNELS</p>

          <NavLink
            to="/telegram"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
              <MessageCircle size={14} className="text-white" />
            </div>
            <span>Telegram</span>
          </NavLink>

          <NavLink
            to="/instagram"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-pink-50 text-pink-600'
                  : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center">
              <Instagram size={14} className="text-white" />
            </div>
            <span>Instagram</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
```

### 3. Layout Component

```jsx
// Layout.jsx
import React from 'react';
import { Navigation } from './Navigation';

export function Layout({ children }) {
  return (
    <div className="flex h-screen bg-slate-50">
      <Navigation />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
```

### 4. Complete App with Layout

```jsx
// App.jsx (Updated)
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import io from 'socket.io-client';

import { Layout } from './components/Layout';
import TelegramPage from './components/TelegramPage';
import InstagramPage from './components/InstagramPage';
import DashboardPage from './components/DashboardPage';
import InboxPage from './components/InboxPage';

function App() {
  const [socket, setSocket] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Socket.io
  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  // Load user data
  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch('/api/user');
        if (!res.ok) throw new Error('Failed to load user');
        
        const data = await res.json();
        setCurrentUser(data.user);
        setTeamId(data.user.teamIds?.[0]);
      } catch (err) {
        console.error('Failed to load user:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !teamId) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <p className="text-slate-600">Failed to load user data</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage teamId={teamId} />} />
          <Route 
            path="/inbox" 
            element={<InboxPage socket={socket} currentUser={currentUser} teamId={teamId} />} 
          />
          <Route 
            path="/telegram" 
            element={<TelegramPage socket={socket} currentUser={currentUser} teamId={teamId} />} 
          />
          <Route 
            path="/instagram" 
            element={<InstagramPage socket={socket} currentUser={currentUser} teamId={teamId} />} 
          />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
```

## Usage Patterns

### Pattern 1: Direct Navigation

```jsx
// Navigate to Telegram page
import { useNavigate } from 'react-router-dom';

function SomeComponent() {
  const navigate = useNavigate();

  return (
    <button onClick={() => navigate('/telegram')}>
      Go to Telegram
    </button>
  );
}
```

### Pattern 2: Conditional Rendering

```jsx
// Show different pages based on channel
function ChannelRouter({ channel, socket, currentUser, teamId }) {
  switch (channel) {
    case 'telegram':
      return <TelegramPage socket={socket} currentUser={currentUser} teamId={teamId} />;
    case 'instagram':
      return <InstagramPage socket={socket} currentUser={currentUser} teamId={teamId} />;
    default:
      return <InboxPage socket={socket} currentUser={currentUser} teamId={teamId} />;
  }
}
```

### Pattern 3: With Context

```jsx
// Using React Context for global state
import { createContext, useContext } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [teamId, setTeamId] = useState(null);

  // ... initialization code ...

  return (
    <AppContext.Provider value={{ socket, currentUser, teamId }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

// Usage in components
function TelegramPageWrapper() {
  const { socket, currentUser, teamId } = useApp();
  return <TelegramPage socket={socket} currentUser={currentUser} teamId={teamId} />;
}
```

## Advanced Features

### Custom Hooks

```jsx
// useTelegramConversations.js
import { useState, useEffect } from 'react';
import { getInbox } from '../api';

export function useTelegramConversations(teamId, filter) {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setIsLoading(true);
        const res = await getInbox(teamId, filter);
        const telegramConvs = res.conversations.filter(
          c => c.channelType === 'telegram'
        );
        setConversations(telegramConvs);
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, [teamId, filter]);

  return { conversations, isLoading, error };
}

// Usage
function MyComponent() {
  const { conversations, isLoading } = useTelegramConversations(teamId, 'open');
  // ...
}
```

### Error Boundary

```jsx
// ErrorBoundary.jsx
import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Something went wrong</h1>
            <p className="text-slate-600">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
<ErrorBoundary>
  <TelegramPage {...props} />
</ErrorBoundary>
```

## Testing Examples

### Unit Test

```jsx
// TelegramPage.test.jsx
import { render, screen } from '@testing-library/react';
import TelegramPage from './TelegramPage';

describe('TelegramPage', () => {
  it('renders Telegram header', () => {
    const mockSocket = { on: jest.fn(), off: jest.fn() };
    const mockUser = { id: '1', name: 'Test User' };

    render(
      <TelegramPage 
        socket={mockSocket} 
        currentUser={mockUser} 
        teamId="team-1" 
      />
    );

    expect(screen.getByText('Telegram')).toBeInTheDocument();
  });

  it('filters conversations by telegram channel', async () => {
    // Test implementation
  });
});
```

## Performance Optimization

### Memoization

```jsx
import { memo } from 'react';

const ConversationItem = memo(({ conversation, isSelected, onSelect }) => {
  return (
    <div onClick={() => onSelect(conversation.id)}>
      {conversation.contactName}
    </div>
  );
});

export default ConversationItem;
```

### Lazy Loading

```jsx
import { lazy, Suspense } from 'react';

const TelegramPage = lazy(() => import('./TelegramPage'));
const InstagramPage = lazy(() => import('./InstagramPage'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/telegram" element={<TelegramPage {...props} />} />
        <Route path="/instagram" element={<InstagramPage {...props} />} />
      </Routes>
    </Suspense>
  );
}
```

---

These examples show various ways to integrate and use the channel pages in your application. Choose the pattern that best fits your architecture.
