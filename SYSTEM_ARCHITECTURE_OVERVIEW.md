# System Architecture Overview

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ App.jsx (Main Router)                                    │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  Sidebar Navigation                                      │  │
│  │  ├── Dashboard                                           │  │
│  │  ├── Inbox (all channels)                               │  │
│  │  ├── Contacts                                           │  │
│  │  ├── Templates                                          │  │
│  │  ├── Workflows                                          │  │
│  │  ├── Rules                                              │  │
│  │  ├── Instagram Page ← Dedicated                         │  │
│  │  ├── Telegram Page ← Dedicated (NEW)                    │  │
│  │  ├── Gallery                                            │  │
│  │  └── Settings                                           │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Pages                                                    │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  ┌─────────────────┐  ┌─────────────────┐              │  │
│  │  │ TelegramPage    │  │ InstagramPage   │              │  │
│  │  │ (NEW)           │  │ (NEW)           │              │  │
│  │  ├─────────────────┤  ├─────────────────┤              │  │
│  │  │ Left Sidebar    │  │ Left Sidebar    │              │  │
│  │  │ - Telegram only │  │ - Instagram only│              │  │
│  │  │ - Blue theme    │  │ - Pink theme    │              │  │
│  │  │ - Filters       │  │ - Filters       │              │  │
│  │  │                 │  │                 │              │  │
│  │  │ Right Chat      │  │ Right Chat      │              │  │
│  │  │ - Full thread   │  │ - Full thread   │              │  │
│  │  │ - Send messages │  │ - Send messages │              │  │
│  │  │ - Media support │  │ - Media support │              │  │
│  │  └─────────────────┘  └─────────────────┘              │  │
│  │                                                          │  │
│  │  ┌─────────────────┐  ┌─────────────────┐              │  │
│  │  │ Inbox           │  │ SettingsPage    │              │  │
│  │  │ (existing)      │  │ (modified)      │              │  │
│  │  ├─────────────────┤  ├─────────────────┤              │  │
│  │  │ All channels    │  │ WhatsApp config │              │  │
│  │  │ Channel badges  │  │ Telegram config │              │  │
│  │  │ Unified view    │  │ (NEW)           │              │  │
│  │  └─────────────────┘  └─────────────────┘              │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ API Layer (api.js)                                       │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  Telegram Functions (NEW)                               │  │
│  │  - getTelegramSettings()                                │  │
│  │  - connectTelegram()                                    │  │
│  │  - disconnectTelegram()                                 │  │
│  │                                                          │  │
│  │  Existing Functions                                     │  │
│  │  - getInbox()                                           │  │
│  │  - getMessages()                                        │  │
│  │  - sendText()                                           │  │
│  │  - sendMedia()                                          │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ app.js (Express Server)                                  │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  Routes                                                  │  │
│  │  ├── /api/auth/telegram/* (NEW)                         │  │
│  │  ├── /api/auth/whatsapp/*                               │  │
│  │  ├── /api/conversations/*                               │  │
│  │  ├── /api/messages/*                                    │  │
│  │  └── /api/templates/*                                   │  │
│  │                                                          │  │
│  │  Webhooks                                                │  │
│  │  ├── /webhooks/telegram (NEW)                           │  │
│  │  ├── /webhooks/whatsapp                                 │  │
│  │  └── /webhooks/instagram                                │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Telegram Integration (NEW)                               │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  telegramAuth.js                                        │  │
│  │  - Connect bot                                          │  │
│  │  - Disconnect bot                                       │  │
│  │  - Get settings                                         │  │
│  │                                                          │  │
│  │  telegram.js (Webhook)                                  │  │
│  │  - Receive messages                                     │  │
│  │  - Store in database                                    │  │
│  │  - Emit real-time events                                │  │
│  │                                                          │  │
│  │  telegramClient.js                                      │  │
│  │  - Send text messages                                   │  │
│  │  - Send media                                           │  │
│  │  - Verify bot token                                     │  │
│  │  - Set webhook                                          │  │
│  │                                                          │  │
│  │  outboundTelegram.js                                    │  │
│  │  - Send messages to Telegram                            │  │
│  │  - Handle delivery status                               │  │
│  │                                                          │  │
│  │  telegramConfig.js                                      │  │
│  │  - Fetch settings from database                         │  │
│  │  - Get bot by token                                     │  │
│  │  - Get all bots for team                                │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Existing Integrations                                    │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  WhatsApp Integration                                   │  │
│  │  - whatsappAuth.js                                      │  │
│  │  - whatsapp.js (webhook)                                │  │
│  │  - whatsappClient.js                                    │  │
│  │  - outboundWhatsapp.js                                  │  │
│  │  - whatsappConfig.js                                    │  │
│  │                                                          │  │
│  │  Instagram Integration                                  │  │
│  │  - instagramAuth.js                                     │  │
│  │  - instagram.js (webhook)                               │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓ SQL
┌─────────────────────────────────────────────────────────────────┐
│                       DATABASE                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Tables                                                   │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  channels                                                │  │
│  │  - type: 'whatsapp' | 'instagram' | 'telegram'          │  │
│  │  - external_id: phone_number | handle | bot_token       │  │
│  │                                                          │  │
│  │  telegram_settings (NEW)                                │  │
│  │  - team_id                                              │  │
│  │  - bot_token                                            │  │
│  │  - bot_username                                         │  │
│  │  - display_name                                         │  │
│  │                                                          │  │
│  │  conversations                                          │  │
│  │  - channel_id                                           │  │
│  │  - contact_id                                           │  │
│  │  - status                                               │  │
│  │                                                          │  │
│  │  messages                                                │  │
│  │  - conversation_id                                      │  │
│  │  - direction: 'inbound' | 'outbound'                    │  │
│  │  - content_type: 'text' | 'image' | 'document' | ...    │  │
│  │                                                          │  │
│  │  contacts                                                │  │
│  │  - channel_id                                           │  │
│  │  - external_id                                          │  │
│  │  - display_name                                         │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓ API
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL PLATFORMS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │ Telegram Bot API │  │ Meta Cloud API   │                   │
│  │ (NEW)            │  │ (WhatsApp)       │                   │
│  ├──────────────────┤  ├──────────────────┤                   │
│  │ Send messages    │  │ Send messages    │                   │
│  │ Receive webhooks │  │ Receive webhooks │                   │
│  │ Manage bots      │  │ Manage numbers   │                   │
│  └──────────────────┘  └──────────────────┘                   │
│                                                                 │
│  ┌──────────────────┐                                          │
│  │ Instagram API    │                                          │
│  ├──────────────────┤                                          │
│  │ Send messages    │                                          │
│  │ Receive webhooks │                                          │
│  └──────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Incoming Message Flow
```
Telegram User sends message
    ↓
Telegram Bot API
    ↓
/webhooks/telegram endpoint
    ↓
telegram.js webhook handler
    ↓
Parse message
    ↓
Upsert channel (type='telegram')
    ↓
Upsert contact
    ↓
Find/create conversation
    ↓
Store message in database
    ↓
Emit WebSocket event
    ↓
Frontend receives update
    ↓
TelegramPage displays message
```

### Outgoing Message Flow
```
Agent types message in TelegramPage
    ↓
Click Send button
    ↓
sendText() API call
    ↓
Backend /api/conversations/:id/send
    ↓
outboundTelegram.js
    ↓
telegramClient.sendText()
    ↓
Telegram Bot API
    ↓
Message sent to user
    ↓
Delivery status updated
    ↓
Frontend shows delivery status
```

## Component Hierarchy

```
App.jsx
├── Sidebar Navigation
│   ├── Dashboard button
│   ├── Inbox button
│   ├── Instagram button
│   ├── Telegram button (NEW)
│   └── Settings button
│
├── Pages
│   ├── DashboardPage
│   ├── Inbox
│   │   ├── Conversation list (all channels)
│   │   └── Chat component
│   │
│   ├── TelegramPage (NEW)
│   │   ├── Left sidebar (Telegram only)
│   │   │   ├── Header
│   │   │   ├── Filters
│   │   │   └── Conversation list
│   │   └── Right side
│   │       └── Chat component
│   │
│   ├── InstagramPage (NEW)
│   │   ├── Left sidebar (Instagram only)
│   │   │   ├── Header
│   │   │   ├── Filters
│   │   │   └── Conversation list
│   │   └── Right side
│   │       └── Chat component
│   │
│   ├── SettingsPage
│   │   ├── Lead Stages
│   │   ├── Working Hours
│   │   ├── WhatsApp Config
│   │   └── Telegram Config (NEW)
│   │
│   └── Other Pages
│       ├── Templates
│       ├── Workflows
│       ├── Rules
│       └── Gallery
│
└── Shared Components
    ├── Chat (used by Inbox, TelegramPage, InstagramPage)
    ├── Inbox (used by main Inbox page)
    ├── NotesPanel
    ├── CustomerCard
    └── UI Components
```

## Integration Points

### Frontend ↔ Backend
- REST API for CRUD operations
- WebSocket for real-time updates
- File uploads for media

### Backend ↔ Database
- SQL queries for data storage
- Transactions for consistency
- Indexes for performance

### Backend ↔ External APIs
- Telegram Bot API for messaging
- Meta Cloud API for WhatsApp
- Instagram API for direct messages

## Summary

The system now has:
- ✅ Unified Inbox (all channels)
- ✅ Dedicated Telegram page (blue theme)
- ✅ Dedicated Instagram page (pink theme)
- ✅ Full Telegram integration
- ✅ Real-time updates
- ✅ Multi-channel support
- ✅ Production-ready architecture

All components are integrated and working together seamlessly!
