# Channel-Specific Chat Pages

This document describes the dedicated chat pages for Telegram and Instagram channels.

## Overview

Two new dedicated pages have been created to provide channel-specific messaging interfaces:

- **TelegramPage.jsx** - Dedicated interface for Telegram conversations
- **InstagramPage.jsx** - Dedicated interface for Instagram conversations

Both pages mirror the existing Chat.jsx component structure while providing channel-specific branding, colors, and filtering.

## Components

### TelegramPage.jsx

A dedicated page for managing Telegram conversations with:

**Features:**
- Inbox list on the left showing only Telegram conversations
- Chat view on the right with full messaging capabilities
- Blue theme with Telegram branding
- Channel-specific UI elements and colors
- All messaging features: text, media, templates, notes
- Telegram bot settings support

**Key Elements:**
- Header with Telegram icon and branding
- Search functionality for conversations
- Filter chips: All, Open, Unassigned, Pinned, Closed
- Conversation list with:
  - Contact name and last message preview
  - Unread count badge (blue)
  - Pin/Unpin functionality
  - Assignment status
  - Last message timestamp
- Chat area with:
  - Full message history
  - Send text messages
  - Send media (images, documents)
  - Template support
  - Delivery status indicators
  - Typing indicators

**Theme Colors:**
- Primary: Blue (#0066cc, #0052a3)
- Accent: Blue (#3b82f6)
- Unread badge: Blue (#3b82f6)

### InstagramPage.jsx

A dedicated page for managing Instagram conversations with:

**Features:**
- Inbox list on the left showing only Instagram conversations
- Chat view on the right with full messaging capabilities
- Pink/gradient theme with Instagram branding
- Channel-specific UI elements and colors
- All messaging features: text, media
- Instagram account settings support

**Key Elements:**
- Header with Instagram icon and gradient branding
- Search functionality for conversations
- Filter chips: All, Open, Unassigned, Pinned, Closed
- Conversation list with:
  - Contact name and last message preview
  - Unread count badge (pink)
  - Pin/Unpin functionality
  - Assignment status
  - Last message timestamp
- Chat area with:
  - Full message history
  - Send text messages
  - Send media (images, videos)
  - Delivery status indicators
  - Typing indicators

**Theme Colors:**
- Primary: Pink (#ec4899, #be185d)
- Gradient: Pink to Red to Yellow (Instagram brand)
- Unread badge: Pink (#ec4899)

## Usage

### Integration with Main App

To integrate these pages into your main application, add them to your routing:

```jsx
import TelegramPage from './components/TelegramPage';
import InstagramPage from './components/InstagramPage';

// In your router or navigation
<Route path="/telegram" element={<TelegramPage socket={socket} currentUser={user} teamId={teamId} />} />
<Route path="/instagram" element={<InstagramPage socket={socket} currentUser={user} teamId={teamId} />} />
```

### Props

Both components accept the same props:

```typescript
interface ChannelPageProps {
  socket: Socket;           // Socket.io instance for real-time updates
  currentUser: User;        // Current logged-in user
  teamId: string;          // Team ID for filtering conversations
}
```

### Features

#### Conversation Filtering

Both pages automatically filter conversations by channel type:
- TelegramPage shows only `channelType === 'telegram'`
- InstagramPage shows only `channelType === 'instagram'`

#### Status Filters

Users can filter conversations by status:
- **All** - All conversations
- **Open** - Active conversations
- **Unassigned** - Conversations without an assigned agent
- **Pinned** - Pinned conversations
- **Closed** - Resolved/closed conversations

#### Search

Real-time search across:
- Contact names
- Last message content

#### Real-time Updates

- New messages appear instantly via Socket.io
- Typing indicators show when other agents are typing
- Delivery status updates in real-time
- Unread count updates automatically

#### Conversation Actions

- **Pin/Unpin** - Pin important conversations to the top
- **Resolve** - Mark conversation as closed
- **Delete** - Remove conversation from inbox

#### Message Features

All features from Chat.jsx are supported:
- Text messages
- Media attachments (images, documents, videos)
- Message templates
- Staff notes
- Delivery status tracking
- Message translation (if enabled)
- Location sharing
- Contact sharing

## Architecture

### Data Flow

1. **Fetch Conversations**
   - Component calls `getInbox(teamId, filter)`
   - Filters results by channel type
   - Updates conversation list

2. **Select Conversation**
   - User clicks conversation in sidebar
   - Component calls `getMessages(conversationId)`
   - Messages displayed in Chat component

3. **Send Message**
   - User types and sends message
   - Chat component handles sending via API
   - Socket.io broadcasts update
   - Message appears in real-time

4. **Real-time Updates**
   - Socket.io listens for `message:new` events
   - New messages added to state
   - UI updates automatically

### Component Structure

```
ChannelPage (TelegramPage/InstagramPage)
├── Sidebar
│   ├── Header (with channel branding)
│   ├── Search input
│   ├── Filter chips
│   └── Conversation list
└── Main Chat Area
    ├── Chat header (with channel info)
    ├── Chat component (messages)
    └── Message input area
```

## Styling

Both components use:
- Tailwind CSS for styling
- Channel-specific color schemes
- Responsive design
- Consistent UI patterns with existing components

### Color Schemes

**Telegram:**
- Primary blue: `#0066cc`
- Hover blue: `#0052a3`
- Accent: `#3b82f6`
- Selected state: `bg-blue-50`

**Instagram:**
- Primary pink: `#ec4899`
- Hover pink: `#be185d`
- Gradient: `from-pink-500 via-red-500 to-yellow-500`
- Selected state: `bg-pink-50`

## API Integration

### Required API Functions

- `getInbox(teamId, filter)` - Fetch conversations
- `getMessages(conversationId)` - Fetch messages
- `pinConversation(conversationId)` - Pin/unpin conversation
- `resolveConversation(conversationId)` - Mark as resolved
- `deleteConversation(conversationId)` - Delete conversation
- `sendText(conversationId, text)` - Send text message
- `sendMedia(conversationId, kind, link, caption)` - Send media
- `sendTemplate(conversationId, name, lang, components)` - Send template

All functions are imported from `../api.js`

## Socket.io Events

### Listening

- `message:new` - New message received
- `message:status` - Message delivery status updated
- `conversation:typing` - User typing indicator

### Emitting

- `join:conversation` - Join conversation room
- `conversation:typing` - Emit typing status

## Production Readiness

✅ **Implemented Features:**
- Channel-specific filtering
- Real-time message updates
- Conversation management (pin, resolve, delete)
- Search functionality
- Status filtering
- Responsive design
- Error handling
- Loading states
- Empty states

✅ **Best Practices:**
- Proper error handling with try-catch
- Loading states for async operations
- Optimistic UI updates
- Socket.io event cleanup
- Memory leak prevention
- Proper component lifecycle management

## Future Enhancements

Potential improvements:
- Bulk actions on conversations
- Advanced search filters
- Conversation export
- Message reactions
- Conversation archiving
- Custom conversation tags
- Conversation templates
- Automated responses
- Conversation analytics

## Troubleshooting

### Conversations not loading
- Check network tab for API errors
- Verify teamId is passed correctly
- Check browser console for errors

### Messages not updating
- Verify Socket.io connection is active
- Check that conversation is selected
- Verify message API response

### Styling issues
- Ensure Tailwind CSS is properly configured
- Check for CSS conflicts
- Verify icon imports from lucide-react

## Files

- `frontend/src/components/TelegramPage.jsx` - Telegram page component
- `frontend/src/components/InstagramPage.jsx` - Instagram page component
- `frontend/src/components/Chat.jsx` - Shared chat component (used by both)
- `frontend/src/api.js` - API functions
