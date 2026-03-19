import { useEffect, useMemo, useState } from 'react';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import {
  MessageSquare, Trash2,
  ArrowLeft, Send, Puzzle, CreditCard, Phone,
  Database, ExternalLink, ShieldCheck, Lock, Sparkles,
  Globe2, Code2, Clock, Copy, Eye, EyeOff, Server
} from 'lucide-react';
import {
  getWhatsAppSettings, onboardWhatsApp,
  disconnectWhatsApp, getTelegramSettings, connectTelegram,
  disconnectTelegram,
  connectInstagram, getInstagramStatus, disconnectInstagram,
  getInstagramAutomations, createInstagramAutomation,
  updateInstagramAutomation, deleteInstagramAutomation, toggleInstagramAutomation,
  getRazorpaySettings, updateRazorpaySettings, disconnectRazorpay,
  getExotelSettings, updateExotelSettings, disconnectExotel,
  initiateExotelCall, getExotelCallLogs,
  getTwilioSettings, updateTwilioSettings, disconnectTwilio,
  sendTwilioSms, initiateTwilioCall, getTwilioLogs
} from '../api';

// ─── Brand icon URLs (SimpleIcons CDN + Wikimedia) ────────────────────────────
const ICONS = {
  whatsapp:    'https://cdn.simpleicons.org/whatsapp/25D366',
  telegram:    'https://cdn.simpleicons.org/telegram/26A5E4',
  instagram:   'https://cdn.simpleicons.org/instagram/E4405F',
  gmail:       'https://cdn.simpleicons.org/gmail/EA4335',
  slack:       'https://cdn.simpleicons.org/slack/4A154B',
  zoho:        'https://cdn.simpleicons.org/zoho/E42527',
  salesforce:  'https://cdn.simpleicons.org/salesforce/00A1E0',
  notion:      'https://cdn.simpleicons.org/notion/000000',
  hubspot:     'https://cdn.simpleicons.org/hubspot/FF7A59',
  linear:      'https://cdn.simpleicons.org/linear/5E6AD2',
  github:      'https://cdn.simpleicons.org/github/181717',
  jira:        'https://cdn.simpleicons.org/jira/0052CC',
  stripe:      'https://cdn.simpleicons.org/stripe/635BFF',
  razorpay:    'https://cdn.simpleicons.org/razorpay/02042B',
  cashfree:    'https://logo.clearbit.com/cashfree.com',
  payu:        'https://logo.clearbit.com/payu.in',
  googlesheets:'https://cdn.simpleicons.org/googlesheets/34A853',
  twilio:      'https://cdn.simpleicons.org/twilio/F22F46',
  airtel:      'https://logo.clearbit.com/airtel.in',
  exotel:      'https://logo.clearbit.com/exotel.com',
  openai:      'https://cdn.simpleicons.org/openai/412991',
  anthropic:   'https://cdn.simpleicons.org/anthropic/191919',
  xolox:       'https://logo.clearbit.com/xolox.in',
};

const CATEGORIES = [
  { id: 'channels',  name: 'Communication Channels', icon: MessageSquare },
  { id: 'livechat',  name: 'Live Chat & Website',    icon: Globe2 },
  { id: 'mcp',       name: 'MCP Connectors',          icon: Server },
  { id: 'crm',       name: 'CRM & Productivity',      icon: Database },
  { id: 'payments',  name: 'Payments & Billing',       icon: CreditCard },
  { id: 'voip',      name: 'VoIP & Calling',           icon: Phone },
  { id: 'ai',        name: 'AI Providers',             icon: Sparkles },
];

const INTEGRATIONS_LIST = [
  // ─── Channels ────────────────────────────────────────────────────
  {
    id: 'whatsapp', category: 'channels', name: 'WhatsApp Business',
    logo: ICONS.whatsapp,
    description: 'Official Meta Cloud API for WhatsApp Business messaging — send templates, media & interactive messages.',
    accentColor: '#25D366',
    fields: [],  // handled by custom renderer
  },
  {
    id: 'telegram', category: 'channels', name: 'Telegram Bot',
    logo: ICONS.telegram,
    description: 'Connect support bots via BotFather to handle Telegram inquiries at scale.',
    accentColor: '#26A5E4',
    fields: [],  // handled by custom renderer
  },
  {
    id: 'instagram', category: 'channels', name: 'Instagram DMs',
    logo: ICONS.instagram,
    description: 'Manage Instagram Direct Messages, auto-replies, and comment-to-DM automations through the Meta Graph API.',
    accentColor: '#E4405F',
    docsUrl: 'https://developers.facebook.com/docs/instagram-api/overview',
    fields: [],  // handled by custom renderer
  },
  {
    id: 'email', category: 'channels', name: 'Business Email (IMAP/SMTP)',
    logo: ICONS.gmail, isUpcoming: true,
    description: 'Sync a shared GSuite or Outlook inbox so all team email lands directly in your conversation feed.',
    accentColor: '#EA4335',
    docsUrl: 'https://support.google.com/mail/answer/7126229',
    fields: [
      { label: 'Email Address',   key: 'email',     placeholder: 'support@company.com',  hint: 'The shared inbox address you want to monitor' },
      { label: 'IMAP Host',       key: 'imap_host', placeholder: 'imap.gmail.com',        hint: 'Incoming mail server hostname' },
      { label: 'IMAP Port',       key: 'imap_port', placeholder: '993',                   hint: '993 for SSL, 143 for STARTTLS' },
      { label: 'SMTP Host',       key: 'smtp_host', placeholder: 'smtp.gmail.com',        hint: 'Outgoing mail server hostname' },
      { label: 'SMTP Port',       key: 'smtp_port', placeholder: '465',                   hint: '465 for SSL, 587 for STARTTLS' },
      { label: 'App Password',    key: 'password',  placeholder: 'xxxx xxxx xxxx xxxx',   hint: 'Use an App Password, not your main password (Gmail: myaccount.google.com/apppasswords)', type: 'password' },
    ],
  },
  {
    id: 'slack', category: 'channels', name: 'Slack',
    logo: ICONS.slack, isUpcoming: true,
    description: 'Forward conversations and alerts to Slack channels, and reply directly from your Slack workspace.',
    accentColor: '#4A154B',
    docsUrl: 'https://api.slack.com/apps',
    fields: [
      { label: 'Bot User OAuth Token', key: 'bot_token',     placeholder: 'xoxb-...',         hint: 'From Slack App → OAuth & Permissions → Bot Token', type: 'password' },
      { label: 'Signing Secret',       key: 'signing_secret', placeholder: 'abcd1234...',       hint: 'From Slack App → Basic Information → App Credentials', type: 'password' },
      { label: 'Default Channel ID',   key: 'channel_id',    placeholder: 'C0123ABC456',       hint: 'Right-click a channel → View channel details → Channel ID' },
    ],
  },

  // ─── Live Chat & Website ─────────────────────────────────────────
  {
    id: 'pulse-xolox', category: 'livechat', name: 'Pulse by XOLOX',
    logo: ICONS.xolox,
    logoFallback: '⚡',
    description: 'Embed Pulse on your website to capture live visitors, qualify leads with AI, and route hot conversations directly into your Greeto inbox in real time.',
    accentColor: '#6366f1',
    docsUrl: 'https://xolox.in/pulse',
    badge: 'Featured',
    fields: [
      { label: 'Pulse Site ID',       key: 'site_id',    placeholder: 'pulse_xxxxxxxxxxxx',            hint: 'Generated when you create a site in your XOLOX Pulse dashboard' },
      { label: 'API Secret Key',      key: 'api_secret', placeholder: '••••••••••••••••••••••••',       hint: 'XOLOX Pulse → Settings → API → Copy secret key', type: 'password' },
      { label: 'Webhook Endpoint',    key: 'webhook_url', placeholder: 'https://yourapp.com/webhook',  hint: 'Greeto will POST live-visitor events here. Leave blank to use auto-generated URL.' },
      { label: 'Widget Theme Color',  key: 'theme_color', placeholder: '#6366f1',                      hint: 'Hex color for the Pulse chat widget launcher button' },
      { label: 'Greeting Message',    key: 'greeting',    placeholder: 'Hi 👋 How can we help you today?', hint: 'First message visitors see when they open the Pulse chat widget' },
    ],
  },

  // ─── MCP Connectors ──────────────────────────────────────────────
  {
    id: 'zoho-mcp', category: 'mcp', name: 'Zoho MCP',
    logo: ICONS.zoho, isUpcoming: true,
    description: 'Model Context Protocol server for Zoho CRM — lets AI read deals, contacts and tickets in real time.',
    accentColor: '#E42527',
    docsUrl: 'https://www.zoho.com/crm/developer/docs/api/v6/',
    mcpServer: 'https://mcp.zoho.com/v1/sse',
    fields: [
      { label: 'Client ID',          key: 'client_id',     placeholder: '1000.XXXX...',          hint: 'From Zoho API Console → Self Client or Server-based app' },
      { label: 'Client Secret',      key: 'client_secret', placeholder: 'xxxxxxxx...',             hint: 'Keep secret — used to exchange auth code for tokens', type: 'password' },
      { label: 'Refresh Token',      key: 'refresh_token', placeholder: '1000.xxxx...yyyy',        hint: 'Long-lived token — generate from Zoho OAuth Playground', type: 'password' },
      { label: 'Data Center Region', key: 'region',        placeholder: 'com / eu / in / au / jp', hint: 'Must match the region where your Zoho org is hosted' },
    ],
  },
  {
    id: 'salesforce-mcp', category: 'mcp', name: 'Salesforce MCP',
    logo: ICONS.salesforce, isUpcoming: true,
    description: 'Direct LLM context mapping for Salesforce Objects — Opportunities, Cases, Contacts and custom SObjects.',
    accentColor: '#00A1E0',
    docsUrl: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/',
    mcpServer: 'https://mcp.salesforce.com/v1/sse',
    fields: [
      { label: 'Consumer Key (Client ID)',     key: 'consumer_key',    placeholder: 'Paste Consumer Key',              hint: 'From Setup → App Manager → Connected App → View' },
      { label: 'Consumer Secret',              key: 'consumer_secret', placeholder: '••••••••',                        hint: 'Reveal from the Connected App detail page', type: 'password' },
      { label: 'Username',                     key: 'username',        placeholder: 'user@org.salesforce.com',         hint: 'API-enabled Salesforce user (prefer a dedicated integration user)' },
      { label: 'Security Token',               key: 'security_token',  placeholder: 'Append to password',              hint: 'Reset from My Settings → Personal → Reset My Security Token', type: 'password' },
      { label: 'Instance / Environment URL',   key: 'instance_url',   placeholder: 'https://yourorg.salesforce.com',  hint: 'Use login.salesforce.com for prod, test.salesforce.com for sandbox' },
    ],
  },
  {
    id: 'notion-mcp', category: 'mcp', name: 'Notion MCP',
    logo: ICONS.notion, isUpcoming: true,
    description: 'Let AI read and write to your Notion Databases — wikis, project trackers and knowledge bases.',
    accentColor: '#000000',
    docsUrl: 'https://developers.notion.com/docs/getting-started',
    mcpServer: 'https://mcp.notion.com/sse',
    fields: [
      { label: 'Internal Integration Secret', key: 'token',    placeholder: 'secret_xxxxxxxxxx...', hint: 'From notion.so/my-integrations → Your Integration → Show/copy secret', type: 'password' },
      { label: 'Root Page / Database ID',     key: 'page_id',  placeholder: '8a2b3c4d5e6f...',       hint: 'Open the page in Notion → Share → Copy link → extract the 32-char ID' },
    ],
  },
  {
    id: 'hubspot-mcp', category: 'mcp', name: 'HubSpot MCP',
    logo: ICONS.hubspot, isUpcoming: true,
    description: 'MCP bridge to HubSpot — read contacts, deals, tickets and company timelines for AI-powered context.',
    accentColor: '#FF7A59',
    docsUrl: 'https://developers.hubspot.com/docs/api/overview',
    mcpServer: 'https://mcp.hubspot.com/v1/sse',
    fields: [
      { label: 'Private App Token', key: 'token', placeholder: 'pat-eu1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', hint: 'HubSpot → Settings → Integrations → Private Apps → Create or copy token', type: 'password' },
      { label: 'Portal / Hub ID',   key: 'hub_id', placeholder: '12345678', hint: 'Found in HubSpot URL: app.hubspot.com/contacts/{hub_id}/...' },
    ],
  },
  {
    id: 'linear-mcp', category: 'mcp', name: 'Linear MCP',
    logo: ICONS.linear, isUpcoming: true,
    description: 'Surface Linear issues, projects and cycles inside conversations for instant engineering context.',
    accentColor: '#5E6AD2',
    docsUrl: 'https://developers.linear.app/docs',
    mcpServer: 'https://mcp.linear.app/sse',
    fields: [
      { label: 'API Key', key: 'api_key', placeholder: 'lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Linear → Settings → API → Personal API Keys → Create key', type: 'password' },
      { label: 'Team Key (optional)', key: 'team_key', placeholder: 'ENG', hint: 'Filter MCP context to a specific Linear team (leave blank for all teams)' },
    ],
  },
  {
    id: 'github-mcp', category: 'mcp', name: 'GitHub MCP',
    logo: ICONS.github, isUpcoming: true,
    description: 'Connect GitHub repos so AI can reference issues, PRs and commits directly in customer conversations.',
    accentColor: '#181717',
    docsUrl: 'https://docs.github.com/en/rest',
    mcpServer: 'https://api.githubcopilot.com/mcp/',
    fields: [
      { label: 'Personal Access Token (classic)', key: 'token', placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic). Scopes: repo, read:org', type: 'password' },
      { label: 'Default Repository', key: 'repo', placeholder: 'owner/repository-name', hint: 'Used as fallback when no repo is detected from conversation context' },
    ],
  },
  {
    id: 'jira-mcp', category: 'mcp', name: 'Jira MCP',
    logo: ICONS.jira, isUpcoming: true,
    description: 'Pull Jira tickets, sprints and epics into AI context — link support issues to engineering backlog.',
    accentColor: '#0052CC',
    docsUrl: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/',
    mcpServer: 'https://mcp.atlassian.com/v1/sse',
    fields: [
      { label: 'Atlassian Email',   key: 'email',   placeholder: 'you@company.com',                hint: 'The email linked to your Atlassian account' },
      { label: 'API Token',         key: 'token',   placeholder: 'ATATxxxxxxxxxxxxxxxxxxxxxxxx',    hint: 'id.atlassian.com → Security → API tokens → Create', type: 'password' },
      { label: 'Jira Cloud URL',    key: 'base_url', placeholder: 'https://yourorg.atlassian.net', hint: 'Your Jira cloud instance base URL' },
      { label: 'Default Project Key', key: 'project', placeholder: 'ENG or SUPPORT',               hint: 'Used as the fallback project when creating/searching issues' },
    ],
  },

  {
    id: 'xolox-mcp', category: 'mcp', name: 'XOLOX MCP',
    logo: ICONS.xolox,
    logoFallback: '⚡',
    description: 'Model Context Protocol server for XOLOX — gives AI agents real-time access to Pulse visitor sessions, lead scores, conversation history and CRM records.',
    accentColor: '#6366f1',
    docsUrl: 'https://xolox.in/developers/mcp',
    mcpServer: 'https://mcp.xolox.in/v1/sse',
    badge: 'New',
    fields: [
      { label: 'XOLOX API Key',     key: 'api_key',     placeholder: 'xolox_live_xxxxxxxxxxxxxxxxxxxx', hint: 'XOLOX Dashboard → Settings → Developer → API Keys → Create', type: 'password' },
      { label: 'Workspace ID',      key: 'workspace_id', placeholder: 'ws_xxxxxxxxxxxxxxxx',             hint: 'Found in XOLOX Dashboard URL: app.xolox.in/ws/{workspace_id}' },
      { label: 'MCP Scope',         key: 'scope',        placeholder: 'visitors,leads,crm',              hint: 'Comma-separated scopes: visitors, leads, crm, conversations, analytics' },
    ],
  },

  // ─── CRM & Productivity ───────────────────────────────────────────
  {
    id: 'hubspot', category: 'crm', name: 'HubSpot CRM',
    logo: ICONS.hubspot, isUpcoming: true,
    description: 'Auto-sync conversation contacts and notes to HubSpot timeline. Create deals from conversations.',
    accentColor: '#FF7A59',
    docsUrl: 'https://developers.hubspot.com/docs/api/crm/contacts',
    fields: [
      { label: 'Private App Token', key: 'token',  placeholder: 'pat-eu1-...',  hint: 'Settings → Integrations → Private Apps → Create app token', type: 'password' },
      { label: 'Default Pipeline ID', key: 'pipeline_id', placeholder: 'default', hint: 'Pipeline where new deals are created from conversations (optional)' },
    ],
  },
  {
    id: 'zoho-crm', category: 'crm', name: 'Zoho CRM',
    logo: ICONS.zoho, isUpcoming: true,
    description: 'Sync leads, contacts and activities bidirectionally between Greeto and Zoho CRM.',
    accentColor: '#E42527',
    docsUrl: 'https://www.zoho.com/crm/developer/docs/',
    fields: [
      { label: 'Client ID',          key: 'client_id',     placeholder: '1000.XXXX...', hint: 'Zoho API Console → Server-based App' },
      { label: 'Client Secret',      key: 'client_secret', placeholder: '••••••••',     type: 'password', hint: 'From the same API Console page' },
      { label: 'Refresh Token',      key: 'refresh_token', placeholder: '1000.xxxx...', type: 'password', hint: 'Generate from accounts.zoho.com/oauth/playground' },
      { label: 'Region',             key: 'region',        placeholder: 'com / eu / in', hint: 'Must match where your Zoho account is registered' },
    ],
  },
  {
    id: 'xolox-crm', category: 'crm', name: 'XOLOX CRM',
    logo: ICONS.xolox,
    logoFallback: '⚡',
    description: 'Native two-way sync with XOLOX CRM — auto-create contacts from conversations, push deal stages, and pull visitor intelligence directly into your Greeto inbox.',
    accentColor: '#6366f1',
    docsUrl: 'https://xolox.in/developers/crm-api',
    badge: 'New',
    fields: [
      { label: 'API Key',           key: 'api_key',      placeholder: 'xolox_live_xxxxxxxxxxxxxxxxxxxx', hint: 'XOLOX Dashboard → Settings → Developer → API Keys → Create', type: 'password' },
      { label: 'Workspace ID',      key: 'workspace_id', placeholder: 'ws_xxxxxxxxxxxxxxxx',             hint: 'Found in your XOLOX workspace URL' },
      { label: 'Default Pipeline',  key: 'pipeline_id',  placeholder: 'pipeline_xxxxxxxx',               hint: 'CRM pipeline where new deals are created from Greeto conversations (optional)' },
      { label: 'Sync Direction',    key: 'sync_mode',    placeholder: 'bidirectional',                   hint: 'Options: bidirectional, greeto-to-xolox, xolox-to-greeto' },
    ],
  },
  {
    id: 'google-sheets', category: 'crm', name: 'Google Sheets',
    logo: ICONS.googlesheets, isUpcoming: true,
    description: 'Export new leads, conversations and tags directly to a Google Sheet for reporting.',
    accentColor: '#34A853',
    docsUrl: 'https://developers.google.com/sheets/api/guides/concepts',
    fields: [
      { label: 'Service Account JSON Key', key: 'sa_json', placeholder: 'Paste full JSON contents...', hint: 'GCP Console → IAM → Service Accounts → Create key (JSON). Share the sheet with the service account email.' },
      { label: 'Spreadsheet ID',           key: 'sheet_id', placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms', hint: 'Extract from the Google Sheets URL between /d/ and /edit' },
      { label: 'Sheet / Tab Name',         key: 'tab_name', placeholder: 'Lead Data',                   hint: 'The exact name of the worksheet tab to write to' },
    ],
  },

  // ─── Payments ─────────────────────────────────────────────────────
  {
    id: 'razorpay', category: 'payments', name: 'Razorpay',
    logo: ICONS.razorpay,
    description: 'Accept payments, send payment links via WhatsApp, and auto-sync order status to conversations.',
    accentColor: '#02042B',
    docsUrl: 'https://razorpay.com/docs/api/',
    fields: [
      { label: 'Key ID',       key: 'key_id',     placeholder: 'rzp_live_xxxxxxxxxxxxxxxxxx',  hint: 'Dashboard → Settings → API Keys → Generate live key' },
      { label: 'Key Secret',   key: 'key_secret', placeholder: '••••••••••••••••••••••••',     hint: 'Copy immediately — Razorpay only shows it once', type: 'password' },
      { label: 'Webhook Secret', key: 'webhook_secret', placeholder: 'whsec_...',             hint: 'Dashboard → Settings → Webhooks → Add new endpoint → copy secret', type: 'password' },
    ],
  },
  {
    id: 'stripe', category: 'payments', name: 'Stripe',
    logo: ICONS.stripe, isUpcoming: true,
    description: 'Global payment infrastructure — send payment links and track invoice status within conversations.',
    accentColor: '#635BFF',
    docsUrl: 'https://stripe.com/docs/api',
    fields: [
      { label: 'Secret Key',       key: 'secret_key',     placeholder: 'sk_live_...',   hint: 'Dashboard → Developers → API keys → Secret key (use restricted key for least privilege)', type: 'password' },
      { label: 'Webhook Signing Secret', key: 'webhook_secret', placeholder: 'whsec_...', hint: 'Stripe → Webhooks → Add endpoint → Signing secret', type: 'password' },
      { label: 'Publishable Key',  key: 'publishable_key', placeholder: 'pk_live_...',  hint: 'Safe to expose client-side — used for Stripe.js' },
    ],
  },
  {
    id: 'cashfree', category: 'payments', name: 'Cashfree',
    logo: ICONS.cashfree, isUpcoming: true,
    description: 'Payment gateway and payout automation for Indian merchants.',
    accentColor: '#1D8348',
    docsUrl: 'https://docs.cashfree.com/docs/',
    fields: [
      { label: 'App ID',     key: 'app_id',     placeholder: 'CF_APP_ID',    hint: 'Cashfree Dashboard → Settings → Credentials' },
      { label: 'Secret Key', key: 'secret_key', placeholder: '••••••••',     hint: 'Production secret from the same credentials page', type: 'password' },
      { label: 'Environment', key: 'env',       placeholder: 'PROD / TEST',  hint: 'Use TEST for sandbox, PROD for live transactions' },
    ],
  },

  // ─── VoIP & Calling ───────────────────────────────────────────────
  {
    id: 'twilio', category: 'voip', name: 'Twilio',
    logo: ICONS.twilio,
    description: 'SMS, Voice and WhatsApp communication — click-to-call, bulk SMS and call recording synced to conversations.',
    accentColor: '#F22F46',
    docsUrl: 'https://www.twilio.com/docs',
    fields: [],
  },
  {
    id: 'exotel', category: 'voip', name: 'Exotel',
    logo: ICONS.exotel,
    description: 'Cloud telephony for India — IVR, click-to-call and call recording synced to conversation history.',
    accentColor: '#E56000',
    docsUrl: 'https://developer.exotel.com/api/',
    fields: [
      { label: 'SID (Account ID)', key: 'sid',        placeholder: 'exotel_sid',     hint: 'Exotel Dashboard → Settings → API Credentials' },
      { label: 'API Key',          key: 'api_key',    placeholder: 'xxxxxxxx',        hint: 'From the same API Credentials page' },
      { label: 'API Token',        key: 'api_token',  placeholder: '••••••••',        hint: 'Token paired with the API Key above', type: 'password' },
      { label: 'Subdomain',        key: 'subdomain',  placeholder: '@api.exotel.com', hint: 'Your Exotel account subdomain (e.g. mycompany@api.in.exotel.com)' },
    ],
  },
  {
    id: 'airtel', category: 'voip', name: 'Airtel IQ',
    logo: ICONS.airtel, isUpcoming: true,
    description: 'Enterprise cloud calling and verified SMS via Airtel IQ API.',
    accentColor: '#E40000',
    docsUrl: 'https://developers.airtel.in/',
    fields: [
      { label: 'Client ID',     key: 'client_id',     placeholder: 'Enter Airtel Client ID',  hint: 'Airtel Developer Console → My Applications → Client ID' },
      { label: 'Client Secret', key: 'client_secret', placeholder: '••••••••',                 hint: 'Paired secret for OAuth token generation', type: 'password' },
      { label: 'DID Number',    key: 'did',           placeholder: '+91XXXXXXXXXX',             hint: 'Your Airtel IQ virtual number in E.164 format' },
    ],
  },

  // ─── AI Providers ─────────────────────────────────────────────────
  {
    id: 'openai', category: 'ai', name: 'OpenAI',
    logo: ICONS.openai, isUpcoming: true,
    description: 'Power AI-assisted replies, summarisation and classification with GPT-4o and embedding models.',
    accentColor: '#412991',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    fields: [
      { label: 'API Key',        key: 'api_key',   placeholder: 'sk-proj-...',         hint: 'platform.openai.com → API keys → Create new secret key', type: 'password' },
      { label: 'Organization ID', key: 'org_id',  placeholder: 'org-xxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Optional — needed if your key belongs to multiple orgs' },
      { label: 'Default Model',  key: 'model',     placeholder: 'gpt-4o',              hint: 'e.g. gpt-4o, gpt-4o-mini — affects cost and quality' },
    ],
  },
  {
    id: 'anthropic', category: 'ai', name: 'Anthropic / Claude',
    logo: ICONS.anthropic, isUpcoming: true,
    description: 'Use Claude models for nuanced, long-context AI assistance within conversations.',
    accentColor: '#191919',
    docsUrl: 'https://docs.anthropic.com/en/api/getting-started',
    fields: [
      { label: 'API Key',       key: 'api_key', placeholder: 'sk-ant-api03-...',  hint: 'console.anthropic.com → Settings → API Keys → Create Key', type: 'password' },
      { label: 'Default Model', key: 'model',   placeholder: 'claude-sonnet-4-6', hint: 'e.g. claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="ml-2 text-slate-400 hover:text-slate-700 transition-colors" title="Copy">
      <Copy className={cn("w-3.5 h-3.5", copied && "text-green-500")} />
    </button>
  );
}

function RevealInput({ placeholder, value, onChange, disabled }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="h-11 rounded-xl bg-white border-slate-200 px-4 font-mono text-sm pr-10 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage({ currentUser }) {
  const teamId = useMemo(() => {
    if (!currentUser) return null;
    const ids = currentUser.teamIds || [];
    return ids.length > 0 ? ids[0] : null;
  }, [currentUser]);

  const [activeIntegrationId, setActiveIntegrationId] = useState(null);
  const [fieldValues, setFieldValues] = useState({});

  // WhatsApp
  const [whatsappSettings, setWhatsappSettings]       = useState({ phone_number_id:'', business_account_id:'', permanent_token:'', display_phone_number:'', is_active:false });
  const [allWhatsappSettings, setAllWhatsappSettings] = useState([]);
  const [discoveredPhones, setDiscoveredPhones]       = useState([]);
  const [isPhoneSelectModalOpen, setIsPhoneSelectModalOpen] = useState(false);
  const [discoveredWabaId, setDiscoveredWabaId]       = useState('');
  const [razorpaySettings, setRazorpaySettings]       = useState(null);
  const [isSavingRazorpay, setIsSavingRazorpay]       = useState(false);

  // Exotel
  const [exotelSettings, setExotelSettings]           = useState(null);
  const [isSavingExotel, setIsSavingExotel]           = useState(false);
  const [exotelFields, setExotelFields]               = useState({ sid: '', api_key: '', api_token: '', subdomain: 'api.in.exotel.com', caller_id: '' });
  const [exotelCallLogs, setExotelCallLogs]           = useState([]);
  const [exotelLoadingLogs, setExotelLoadingLogs]     = useState(false);
  const [dialerNumber, setDialerNumber]               = useState('');
  const [dialerFrom, setDialerFrom]                   = useState('');
  const [isDialing, setIsDialing]                     = useState(false);
  const [dialerStatus, setDialerStatus]               = useState(null); // null | 'calling' | 'success' | 'error'
  const [dialerMessage, setDialerMessage]             = useState('');
  const [discoveredToken, setDiscoveredToken]         = useState('');
  const [loadingWhatsapp, setLoadingWhatsapp]         = useState(false);

  // Twilio
  const [twilioSettings, setTwilioSettings]         = useState(null);
  const [isSavingTwilio, setIsSavingTwilio]         = useState(false);
  const [twilioFields, setTwilioFields]             = useState({ account_sid: '', auth_token: '', phone_number: '', messaging_service_sid: '' });
  const [twilioLogs, setTwilioLogs]                 = useState([]);
  const [twilioLoadingLogs, setTwilioLoadingLogs]   = useState(false);
  const [twilioTabType, setTwilioTabType]           = useState('all');
  const [twilioSmsTo, setTwilioSmsTo]               = useState('');
  const [twilioSmsBody, setTwilioSmsBody]           = useState('');
  const [isSendingSms, setIsSendingSms]             = useState(false);
  const [twilioCallTo, setTwilioCallTo]             = useState('');
  const [isDialingTwilio, setIsDialingTwilio]       = useState(false);
  const [twilioActionResult, setTwilioActionResult] = useState(null);

  // Telegram
  const [telegramSettings, setTelegramSettings] = useState([]);
  const [savingTelegram, setSavingTelegram]     = useState(false);
  const [botTokenInput, setBotTokenInput]       = useState('');
  const [botDisplayName, setBotDisplayName]     = useState('');

  // Instagram
  const [instagramStatus, setInstagramStatus] = useState({ connected: false, channels: [] });
  const [loadingInstagram, setLoadingInstagram] = useState(false);
  const [igAutomations, setIgAutomations] = useState([]);
  const [showAddAutomation, setShowAddAutomation] = useState(false);
  const [newAutomation, setNewAutomation] = useState({ type: 'auto_reply', name: '', keyword: '', message: '', delay_seconds: 2 });

  const [sdkLoaded, setSdkLoaded] = useState(false);
  useEffect(() => {
    if (window.FB) { setSdkLoaded(true); return; }
    window.fbAsyncInit = function () {
      window.FB.init({ appId: '321531509460250', cookie: true, xfbml: true, version: 'v21.0' });
      setSdkLoaded(true);
    };
    (function (d, s, id) {
      if (d.getElementById(id)) return;
      var js = d.createElement(s); js.id = id; js.src = 'https://connect.facebook.net/en_US/sdk.js';
      d.getElementsByTagName(s)[0].parentNode.insertBefore(js, d.getElementsByTagName(s)[0]);
    }(document, 'script', 'facebook-jssdk'));
  }, []);

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      try {
        const [wa, tg, ig, rzp, ext, twl] = await Promise.all([
          getWhatsAppSettings(teamId),
          getTelegramSettings(teamId),
          getInstagramStatus(),
          getRazorpaySettings(teamId),
          getExotelSettings(teamId),
          getTwilioSettings(teamId)
        ]);
        if (wa?.settings)    setWhatsappSettings(wa.settings);
        if (wa?.allSettings) setAllWhatsappSettings(wa.allSettings);
        if (tg?.settings)    setTelegramSettings(tg.settings);
        if (ig)              setInstagramStatus(ig);
        if (rzp?.settings) {
          setRazorpaySettings(rzp.settings);
          setFieldValues(prev => ({
            ...prev,
            razorpay: {
              key_id: rzp.settings.key_id,
              key_secret: rzp.settings.key_secret,
              webhook_secret: rzp.settings.webhook_secret
            }
          }));
        }
        if (ext?.settings) {
          setExotelSettings(ext.settings);
          setExotelFields({
            sid: ext.settings.sid || '',
            api_key: ext.settings.api_key || '',
            api_token: ext.settings.api_token || '',
            subdomain: ext.settings.subdomain || 'api.in.exotel.com',
            caller_id: ext.settings.caller_id || ''
          });
        }
        if (twl?.settings) {
          setTwilioSettings(twl.settings);
          setTwilioFields({
            account_sid: twl.settings.account_sid || '',
            auth_token: twl.settings.auth_token || '',
            phone_number: twl.settings.phone_number || '',
            messaging_service_sid: twl.settings.messaging_service_sid || ''
          });
        }
      } catch (err) { console.error('Error loading integrations', err); }
    })();
  }, [teamId]);

  // Load Instagram automations
  useEffect(() => {
    if (!instagramStatus.connected) return;
    (async () => {
      try {
        const res = await getInstagramAutomations();
        if (res?.automations) setIgAutomations(res.automations);
      } catch (err) { console.error('Error loading IG automations', err); }
    })();
  }, [instagramStatus.connected]);

  const activeIntegration = useMemo(() =>
    INTEGRATIONS_LIST.find(i => i.id === activeIntegrationId), [activeIntegrationId]);

  // Handlers
  const handleConnectWhatsApp = () => {
    if (!window.FB) return alert('SDK loading...');
    setLoadingWhatsapp(true);
    window.FB.login((response) => {
      if (response.authResponse) {
        onboardWhatsApp(response.authResponse.accessToken, teamId).then(res => {
          if (res.success) {
            if (res.data.phones?.length > 1) {
              setDiscoveredPhones(res.data.phones);
              setDiscoveredWabaId(res.data.businessAccountId);
              setDiscoveredToken(res.data.accessToken);
              setIsPhoneSelectModalOpen(true);
            } else if (res.data.phones?.length === 1) {
              const p = res.data.phones[0];
              const s = { phone_number_id: p.id, business_account_id: res.data.businessAccountId, display_phone_number: p.displayPhoneNumber, permanent_token: response.authResponse.accessToken, is_active: true };
              setWhatsappSettings(s);
              setAllWhatsappSettings(prev => [...prev.filter(x => x.phone_number_id !== p.id), s]);
            }
          }
        }).finally(() => setLoadingWhatsapp(false));
      } else setLoadingWhatsapp(false);
    }, { scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management,public_profile' });
  };

  const handleConnectTelegram = async () => {
    try {
      setSavingTelegram(true);
      const res = await connectTelegram(botTokenInput, botDisplayName || 'Bot', teamId);
      if (res.success) {
        setBotTokenInput('');
        const up = await getTelegramSettings(teamId);
        setTelegramSettings(up.settings);
      }
    } finally { setSavingTelegram(false); }
  };

  const handleSelectPhone = async (phone) => {
    const s = { phone_number_id: phone.id, business_account_id: discoveredWabaId, display_phone_number: phone.displayPhoneNumber, permanent_token: discoveredToken, is_active: true };
    setWhatsappSettings(s);
    setAllWhatsappSettings(prev => [...prev.filter(x => x.phone_number_id !== phone.id), s]);
    setIsPhoneSelectModalOpen(false);
  };

  const setField = (key, value) => setFieldValues(prev => ({ ...prev, [activeIntegrationId]: { ...(prev[activeIntegrationId] || {}), [key]: value } }));
  const getField = (key) => fieldValues[activeIntegrationId]?.[key] || '';

  // Instagram handlers
  const handleConnectInstagram = () => {
    if (!window.FB) return alert('Facebook SDK loading...');
    setLoadingInstagram(true);
    window.FB.login((response) => {
      if (response.authResponse) {
        connectInstagram(response.authResponse.accessToken).then(res => {
          if (res.success) {
            getInstagramStatus().then(s => setInstagramStatus(s));
          } else {
            alert(res.error || 'Failed to connect Instagram. Ensure your Instagram is a Business/Creator account linked to a Facebook Page.');
          }
        }).catch(err => {
          console.error('Instagram connect error:', err);
          alert('Failed to connect Instagram.');
        }).finally(() => setLoadingInstagram(false));
      } else {
        setLoadingInstagram(false);
      }
    }, {
      scope: 'instagram_basic,instagram_manage_messages,pages_messaging,pages_show_list,pages_manage_metadata,business_management,public_profile'
    });
  };

  const handleDisconnectInstagram = async (channelId) => {
    if (!confirm('Are you sure you want to disconnect this Instagram account?')) return;
    try {
      await disconnectInstagram(channelId);
      const s = await getInstagramStatus();
      setInstagramStatus(s);
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  const handleCreateAutomation = async () => {
    if (!newAutomation.name || !newAutomation.message) return alert('Name and message are required');
    const channelId = instagramStatus.channels?.[0]?.id;
    if (!channelId) return alert('No Instagram channel connected');
    try {
      await createInstagramAutomation({
        channel_id: channelId,
        type: newAutomation.type,
        name: newAutomation.name,
        trigger: { keyword: newAutomation.keyword, comment_keyword: newAutomation.keyword },
        action: { message: newAutomation.message, delay_seconds: parseInt(newAutomation.delay_seconds) || 2 },
        is_active: true
      });
      setShowAddAutomation(false);
      setNewAutomation({ type: 'auto_reply', name: '', keyword: '', message: '', delay_seconds: 2 });
      const res = await getInstagramAutomations();
      if (res?.automations) setIgAutomations(res.automations);
    } catch (err) {
      console.error('Create automation error:', err);
    }
  };

  const handleDeleteAutomation = async (id) => {
    if (!confirm('Delete this automation?')) return;
    try {
      await deleteInstagramAutomation(id);
      setIgAutomations(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Delete automation error:', err);
    }
  };

  const handleToggleAutomation = async (id) => {
    try {
      const res = await toggleInstagramAutomation(id);
      if (res) {
        setIgAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active: !a.is_active } : a));
      }
    } catch (err) {
      console.error('Toggle automation error:', err);
    }
  };

  const handleSaveGenericIntegration = async () => {
    const intg = activeIntegration;
    if (!intg) return;

    if (intg.id === 'razorpay') {
      try {
        setIsSavingRazorpay(true);
        const values = fieldValues['razorpay'] || {};
        const res = await updateRazorpaySettings(values, teamId);
        setRazorpaySettings(res);
        alert('Razorpay settings saved and connected!');
      } catch (err) {
        alert('Failed to save Razorpay settings: ' + (err.message || 'Unknown error'));
      } finally {
        setIsSavingRazorpay(false);
      }
    }
  };

  const handleDisconnectGeneric = async () => {
    const intg = activeIntegration;
    if (!intg) return;
    if (!confirm(`Are you sure you want to disconnect ${intg.name}?`)) return;

    if (intg.id === 'razorpay') {
      try {
        await disconnectRazorpay(teamId);
        setRazorpaySettings(null);
        setFieldValues(prev => ({ ...prev, razorpay: {} }));
      } catch (err) {
        alert('Failed to disconnect: ' + err.message);
      }
    }
  };

  // ─── Card Grid ──────────────────────────────────────────────────────
  const renderIntegrationCard = (item) => {
    const isConnected =
      (item.id === 'whatsapp' && allWhatsappSettings.length > 0) ||
      (item.id === 'telegram' && telegramSettings.length > 0) ||
      (item.id === 'instagram' && instagramStatus.connected) ||
      (item.id === 'razorpay' && !!razorpaySettings) ||
      (item.id === 'exotel' && !!exotelSettings) ||
      (item.id === 'twilio' && !!twilioSettings);
    return (
      <div
        key={item.id}
        onClick={() => setActiveIntegrationId(item.id)}
        className="group relative bg-white border border-slate-100 rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center p-2 overflow-hidden shrink-0"
            style={{ background: item.logoFallback ? `${item.accentColor}14` : '#f8fafc', border: `1px solid ${item.logoFallback ? item.accentColor + '25' : '#f1f5f9'}` }}>
            {item.logoFallback ? (
              <span className="text-xl leading-none">{item.logoFallback}</span>
            ) : (
              <img
                src={item.logo} alt={item.name}
                className="w-full h-full object-contain"
                onError={(e) => { e.target.style.display='none'; e.target.parentNode.innerHTML = `<span style="font-size:18px">🔌</span>`; }}
              />
            )}
          </div>
          {item.isUpcoming ? (
            <span className="bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
              Soon
            </span>
          ) : item.badge === 'New' ? (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.25)' }}>
              New
            </span>
          ) : item.badge === 'Featured' ? (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)' }}>
              ⚡ Featured
            </span>
          ) : isConnected ? (
            <span className="bg-green-50 text-green-600 border border-green-200 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
            </span>
          ) : (
            <span className="bg-blue-50 text-blue-500 border border-blue-200 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
              Connect
            </span>
          )}
        </div>
        <h4 className="text-sm font-bold text-slate-900 mb-0.5 leading-tight">{item.name}</h4>
        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{item.description}</p>
      </div>
    );
  };

  const renderOverview = () => (
    <div className="p-6 max-w-7xl mx-auto space-y-10">
      {CATEGORIES.map(cat => {
        const items = INTEGRATIONS_LIST.filter(i => i.category === cat.id);
        if (!items.length) return null;
        const CatIcon = cat.icon;
        return (
          <div key={cat.id} className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-900 rounded-lg"><CatIcon className="w-3 h-3 text-white" /></div>
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.18em]">{cat.name}</h3>
              <div className="h-px bg-slate-100 flex-1" />
              <span className="text-[10px] text-slate-300 font-medium">{items.length} apps</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {items.map(renderIntegrationCard)}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ─── Generic Detail (Coming Soon) ───────────────────────────────────
  const renderGenericDetail = () => {
    const intg = activeIntegration;
    const isDisabled = intg.isUpcoming;
    const isMCP = intg.category === 'mcp';
    const isConnected =
      (intg.id === 'razorpay' && !!razorpaySettings) ||
      (intg.id === 'whatsapp' && allWhatsappSettings.length > 0) ||
      (intg.id === 'telegram' && telegramSettings.length > 0) ||
      (intg.id === 'instagram' && instagramStatus.connected) ||
      (intg.id === 'exotel' && !!exotelSettings) ||
      (intg.id === 'twilio' && !!twilioSettings);
    const webhookUrl = `${window.location.origin}/webhooks/${intg.id}`;

    return (
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 -ml-2" onClick={() => setActiveIntegrationId(null)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> All Integrations
        </Button>

        {/* Header card */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-6 flex items-center gap-5 border-b border-slate-100" style={{ background: `linear-gradient(135deg, ${intg.accentColor}10 0%, #fff 60%)` }}>
            <div className="w-14 h-14 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center p-3 shrink-0">
              <img src={intg.logo} alt={intg.name} className="w-full h-full object-contain"
                onError={(e) => { e.target.src = "https://cdn.simpleicons.org/zapier/FF4A00"; }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-900">{intg.name}</h2>
                {isDisabled && (
                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    <Clock className="w-3 h-3" /> Coming Soon
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">{intg.description}</p>
              {intg.docsUrl && (
                <a href={intg.docsUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-500 hover:text-blue-700 font-medium">
                  <ExternalLink className="w-3 h-3" /> Official Documentation
                </a>
              )}
            </div>
          </div>

          {/* Coming soon notice */}
          {isDisabled && (
            <div className="mx-5 mt-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-700">Integration in Beta Testing</p>
                <p className="text-[11px] text-amber-600 mt-0.5">
                  Preview the required credentials below. You can fill them in advance — we'll activate this connection in the next release.
                </p>
              </div>
            </div>
          )}

          {/* MCP Server info */}
          {isMCP && intg.mcpServer && (
            <div className="mx-5 mt-5 bg-slate-900 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">MCP Server Endpoint</p>
              <div className="flex items-center justify-between gap-2">
                <code className="text-green-400 text-xs font-mono break-all">{intg.mcpServer}</code>
                <CopyButton value={intg.mcpServer} />
              </div>
              <p className="text-[10px] text-slate-500 mt-2">Transport: HTTP+SSE — configure your MCP client to point to this URL with your credentials below.</p>
            </div>
          )}

          {/* Credential fields */}
          {intg.fields.length > 0 && (
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Credential Configuration</p>
                {isDisabled && <span className="text-[10px] text-slate-300 font-medium">(read-only preview)</span>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {intg.fields.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      {f.label}
                      {f.type === 'password' && <Lock className="w-2.5 h-2.5 text-slate-300" />}
                    </label>
                    {f.type === 'password' ? (
                      <RevealInput
                        placeholder={f.placeholder}
                        value={getField(f.key)}
                        onChange={(e) => setField(f.key, e.target.value)}
                        disabled={isDisabled}
                        hint={f.hint}
                      />
                    ) : (
                      <Input
                        placeholder={f.placeholder}
                        value={getField(f.key)}
                        onChange={(e) => setField(f.key, e.target.value)}
                        disabled={isDisabled}
                        className="h-11 rounded-xl bg-white border-slate-200 px-4 text-sm disabled:opacity-50"
                      />
                    )}
                    {f.hint && <p className="text-[10px] text-slate-400 leading-snug">{f.hint}</p>}
                  </div>
                ))}
              </div>

              {/* Webhook URL row */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600">Webhook Callback URL</label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 h-11">
                  <code className="text-xs text-slate-600 font-mono flex-1 truncate">{webhookUrl}</code>
                  <CopyButton value={webhookUrl} />
                </div>
                <p className="text-[10px] text-slate-400">Point your {intg.name} webhook settings to this URL for real-time event sync.</p>
              </div>

              {/* Save / footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-400">
                  <ShieldCheck className="w-4 h-4" />
                  <p className="text-[10px] font-medium">Credentials encrypted with AES-256-GCM</p>
                </div>
                <div className="flex items-center gap-3">
                  {isConnected && (
                    <Button
                      variant="ghost"
                      className="h-10 px-4 text-red-500 hover:text-red-700 hover:bg-red-50 text-sm font-bold"
                      onClick={handleDisconnectGeneric}
                    >
                      Disconnect
                    </Button>
                  )}
                  <Button
                    disabled={isDisabled || isSavingRazorpay}
                    className="h-10 px-6 rounded-full bg-slate-900 text-white text-sm font-bold shadow-lg disabled:opacity-40"
                    onClick={handleSaveGenericIntegration}
                  >
                    {isSavingRazorpay ? 'Saving...' : 'Save & Connect'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: ExternalLink, title: 'Developer Console', desc: `Open ${intg.name} dashboard to create API credentials.` },
            { icon: Globe2,        title: 'Help Docs',         desc: `Step-by-step setup guide for this integration.` },
            { icon: Code2,         title: 'API Reference',     desc: `Explore the ${intg.name} API schema and endpoints.` },
          ].map((tile) => {
            const TIcon = tile.icon;
            return (
              <div key={tile.title} className="bg-white border border-slate-100 rounded-xl p-4">
                <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
                  <TIcon className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <p className="text-xs font-bold text-slate-900">{tile.title}</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">{tile.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── WhatsApp Detail ────────────────────────────────────────────────
  const renderWhatsAppDetail = () => (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" className="text-slate-500 -ml-2" onClick={() => setActiveIntegrationId(null)}>
        <ArrowLeft className="w-4 h-4 mr-1.5" /> All Integrations
      </Button>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-[#25D366] to-[#128C7E] p-6 text-white flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl p-2.5 flex items-center justify-center ring-1 ring-white/30">
            <img src={ICONS.whatsapp} className="w-full h-full" alt="WhatsApp" />
          </div>
          <div>
            <h2 className="text-2xl font-black">WhatsApp Business</h2>
            <p className="text-green-100 text-sm">Official Meta Cloud API</p>
          </div>
        </div>
        <div className="p-6">
          {!allWhatsappSettings.length ? (
            <div className="flex flex-col items-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-white rounded-2xl shadow border border-slate-100 flex items-center justify-center mb-5 p-3">
                <img src={ICONS.whatsapp} className="w-full h-full object-contain" alt="WhatsApp" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">One-Click Meta Sync</h3>
              <p className="text-sm text-slate-500 text-center max-w-xs mb-6">We'll automatically discover your verified numbers and WABA accounts.</p>
              <Button onClick={handleConnectWhatsApp} disabled={loadingWhatsapp || !sdkLoaded}
                className="bg-[#1877F2] hover:bg-[#166fe5] text-white px-10 h-12 rounded-full font-black text-sm shadow-lg shadow-blue-400/30">
                {loadingWhatsapp ? 'Authorizing...' : 'Connect with Meta'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {allWhatsappSettings.map(s => (
                <div key={s.phone_number_id}
                  className={cn("flex items-center justify-between border-2 p-4 rounded-xl transition-all",
                    whatsappSettings.phone_number_id === s.phone_number_id ? "border-green-400 bg-green-50/30" : "border-slate-100")}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                      <img src={ICONS.whatsapp} className="w-6 h-6" alt="WA" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{s.display_phone_number || 'Business Account'}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{s.phone_number_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.is_active && <span className="bg-green-100 text-green-600 text-[10px] font-bold px-2.5 py-1 rounded-full">LIVE</span>}
                    <Button variant="ghost" size="icon" onClick={() => disconnectWhatsApp(s.phone_number_id, teamId)}
                      className="w-9 h-9 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <Button onClick={handleConnectWhatsApp} variant="outline"
                  className="h-10 px-6 rounded-full border-2 font-bold text-sm text-slate-600">
                  + Add Another Number
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ─── Telegram Detail ────────────────────────────────────────────────
  const renderTelegramDetail = () => (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" className="text-slate-500 -ml-2" onClick={() => setActiveIntegrationId(null)}>
        <ArrowLeft className="w-4 h-4 mr-1.5" /> All Integrations
      </Button>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-[#26A5E4] to-[#1a8bc5] p-6 text-white flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl p-2.5 flex items-center justify-center ring-1 ring-white/30">
            <img src={ICONS.telegram} className="w-full h-full" alt="Telegram" />
          </div>
          <div>
            <h2 className="text-2xl font-black">Telegram Bot</h2>
            <p className="text-blue-100 text-sm">BotFather-powered channels</p>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {telegramSettings.length > 0 && (
            <div className="space-y-3">
              {telegramSettings.map(bot => (
                <div key={bot.id} className="flex items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <Send className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">@{bot.bot_username}</p>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{bot.display_name}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => disconnectTelegram(bot.bot_token, teamId)}
                    className="text-red-500 text-xs font-bold hover:bg-red-50 rounded-lg px-3 h-8">
                    Disconnect
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Add New Bot</p>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                HTTP API Token <Lock className="w-2.5 h-2.5 text-slate-300" />
              </label>
              <RevealInput
                placeholder="000000000:AAHxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxx"
                value={botTokenInput}
                onChange={(e) => setBotTokenInput(e.target.value)}
              />
              <p className="text-[10px] text-slate-400">Get this from <a href="https://t.me/botfather" target="_blank" rel="noreferrer" className="text-blue-500 font-medium">@BotFather</a> → /newbot or /mybots → API Token</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600">Display Name</label>
              <Input
                value={botDisplayName} onChange={(e) => setBotDisplayName(e.target.value)}
                placeholder="Support Bot — Primary"
                className="h-11 rounded-xl bg-white border-slate-200 px-4 text-sm"
              />
              <p className="text-[10px] text-slate-400">Internal label to identify this bot in your workspace</p>
            </div>
            <Button onClick={handleConnectTelegram} disabled={savingTelegram || !botTokenInput}
              className="w-full bg-slate-900 hover:bg-black h-11 rounded-xl text-white font-bold text-sm shadow-lg disabled:opacity-40">
              {savingTelegram ? 'Validating...' : 'Connect Bot'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Instagram Detail ────────────────────────────────────────────────
  const renderInstagramDetail = () => (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" className="text-slate-500 -ml-2" onClick={() => setActiveIntegrationId(null)}>
        <ArrowLeft className="w-4 h-4 mr-1.5" /> All Integrations
      </Button>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-6 text-white flex items-center gap-4" style={{ background: 'linear-gradient(135deg, #833AB4, #E1306C, #F77737)' }}>
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl p-2.5 flex items-center justify-center ring-1 ring-white/30">
            <img src={ICONS.instagram} className="w-full h-full" alt="Instagram" />
          </div>
          <div>
            <h2 className="text-2xl font-black">Instagram DMs</h2>
            <p className="text-pink-100 text-sm">Meta Graph API</p>
          </div>
        </div>
        <div className="p-6">
          {!instagramStatus.connected ? (
            <div className="flex flex-col items-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-white rounded-2xl shadow border border-slate-100 flex items-center justify-center mb-5 p-3">
                <img src={ICONS.instagram} className="w-full h-full object-contain" alt="Instagram" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">Connect Instagram Business</h3>
              <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
                Link your Instagram Business/Creator account through Facebook Login to manage DMs, set up auto-replies, and comment-to-DM automations.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 max-w-sm">
                <p className="text-xs font-bold text-amber-700 mb-1">📋 Prerequisites</p>
                <ul className="text-[11px] text-amber-600 space-y-1">
                  <li>• Instagram account must be Business or Creator type</li>
                  <li>• Must be linked to a Facebook Page</li>
                  <li>• Webhook must be configured in Meta App Dashboard</li>
                </ul>
              </div>
              <Button onClick={handleConnectInstagram} disabled={loadingInstagram || !sdkLoaded}
                className="text-white px-10 h-12 rounded-full font-black text-sm shadow-lg shadow-pink-400/30"
                style={{ background: 'linear-gradient(135deg, #833AB4, #E1306C)' }}>
                {loadingInstagram ? 'Connecting...' : 'Connect with Facebook'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {instagramStatus.channels?.map(ch => (
                <div key={ch.id}
                  className="flex items-center justify-between border-2 p-4 rounded-xl transition-all border-pink-300 bg-pink-50/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center overflow-hidden">
                      {ch.profilePicture ? (
                        <img src={ch.profilePicture} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <img src={ICONS.instagram} className="w-6 h-6" alt="IG" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 leading-none">{ch.username || ch.name}</p>
                        <a 
                          href={`https://instagram.com/${(ch.username || ch.name)?.replace('@', '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] text-pink-600 hover:text-pink-700 bg-pink-50 px-1.5 py-0.5 rounded font-medium border border-pink-100 transition-colors"
                        >
                          View Profile
                        </a>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        ID: <span className="font-mono text-slate-500">{ch.externalId}</span>
                        {ch.followersCount ? ` • ${ch.followersCount.toLocaleString()} followers` : ''}
                        {ch.pageName ? ` • Page: ${ch.pageName}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-green-100 text-green-600 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleDisconnectInstagram(ch.id)}
                      className="w-9 h-9 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <Button onClick={handleConnectInstagram} variant="outline"
                  className="h-10 px-6 rounded-full border-2 font-bold text-sm text-slate-600">
                  + Add Another Account
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Automation Rules Section */}
      {instagramStatus.connected && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">Automation Rules</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Auto-reply, comment-to-DM, and auto-DM rules</p>
            </div>
            <Button onClick={() => setShowAddAutomation(true)}
              className="h-9 px-4 rounded-full bg-slate-900 text-white font-bold text-xs">
              + Add Rule
            </Button>
          </div>
          <div className="p-5 space-y-3">
            {igAutomations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400">No automation rules yet.</p>
                <p className="text-xs text-slate-300 mt-1">Create auto-reply, comment-to-DM, or auto-DM rules.</p>
              </div>
            ) : (
              igAutomations.map(rule => (
                <div key={rule.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center text-white text-[10px] font-black",
                      rule.type === 'auto_reply' ? "bg-blue-500" : rule.type === 'comment_dm' ? "bg-purple-500" : "bg-green-500"
                    )}>
                      {rule.type === 'auto_reply' ? '↩️' : rule.type === 'comment_dm' ? '💬' : '📩'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{rule.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn(
                          "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase",
                          rule.type === 'auto_reply' ? "bg-blue-50 text-blue-600" : rule.type === 'comment_dm' ? "bg-purple-50 text-purple-600" : "bg-green-50 text-green-600"
                        )}>
                          {rule.type.replace('_', ' ')}
                        </span>
                        {rule.trigger_config?.keyword && (
                          <span className="text-[10px] text-slate-400">Keywords: {rule.trigger_config.keyword}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleAutomation(rule.id)}
                      className={cn(
                        "relative w-10 h-5 rounded-full transition-colors",
                        rule.is_active ? "bg-green-500" : "bg-slate-300"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                        rule.is_active ? "translate-x-5" : "translate-x-0.5"
                      )} />
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteAutomation(rule.id)}
                      className="w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Quick Setup Guide */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-sm font-black text-slate-900 mb-3">📋 Meta Developers Setup</h3>
        <div className="space-y-3">
          {[
            { step: '1', title: 'Create Meta App', desc: 'Go to developers.facebook.com → My Apps → Create App' },
            { step: '2', title: 'Add Instagram Product', desc: 'In your app, go to Add Products → Instagram → Set Up' },
            { step: '3', title: 'Configure Webhooks', desc: 'Webhooks → Instagram → Callback URL: https://inbox.xolox.io/webhooks/instagram' },
            { step: '4', title: 'Subscribe to Fields', desc: 'Enable: messages, messaging_postbacks, comments, mentions' },
            { step: '5', title: 'Connect Account', desc: 'Click "Connect with Facebook" above and grant permissions' },
          ].map(s => (
            <div key={s.step} className="flex gap-3">
              <span className="w-6 h-6 bg-slate-900 text-white text-[10px] font-black rounded-full flex items-center justify-center shrink-0">{s.step}</span>
              <div>
                <p className="text-xs font-bold text-slate-700">{s.title}</p>
                <p className="text-[10px] text-slate-400">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Automation Modal */}
      <Modal isOpen={showAddAutomation} onClose={() => setShowAddAutomation(false)} title="Create Automation Rule">
        <div className="space-y-4 p-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600">Rule Type</label>
            <select value={newAutomation.type}
              onChange={(e) => setNewAutomation(p => ({ ...p, type: e.target.value }))}
              className="w-full h-11 rounded-xl bg-white border border-slate-200 px-4 text-sm">
              <option value="auto_reply">Auto Reply — Automatically reply to incoming DMs</option>
              <option value="comment_dm">Comment to DM — Send DM when someone comments</option>
              <option value="auto_dm">Auto DM — Send DM on follow / interaction</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600">Rule Name</label>
            <Input value={newAutomation.name}
              onChange={(e) => setNewAutomation(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Welcome Message" className="h-11 rounded-xl bg-white border-slate-200 px-4 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600">Trigger Keywords (optional, comma-separated)</label>
            <Input value={newAutomation.keyword}
              onChange={(e) => setNewAutomation(p => ({ ...p, keyword: e.target.value }))}
              placeholder="e.g. price, info, hello (leave empty to match all)"
              className="h-11 rounded-xl bg-white border-slate-200 px-4 text-sm" />
            <p className="text-[10px] text-slate-400">Leave empty to trigger on every incoming message or comment</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600">Auto-Reply Message</label>
            <textarea value={newAutomation.message}
              onChange={(e) => setNewAutomation(p => ({ ...p, message: e.target.value }))}
              placeholder="Hi! 👋 Thanks for reaching out. We'll get back to you shortly."
              rows={3}
              className="w-full rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm resize-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600">Delay (seconds)</label>
            <Input type="number" value={newAutomation.delay_seconds}
              onChange={(e) => setNewAutomation(p => ({ ...p, delay_seconds: e.target.value }))}
              placeholder="2" min="0" max="60"
              className="h-11 rounded-xl bg-white border-slate-200 px-4 text-sm w-32" />
            <p className="text-[10px] text-slate-400">Delay before sending (for a more natural feel)</p>
          </div>
          <Button onClick={handleCreateAutomation}
            className="w-full bg-slate-900 hover:bg-black h-11 rounded-xl text-white font-bold text-sm shadow-lg">
            Create Automation
          </Button>
        </div>
      </Modal>
    </div>
  );

  // ─── Exotel Detail ──────────────────────────────────────────────────
  const handleSaveExotel = async () => {
    if (!exotelFields.sid || !exotelFields.api_key || !exotelFields.api_token || !exotelFields.subdomain) {
      alert('SID, API Key, API Token and Subdomain are required.');
      return;
    }
    setIsSavingExotel(true);
    try {
      const res = await updateExotelSettings(exotelFields, teamId);
      if (res.error) throw new Error(res.error);
      setExotelSettings(res.settings);
      alert('Exotel connected successfully!');
    } catch (err) {
      alert('Failed to save Exotel settings: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingExotel(false);
    }
  };

  const handleDisconnectExotel = async () => {
    if (!window.confirm('Disconnect Exotel? This will remove all stored credentials.')) return;
    try {
      await disconnectExotel(teamId);
      setExotelSettings(null);
      setExotelFields({ sid: '', api_key: '', api_token: '', subdomain: 'api.in.exotel.com', caller_id: '' });
    } catch (err) {
      alert('Failed to disconnect: ' + err.message);
    }
  };

  const handleLoadCallLogs = async () => {
    setExotelLoadingLogs(true);
    try {
      const res = await getExotelCallLogs(teamId);
      setExotelCallLogs(res.calls || []);
    } catch (err) {
      console.error('Failed to load call logs:', err);
    } finally {
      setExotelLoadingLogs(false);
    }
  };

  const handleInitiateCall = async () => {
    if (!dialerNumber) { alert('Enter a phone number to call'); return; }
    setIsDialing(true);
    setDialerStatus('calling');
    setDialerMessage('');
    try {
      const res = await initiateExotelCall({ to: dialerNumber, from: dialerFrom || undefined }, teamId);
      if (res.error) throw new Error(res.error);
      setDialerStatus('success');
      setDialerMessage(`Call initiated! SID: ${res.call?.callSid || '—'}`);
      // Refresh logs
      handleLoadCallLogs();
    } catch (err) {
      setDialerStatus('error');
      setDialerMessage(err.message || 'Call failed');
    } finally {
      setIsDialing(false);
    }
  };

  const renderExotelDetail = () => {
    const isConnected = !!exotelSettings;
    const webhookUrl = `${window.location.origin}/webhooks/exotel/status`;

    return (
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 -ml-2" onClick={() => setActiveIntegrationId(null)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> All Integrations
        </Button>

        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-6 flex items-center gap-5 border-b border-slate-100" style={{ background: 'linear-gradient(135deg, #E5600010 0%, #fff 60%)' }}>
            <div className="w-14 h-14 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center p-3 shrink-0">
              <img src={ICONS.exotel} alt="Exotel" className="w-full h-full object-contain" onError={e => { e.target.src = 'https://cdn.simpleicons.org/phone/E56000'; }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-900">Exotel</h2>
                {isConnected
                  ? <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">● Connected</span>
                  : <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-500 border border-slate-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">Not Connected</span>
                }
              </div>
              <p className="text-sm text-slate-500 mt-1">Cloud telephony for India — IVR, click-to-call and call recording synced to conversation history.</p>
              <a href="https://developer.exotel.com/api/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-500 hover:text-blue-700 font-medium">
                <ExternalLink className="w-3 h-3" /> Official Documentation
              </a>
            </div>
          </div>

          {/* Setup Guide */}
          <div className="p-5 border-b border-slate-100">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Setup Guide</p>
            <ol className="space-y-3">
              {[
                { step: '1', title: 'Log in to Exotel Dashboard', desc: 'Go to my.exotel.com → Settings → API Credentials. You will find your Account SID, API Key, and API Token here.' },
                { step: '2', title: 'Copy your API Credentials', desc: 'Copy the SID, API Key, API Token and your account subdomain (e.g. api.in.exotel.com for India).' },
                { step: '3', title: 'Note your ExoPhone (Caller ID)', desc: 'From the Exotel dashboard, go to Phone Numbers and copy the virtual number you want to use as caller ID.' },
                { step: '4', title: 'Paste credentials below & Save', desc: 'Fill in the form below and click Save & Connect.' },
                { step: '5', title: 'Configure the Status Callback URL', desc: 'In Exotel Dashboard → Apps → your app, set the Status Callback URL to the webhook URL shown below so call events are synced back.' },
              ].map(g => (
                <li key={g.step} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">{g.step}</span>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{g.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{g.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Credentials form */}
          <div className="p-5 space-y-4 border-b border-slate-100">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Credentials</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Account SID', key: 'sid', placeholder: 'exotel_sid', hint: 'Exotel Dashboard → Settings → API Credentials' },
                { label: 'API Key', key: 'api_key', placeholder: 'xxxxxxxx', hint: 'From the same API Credentials page' },
                { label: 'API Token', key: 'api_token', placeholder: '••••••••', hint: 'Token paired with the API Key above', secret: true },
                { label: 'Subdomain', key: 'subdomain', placeholder: 'api.in.exotel.com', hint: 'Your regional subdomain — India: api.in.exotel.com' },
                { label: 'Default Caller ID (ExoPhone)', key: 'caller_id', placeholder: '+91XXXXXXXXXX', hint: 'Virtual number shown to customers when you call them' },
              ].map(f => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    {f.label} {f.secret && <Lock className="w-2.5 h-2.5 text-slate-300" />}
                  </label>
                  {f.secret
                    ? <RevealInput placeholder={f.placeholder} value={exotelFields[f.key]} onChange={e => setExotelFields(p => ({ ...p, [f.key]: e.target.value }))} />
                    : <Input placeholder={f.placeholder} value={exotelFields[f.key]} onChange={e => setExotelFields(p => ({ ...p, [f.key]: e.target.value }))} className="h-11 rounded-xl bg-white border-slate-200 px-4 text-sm" />
                  }
                  {f.hint && <p className="text-[10px] text-slate-400 leading-snug">{f.hint}</p>}
                </div>
              ))}
            </div>

            {/* Webhook URL */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600">Status Callback / Webhook URL</label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 h-11">
                <code className="text-xs text-slate-600 font-mono flex-1 truncate">{webhookUrl}</code>
                <CopyButton value={webhookUrl} />
              </div>
              <p className="text-[10px] text-slate-400">Set this as the StatusCallback in your Exotel app to receive real-time call status updates.</p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-slate-400">
                <ShieldCheck className="w-4 h-4" /><p className="text-[10px] font-medium">Credentials stored encrypted</p>
              </div>
              <div className="flex items-center gap-3">
                {isConnected && (
                  <Button variant="ghost" className="h-10 px-4 text-red-500 hover:text-red-700 hover:bg-red-50 text-sm font-bold" onClick={handleDisconnectExotel}>
                    Disconnect
                  </Button>
                )}
                <Button disabled={isSavingExotel} className="h-10 px-6 rounded-full bg-slate-900 text-white text-sm font-bold shadow-lg disabled:opacity-40" onClick={handleSaveExotel}>
                  {isSavingExotel ? 'Saving…' : isConnected ? 'Update Credentials' : 'Save & Connect'}
                </Button>
              </div>
            </div>
          </div>

          {/* Dialer — only when connected */}
          {isConnected && (
            <div className="p-5 border-b border-slate-100">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Click-to-Call Dialer</p>
              <div className="bg-slate-900 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-bold text-white">Initiate an Outbound Call</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Number (To)</label>
                    <input
                      type="tel"
                      placeholder="+91XXXXXXXXXX"
                      value={dialerNumber}
                      onChange={e => setDialerNumber(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Agent / From Number (optional)</label>
                    <input
                      type="tel"
                      placeholder={exotelFields.caller_id || '+91XXXXXXXXXX'}
                      value={dialerFrom}
                      onChange={e => setDialerFrom(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleInitiateCall}
                    disabled={isDialing}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    {isDialing ? 'Initiating…' : 'Call Now'}
                  </button>
                  {dialerStatus === 'success' && <span className="text-xs text-green-400 font-medium">{dialerMessage}</span>}
                  {dialerStatus === 'error' && <span className="text-xs text-red-400 font-medium">{dialerMessage}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Call Logs — only when connected */}
          {isConnected && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Recent Call Logs</p>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleLoadCallLogs} disabled={exotelLoadingLogs}>
                  {exotelLoadingLogs ? 'Loading…' : 'Refresh'}
                </Button>
              </div>
              {exotelCallLogs.length === 0
                ? <p className="text-sm text-slate-400 text-center py-8">No call logs yet. Make a call to see history here.</p>
                : (
                  <div className="space-y-2">
                    {exotelCallLogs.map(log => (
                      <div key={log.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${log.direction === 'inbound' ? 'bg-blue-100' : 'bg-orange-100'}`}>
                          <Phone className={`w-4 h-4 ${log.direction === 'inbound' ? 'text-blue-600' : 'text-orange-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 truncate">{log.to_number || log.from_number}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                              log.status === 'completed' ? 'bg-green-100 text-green-700'
                              : log.status === 'failed' || log.status === 'busy' ? 'bg-red-100 text-red-700'
                              : 'bg-slate-200 text-slate-600'
                            }`}>{log.status}</span>
                            <span className="text-[10px] text-slate-400 uppercase">{log.direction}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {log.duration > 0 && <span>{log.duration}s · </span>}
                            {log.contact_name && <span>{log.contact_name} · </span>}
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                        </div>
                        {log.recording_url && (
                          <a href={log.recording_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline shrink-0">Recording</a>
                        )}
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}
        </div>

        {/* Workflow events info */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Workflow Events & Actions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'call_answered', desc: 'Triggered when a call is picked up', color: 'bg-blue-50 text-blue-700 border-blue-100' },
              { label: 'call_completed', desc: 'Triggered when a call ends successfully', color: 'bg-green-50 text-green-700 border-green-100' },
              { label: 'call_failed', desc: 'Triggered on busy / no-answer / failed', color: 'bg-red-50 text-red-700 border-red-100' },
              { label: 'Initiate Call (node)', desc: 'Workflow action to place an outbound call', color: 'bg-orange-50 text-orange-700 border-orange-100' },
            ].map(e => (
              <div key={e.label} className={`flex items-start gap-2 p-3 rounded-xl border ${e.color}`}>
                <div>
                  <p className="text-xs font-bold">{e.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-80">{e.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: ExternalLink, title: 'Exotel Dashboard', desc: 'Login to my.exotel.com to manage numbers, apps and call logs.' },
            { icon: Globe2, title: 'API Docs', desc: 'Full REST API reference at developer.exotel.com/api/.' },
            { icon: Code2, title: 'Webhook Reference', desc: 'Callback parameters sent by Exotel on call status changes.' },
          ].map(tile => {
            const TIcon = tile.icon;
            return (
              <div key={tile.title} className="bg-white border border-slate-100 rounded-xl p-4">
                <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
                  <TIcon className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <p className="text-xs font-bold text-slate-900">{tile.title}</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">{tile.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── Twilio handlers ──────────────────────────────────────────────
  const handleSaveTwilio = async () => {
    if (!twilioFields.account_sid || !twilioFields.auth_token || !twilioFields.phone_number) {
      alert('Account SID, Auth Token and Phone Number are required.');
      return;
    }
    setIsSavingTwilio(true);
    try {
      const res = await updateTwilioSettings(twilioFields, teamId);
      if (res.error) throw new Error(res.error);
      setTwilioSettings(res.settings);
      alert('Twilio connected successfully!');
    } catch (err) {
      alert('Failed to save Twilio settings: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingTwilio(false);
    }
  };

  const handleDisconnectTwilio = async () => {
    if (!window.confirm('Disconnect Twilio? This will remove all stored credentials.')) return;
    try {
      await disconnectTwilio(teamId);
      setTwilioSettings(null);
      setTwilioFields({ account_sid: '', auth_token: '', phone_number: '', messaging_service_sid: '' });
    } catch (err) {
      alert('Failed to disconnect: ' + (err.message || 'Unknown error'));
    }
  };

  const handleLoadTwilioLogs = async () => {
    setTwilioLoadingLogs(true);
    try {
      const res = await getTwilioLogs(teamId, { type: twilioTabType === 'all' ? undefined : twilioTabType });
      setTwilioLogs(res.logs || []);
    } catch (err) {
      console.error('Failed to load Twilio logs', err);
    } finally {
      setTwilioLoadingLogs(false);
    }
  };

  const handleSendTwilioSms = async () => {
    if (!twilioSmsTo || !twilioSmsBody) return;
    setIsSendingSms(true);
    setTwilioActionResult(null);
    try {
      const res = await sendTwilioSms({ to: twilioSmsTo, body: twilioSmsBody }, teamId);
      if (res.error) throw new Error(res.error);
      setTwilioActionResult({ success: true, message: `SMS sent! SID: ${res.message?.sid || '—'}` });
      setTwilioSmsTo('');
      setTwilioSmsBody('');
      setTimeout(() => { handleLoadTwilioLogs(); setTwilioActionResult(null); }, 2000);
    } catch (err) {
      setTwilioActionResult({ success: false, message: err.message || 'Failed to send SMS' });
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleTwilioCall = async () => {
    if (!twilioCallTo) return;
    setIsDialingTwilio(true);
    setTwilioActionResult(null);
    try {
      const res = await initiateTwilioCall({ to: twilioCallTo }, teamId);
      if (res.error) throw new Error(res.error);
      setTwilioActionResult({ success: true, message: `Call initiated! SID: ${res.call?.sid || '—'}` });
      setTwilioCallTo('');
      setTimeout(() => { handleLoadTwilioLogs(); setTwilioActionResult(null); }, 3000);
    } catch (err) {
      setTwilioActionResult({ success: false, message: err.message || 'Failed to initiate call' });
    } finally {
      setIsDialingTwilio(false);
    }
  };

  const renderTwilioDetail = () => {
    const isConnected = !!twilioSettings;
    const smsCbUrl = `${window.location.origin}/webhooks/twilio/sms`;
    const callCbUrl = `${window.location.origin}/webhooks/twilio/call`;

    return (
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 -ml-2" onClick={() => setActiveIntegrationId(null)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> All Integrations
        </Button>

        {/* Header */}
        <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
          <div className="w-14 h-14 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center p-3 shrink-0">
            <img src={ICONS.twilio} alt="Twilio" className="w-full h-full object-contain" onError={e => { e.target.src = 'https://cdn.simpleicons.org/twilio/F22F46'; }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900">Twilio</h2>
              {isConnected
                ? <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Connected</span>
                : <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Not Connected</span>
              }
            </div>
            <p className="text-sm text-slate-500 mt-1">SMS, Voice and WhatsApp communication — click-to-call, bulk SMS and call recording synced to conversations.</p>
            <a href="https://www.twilio.com/docs" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-500 hover:text-blue-700 font-medium">
              <ExternalLink className="w-3 h-3" /> Official Documentation
            </a>
          </div>
        </div>

        {/* Setup Guide */}
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <h3 className="font-black text-slate-800 text-sm mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">?</span>
            How to connect Twilio
          </h3>
          <ol className="space-y-3">
            {[
              { step: '1', title: 'Create a Twilio Account', desc: 'Sign up at twilio.com. After verification you will land on the Console Dashboard.' },
              { step: '2', title: 'Copy your Account SID & Auth Token', desc: 'Go to Console → Dashboard. Your Account SID and Auth Token are shown at the top.' },
              { step: '3', title: 'Buy or verify a phone number', desc: 'In Console → Phone Numbers → Manage → Buy a Number. Copy the number (e.g. +1 415 XXXXXXX).' },
              { step: '4', title: 'Paste credentials below & Save', desc: 'Fill in Account SID, Auth Token, and Phone Number, then click Save & Connect.' },
              { step: '5', title: 'Set Webhook URLs in Twilio Console', desc: 'In Phone Numbers → Active Numbers → click your number. Set the SMS Webhook and Voice Webhook URLs shown below (A Call Comes In / A Message Comes In).' },
            ].map(g => (
              <li key={g.step} className="flex gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">{g.step}</span>
                <div><span className="font-bold text-slate-800">{g.title}</span> — <span className="text-slate-500">{g.desc}</span></div>
              </li>
            ))}
          </ol>
        </div>

        {/* Credentials Form */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
          <h3 className="font-black text-slate-800 text-sm">API Credentials</h3>
          {[
            { label: 'Account SID', key: 'account_sid', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Console Dashboard → top of page' },
            { label: 'Auth Token', key: 'auth_token', placeholder: '••••••••', hint: 'Console Dashboard → click eye icon to reveal', secret: true },
            { label: 'Default Phone Number', key: 'phone_number', placeholder: '+14155552671', hint: 'E.164 format — the number used to send SMS and make calls' },
            { label: 'Messaging Service SID (optional)', key: 'messaging_service_sid', placeholder: 'MGxxxxxxxx', hint: 'Use a Messaging Service for number pools and advanced routing' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-bold text-slate-700 block mb-1">{f.label}</label>
              {f.secret
                ? <RevealInput placeholder={f.placeholder} value={twilioFields[f.key]} onChange={e => setTwilioFields(p => ({ ...p, [f.key]: e.target.value }))} />
                : <Input placeholder={f.placeholder} value={twilioFields[f.key]} onChange={e => setTwilioFields(p => ({ ...p, [f.key]: e.target.value }))} className="h-11 rounded-xl bg-white border-slate-200 px-4 text-sm" />
              }
              {f.hint && <p className="text-[10px] text-slate-400 mt-1">{f.hint}</p>}
            </div>
          ))}
        </div>

        {/* Webhook URLs */}
        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 space-y-3">
          <h3 className="font-black text-slate-800 text-sm mb-1">Webhook URLs</h3>
          {[
            { label: 'SMS Status Callback', url: smsCbUrl, hint: 'Set in Console → Phone Numbers → your number → "A Message Comes In"' },
            { label: 'Call Status Callback', url: callCbUrl, hint: 'Set in Console → Phone Numbers → your number → "A Call Comes In"' },
          ].map(w => (
            <div key={w.label}>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">{w.label}</label>
              <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2">
                <code className="flex-1 text-xs font-mono text-slate-700 truncate">{w.url}</code>
                <button onClick={() => navigator.clipboard.writeText(w.url)} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 shrink-0">Copy</button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">{w.hint}</p>
            </div>
          ))}
        </div>

        {/* Save / Disconnect */}
        <div className="flex items-center justify-between pt-2">
          {isConnected && (
            <Button variant="ghost" className="h-10 px-4 text-red-500 hover:text-red-700 hover:bg-red-50 text-sm font-bold" onClick={handleDisconnectTwilio}>
              Disconnect
            </Button>
          )}
          <div className="ml-auto">
            <Button disabled={isSavingTwilio} className="h-10 px-6 rounded-full bg-slate-900 text-white text-sm font-bold shadow-lg disabled:opacity-40" onClick={handleSaveTwilio}>
              {isSavingTwilio ? 'Saving…' : isConnected ? 'Update Credentials' : 'Save & Connect'}
            </Button>
          </div>
        </div>

        {/* SMS + Call actions (only when connected) */}
        {isConnected && (
          <>
            {/* Send SMS */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
              <h3 className="font-black text-slate-800 text-sm">Send SMS</h3>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">To (phone number)</label>
                <Input type="tel" placeholder="+91XXXXXXXXXX" value={twilioSmsTo} onChange={e => setTwilioSmsTo(e.target.value)} className="h-10 rounded-xl bg-white border-slate-200 px-4 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Message</label>
                <textarea
                  value={twilioSmsBody}
                  onChange={e => setTwilioSmsBody(e.target.value)}
                  placeholder="Type your SMS message…"
                  rows={3}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400/30 resize-none"
                />
              </div>
              <Button disabled={!twilioSmsTo || !twilioSmsBody || isSendingSms} className="h-9 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-40" onClick={handleSendTwilioSms}>
                {isSendingSms ? 'Sending…' : 'Send SMS'}
              </Button>
            </div>

            {/* Voice Call */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
              <h3 className="font-black text-slate-800 text-sm">Initiate Voice Call</h3>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">To (phone number)</label>
                <Input type="tel" placeholder="+91XXXXXXXXXX" value={twilioCallTo} onChange={e => setTwilioCallTo(e.target.value)} className="h-10 rounded-xl bg-white border-slate-200 px-4 text-sm" />
              </div>
              <Button disabled={!twilioCallTo || isDialingTwilio} className="h-9 px-4 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold disabled:opacity-40" onClick={handleTwilioCall}>
                {isDialingTwilio ? 'Calling…' : 'Call'}
              </Button>

              {twilioActionResult && (
                <div className={`p-3 rounded-xl flex items-center gap-2 text-sm font-medium ${twilioActionResult.success ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                  {twilioActionResult.message}
                </div>
              )}
            </div>

            {/* Logs */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-800 text-sm">Activity Logs</h3>
                <div className="flex items-center gap-2">
                  <select value={twilioTabType} onChange={e => setTwilioTabType(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none">
                    <option value="all">All</option>
                    <option value="sms">SMS</option>
                    <option value="call">Calls</option>
                  </select>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleLoadTwilioLogs} disabled={twilioLoadingLogs}>
                    {twilioLoadingLogs ? 'Loading…' : 'Refresh'}
                  </Button>
                </div>
              </div>
              {twilioLogs.length === 0
                ? <p className="text-sm text-slate-400 text-center py-8">No logs yet. Send an SMS or make a call to see history.</p>
                : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {twilioLogs.map(log => (
                      <div key={log.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${log.type === 'sms' ? 'bg-blue-100' : 'bg-green-100'}`}>
                          <span className="text-[9px] font-black uppercase tracking-wide text-slate-600">{log.type}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{log.contact_name || log.to_number}</p>
                          {log.body && <p className="text-[11px] text-slate-400 truncate">{log.body}</p>}
                          <p className="text-[10px] text-slate-400">{log.direction} · {log.status} {log.duration ? `· ${log.duration}s` : ''}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">{log.created_at ? new Date(log.created_at).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>

            {/* Workflow Events */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
              <h3 className="font-black text-slate-800 text-sm mb-3">Workflow Trigger Events</h3>
              <div className="space-y-2">
                {[
                  { event: 'sms_delivered', desc: 'Fires when an outbound SMS is delivered to the recipient.' },
                  { event: 'sms_failed', desc: 'Fires when an SMS delivery fails.' },
                  { event: 'call_completed', desc: 'Fires when a call ends successfully.' },
                  { event: 'call_answered', desc: 'Fires when a call is picked up (in-progress).' },
                  { event: 'call_failed', desc: 'Fires when a call is not answered or fails.' },
                ].map(e => (
                  <div key={e.event} className="flex items-start gap-2">
                    <code className="text-[10px] font-black bg-white border border-amber-200 text-amber-700 px-2 py-0.5 rounded-lg shrink-0">{e.event}</code>
                    <p className="text-[11px] text-slate-500">{e.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderDetail = () => {
    if (!activeIntegration) return null;
    if (activeIntegration.id === 'whatsapp') return renderWhatsAppDetail();
    if (activeIntegration.id === 'telegram') return renderTelegramDetail();
    if (activeIntegration.id === 'instagram') return renderInstagramDetail();
    if (activeIntegration.id === 'exotel') return renderExotelDetail();
    if (activeIntegration.id === 'twilio') return renderTwilioDetail();
    return renderGenericDetail();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="px-8 py-5 max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-xl"><Puzzle className="w-5 h-5 text-white" /></div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Integrations</h1>
              <p className="text-xs text-slate-400 font-medium">Connect your stack — channels, CRM, payments & AI</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> API Nominal
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
              <ShieldCheck className="w-3 h-3" /> AES-256 Encrypted
            </span>
          </div>
        </div>
      </div>

      {activeIntegrationId === null ? renderOverview() : renderDetail()}

      {/* Phone select modal */}
      <Modal isOpen={isPhoneSelectModalOpen} onClose={() => setIsPhoneSelectModalOpen(false)} title="Select WhatsApp Numbers">
        <div className="space-y-4 p-2">
          <p className="text-sm text-slate-500">Multiple verified numbers found. Select which to connect.</p>
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {discoveredPhones.map(phone => (
              <div key={phone.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-green-300 transition-all">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{phone.displayPhoneNumber || phone.id}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {phone.id}</p>
                </div>
                <Button onClick={() => handleSelectPhone(phone)} disabled={loadingWhatsapp}
                  className="rounded-full px-5 h-9 font-bold text-xs">
                  Connect
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
