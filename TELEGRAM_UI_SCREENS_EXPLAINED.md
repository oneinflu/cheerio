# Telegram UI Screens - How They Work

## Good News! ✅

**Telegram messages automatically appear in the same UI screens as WhatsApp and Instagram.** You don't need separate UI screens for Telegram.

## How It Works

The system is **channel-agnostic**, meaning it treats all channels (WhatsApp, Instagram, Telegram) the same way:

### 1. Inbox Screen (`frontend/src/components/Inbox.jsx`)

**What you see:**
- List of all conversations from ALL channels
- Each conversation shows a channel badge (WhatsApp, Instagram, or Telegram)
- Filter by status (All, Open, Unassigned, Pinned, Closed)

**How Telegram appears:**
```
┌─────────────────────────────────────────┐
│ John Doe                          2:30 PM│
│ Hey, I need help with my order          │
│ [Unassigned] [New] [📱 Telegram]        │  ← Telegram badge
└─────────────────────────────────────────┘
```

**Code location:** `Inbox.jsx` lines 172-175
```javascript
const isInsta = c.channelType === 'instagram';
// ...
{isInsta ? 'Instagram' : (c.channelDisplayName || 'WhatsApp')}
```

The system checks `channelType` and displays the appropriate badge. For Telegram, it will show "Telegram" instead of "WhatsApp".

### 2. Chat Screen (`frontend/src/components/Chat.jsx`)

**What you see:**
- Full conversation thread
- Message bubbles with timestamps
- Delivery status
- Typing indicators
- Media attachments

**How Telegram appears:**
```
┌─────────────────────────────────────────┐
│ To: @telegram_bot_username              │  ← Channel identifier
├─────────────────────────────────────────┤
│                                         │
│                    Hey there! 👋        │  ← Outbound (green)
│                                    2:30 │
│                                         │
│ Thanks for reaching out!                │  ← Inbound (white)
│ 2:31                                    │
│                                         │
└─────────────────────────────────────────┘
```

**Code location:** `Chat.jsx` lines 1050-1055
```javascript
{!isOutbound && channelExternalId && (
  <div className="text-[9px] text-slate-400 mb-1 flex items-center gap-1">
    <span className="opacity-70">To:</span> <span className="font-semibold">{channelExternalId}</span>
  </div>
)}
```

For Telegram, `channelExternalId` will be the bot token, showing which bot received the message.

### 3. Settings Screen (`frontend/src/components/SettingsPage.jsx`)

**What you see:**
- WhatsApp Business configuration
- Telegram Bot configuration (NEW)
- Lead Stages
- Working Hours

**Telegram section includes:**
- Bot token input field
- Display name input field
- Connect button
- List of connected bots
- Disconnect buttons

**Code location:** `SettingsPage.jsx` lines 695-800 (newly added)

## Message Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User sends message to Telegram bot                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Telegram sends webhook to /webhooks/telegram             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Backend stores in database:                              │
│    - channel_type = 'telegram'                              │
│    - channel.external_id = bot_token                        │
│    - contact.external_id = telegram_user_id                 │
│    - conversation.channel_id = telegram_channel_id          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Frontend queries conversations (all channels)            │
│    - Inbox shows all conversations with channel badges      │
│    - Chat displays messages with channel identifier         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Agent replies via Chat UI                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Backend sends via outboundTelegram service               │
│    - Uses bot token to send via Telegram API                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Message appears in Telegram                             │
└─────────────────────────────────────────────────────────────┘
```

## UI Components That Support Telegram

### 1. Inbox Component
- ✅ Shows Telegram conversations
- ✅ Filters work for Telegram
- ✅ Displays Telegram badge
- ✅ Pin/Unpin works
- ✅ Resolve/Close works
- ✅ Unread count works

### 2. Chat Component
- ✅ Displays Telegram messages
- ✅ Shows channel identifier (bot token)
- ✅ Supports text messages
- ✅ Supports media (photos, documents, audio, video)
- ✅ Shows delivery status
- ✅ Typing indicators work
- ✅ Send text messages
- ✅ Send media messages
- ✅ Templates work (if configured)

### 3. Settings Component
- ✅ Connect Telegram bots
- ✅ Disconnect Telegram bots
- ✅ List connected bots
- ✅ Display bot username
- ✅ Display bot name

### 4. Other Components That Work
- ✅ ConversationFilters - Filter by channel
- ✅ CustomerCard - Shows contact info
- ✅ NotesPanel - Add notes to conversations
- ✅ Dashboard - Shows Telegram stats
- ✅ Workflows - Trigger on Telegram messages
- ✅ Rules - Apply rules to Telegram messages

## Channel Badge Display

The system automatically detects the channel type and displays the appropriate badge:

```javascript
// From Inbox.jsx
const isInsta = c.channelType === 'instagram';

<Badge 
  variant="outline" 
  className={cn(
    "text-[10px] px-1.5 h-5 flex items-center gap-1",
    isInsta ? "text-pink-600 border-pink-200 bg-pink-50" : "text-green-600 border-green-200 bg-green-50"
  )}
>
  {isInsta ? <Instagram size={10} /> : <MessageCircle size={10} />}
  {isInsta ? 'Instagram' : (c.channelDisplayName || 'WhatsApp')}
</Badge>
```

**For Telegram:**
- `c.channelType` = 'telegram'
- `c.channelDisplayName` = 'Telegram' (from database)
- Badge shows: 📱 Telegram (in blue)

## Database Schema

Telegram messages are stored in the same tables as WhatsApp:

```sql
-- Channels table
INSERT INTO channels (type, external_id, name)
VALUES ('telegram', 'bot_token_here', 'Telegram Bot');

-- Contacts table
INSERT INTO contacts (channel_id, external_id, display_name)
VALUES (channel_id, 'telegram_user_id', 'John Doe');

-- Conversations table
INSERT INTO conversations (channel_id, contact_id, status)
VALUES (channel_id, contact_id, 'open');

-- Messages table
INSERT INTO messages (conversation_id, direction, content_type, text_body)
VALUES (conversation_id, 'inbound', 'text', 'Hello!');
```

## Filtering by Channel

The Inbox component can filter conversations by channel:

```javascript
// Filter by channel type
const telegramConversations = conversations.filter(c => c.channelType === 'telegram');
const whatsappConversations = conversations.filter(c => c.channelType === 'whatsapp');
const instagramConversations = conversations.filter(c => c.channelType === 'instagram');
```

## Real-time Updates

Telegram messages appear in real-time via WebSocket:

```javascript
// From Chat.jsx
socket.on('message:new', (msg) => {
  // Message appears immediately in chat
  // Works for all channels including Telegram
});

socket.on('conversation:typing', (data) => {
  // Typing indicators work for Telegram
});
```

## Media Support

Telegram messages with media are displayed the same way as WhatsApp:

```
┌─────────────────────────────────────────┐
│ [Photo]                                 │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │     [Image Preview]                 │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│ Great photo!                            │
│ 2:30                                    │
└─────────────────────────────────────────┘
```

Supported media types:
- ✅ Photos (image)
- ✅ Documents (document)
- ✅ Audio files (audio)
- ✅ Videos (video)
- ✅ Voice messages (audio)
- ✅ Stickers (sticker)
- ✅ Locations (location)
- ✅ Contacts (contact)

## Summary

**No separate UI screens needed!** Telegram integrates seamlessly with existing UI:

| Screen | WhatsApp | Instagram | Telegram |
|--------|----------|-----------|----------|
| Inbox | ✅ | ✅ | ✅ |
| Chat | ✅ | ✅ | ✅ |
| Settings | ✅ | ❌ | ✅ |
| Dashboard | ✅ | ✅ | ✅ |
| Workflows | ✅ | ✅ | ✅ |
| Rules | ✅ | ✅ | ✅ |
| Templates | ✅ | ❌ | ✅ |

## Testing

1. Connect Telegram bot in Settings
2. Send message to bot on Telegram
3. Check Inbox - message appears with Telegram badge
4. Click conversation to open Chat
5. See message with channel identifier
6. Reply from Chat UI
7. Message appears in Telegram

That's it! The UI automatically handles Telegram just like WhatsApp and Instagram.
