'use strict';

export async function getInbox(teamId, filter) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  if (filter) params.append('filter', filter);
  const url = `/api/inbox?${params.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  return res.json();
}

export async function getInboxCounts(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const url = `/api/inbox/counts?${params.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  return res.json();
}

export async function getTemplates() {
  const res = await fetch('/api/templates');
  return res.json();
}

export async function createTemplate(templateData) {
  const res = await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(templateData),
  });
  return res.json();
}

export async function sendTestTemplate(to, templateName, languageCode) {
  const res = await fetch('/api/templates/send-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, templateName, languageCode }),
  });
  return res.json();
}

export async function getMessages(conversationId) {
  const res = await fetch(`/api/conversations/${conversationId}/messages`);
  return res.json();
}

export async function markAsRead(conversationId) {
  const res = await fetch(`/api/conversations/${conversationId}/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function getNotes(conversationId) {
  const res = await fetch(`/api/conversations/${conversationId}/notes?actorRole=agent`);
  return res.json();
}

export async function createNote(conversationId, authorUserId, body) {
  const res = await fetch(`/api/conversations/${conversationId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorRole: 'agent', authorUserId, body }),
  });
  return res.json();
}

export async function claimConversation(conversationId, teamId, userId) {
  const res = await fetch(`/api/conversations/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, teamId, userId }),
  });
  return res.json();
}

export async function reassignConversation(conversationId, teamId, newAssigneeUserId) {
  const res = await fetch(`/api/conversations/reassign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, teamId, newAssigneeUserId }),
  });
  return res.json();
}

export async function releaseConversation(conversationId) {
  const res = await fetch(`/api/conversations/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId }),
  });
  return res.json();
}

export async function sendText(conversationId, text) {
  const res = await fetch(`/api/whatsapp/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, text }),
  });
  return res.json();
}

export async function sendMedia(conversationId, kind, link, caption) {
  const res = await fetch(`/api/whatsapp/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, kind, link, caption }),
  });
  return res.json();
}

export async function uploadMedia(conversationId, file) {
  const formData = new FormData();
  formData.append('conversationId', conversationId);
  formData.append('file', file);
  const res = await fetch('/api/whatsapp/upload', {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function sendTemplate(conversationId, templateName, languageCode, components) {
  const res = await fetch('/api/whatsapp/template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, templateName, languageCode, components }),
  });
  return res.json();
}

export async function pinConversation(conversationId) {
  const res = await fetch(`/api/conversations/${conversationId}/pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  return res.json();
}

export async function resolveConversation(conversationId) {
  const res = await fetch(`/api/conversations/${conversationId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'resolved' })
  });
  return res.json();
}
