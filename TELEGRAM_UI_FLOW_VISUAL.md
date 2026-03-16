# Telegram UI Flow - Visual Guide

## Step 1: Settings Page - Connect Telegram Bot

```
┌─────────────────────────────────────────────────────────────┐
│ Settings                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Lead Stages          Working Hours                          │
│ [...]                [...]                                  │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📱 Telegram Bot                                    ● Off │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │                                                         │ │
│ │ Connect your Telegram bot                             │ │
│ │ Create a bot with @BotFather and paste token here    │ │
│ │                                                         │ │
│ │ Bot Token                                              │ │
│ │ [••••••••••••••••••••••••••••••••••••••••••••••]       │ │
│ │ Get your bot token from @BotFather on Telegram       │ │
│ │                                                         │ │
│ │ Display Name (Optional)                                │ │
│ │ [My Telegram Bot                                ]       │ │
│ │                                                         │ │
│ │ [Connect Telegram Bot]                                 │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Step 2: Inbox - See Telegram Conversations

```
┌─────────────────────────────────────────────────────────────┐
│ Inbox                                                       │
├─────────────────────────────────────────────────────────────┤
│ [All] [Open] [Unassigned] [Pinned] [Closed]               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ John Doe                                         2:30 PM│ │
│ │ Hey, I need help with my order                         │ │
│ │ [Unassigned] [New] [📱 Telegram]                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Sarah Smith                                      1:15 PM│ │
│ │ Thanks for the update!                                 │ │
│ │ [Assigned] [Contacted] [💬 WhatsApp]                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Mike Johnson                                    12:45 PM│ │
│ │ Can you send me the invoice?                           │ │
│ │ [Assigned] [New] [📷 Instagram]                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Step 3: Chat - View Telegram Conversation

```
┌─────────────────────────────────────────────────────────────┐
│ John Doe                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ To: @my_telegram_bot                                        │
│                                                             │
│                                                             │
│                    Hey there! 👋                            │
│                                                    2:30 PM  │
│                                                             │
│ Thanks for reaching out! How can I help?                   │
│ 2:31                                                        │
│                                                             │
│ I need help with my order #12345                           │
│ 2:32                                                        │
│                                                             │
│                    Sure! Let me check that.                 │
│                                                    2:33 PM  │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [📎] [Type a message...]                    [Send ➤]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Step 4: Send Reply

```
┌─────────────────────────────────────────────────────────────┐
│ John Doe                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ To: @my_telegram_bot                                        │
│                                                             │
│ I need help with my order #12345                           │
│ 2:32                                                        │
│                                                             │
│                    Sure! Let me check that.                 │
│                                                    2:33 PM  │
│                                                             │
│                    Your order is on the way!               │
│                                                    2:34 PM  │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [📎] [Type a message...]                    [Send ➤]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key UI Elements

### 1. Channel Badge (Inbox)
- **WhatsApp**: 💬 Green badge
- **Instagram**: 📷 Pink badge  
- **Telegram**: 📱 Blue badge

### 2. Channel Identifier (Chat)
Shows which bot/number received the message:
- WhatsApp: Phone number (e.g., "+1 234 567 8900")
- Instagram: Instagram handle (e.g., "@business_account")
- Telegram: Bot token (e.g., "@my_telegram_bot")

### 3. Message Bubbles
- **Outbound** (Agent): Green bubble, right-aligned
- **Inbound** (Customer): White bubble, left-aligned
- Both show timestamp and delivery status

### 4. Media Display
All media types display the same way:
```
┌─────────────────────────────────────┐
│ [Photo]                             │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │     [Image Preview]             │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│ Check out this product!             │
│ 2:30                                │
└─────────────────────────────────────┘
```

## Supported Actions

### In Inbox
- ✅ Pin/Unpin conversation
- ✅ Resolve conversation
- ✅ Delete conversation
- ✅ Filter by status
- ✅ View unread count

### In Chat
- ✅ Send text message
- ✅ Send media (photo, document, audio, video)
- ✅ Send template (if configured)
- ✅ Add caption to media
- ✅ See typing indicators
- ✅ View delivery status
- ✅ Add notes

### In Settings
- ✅ Connect multiple Telegram bots
- ✅ Disconnect bots
- ✅ View connected bots
- ✅ Set display name

## Real-time Features

- ✅ Messages appear instantly
- ✅ Typing indicators show when agent is typing
- ✅ Delivery status updates in real-time
- ✅ New conversations appear in inbox immediately
- ✅ Unread count updates automatically

## Summary

Telegram integrates seamlessly with the existing UI. Users see:
1. Telegram conversations in Inbox with blue badge
2. Full chat history in Chat screen
3. Channel identifier showing bot name
4. All standard messaging features
5. Real-time updates and notifications

No separate UI needed - everything works out of the box!
