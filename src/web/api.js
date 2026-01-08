'use strict';

export async function getInbox(teamId) {
  const url = `/api/inbox${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''}`;
  const res = await fetch(url);
  return res.json();
}

export async function getMessages(conversationId) {
  const res = await fetch(`/api/conversations/${conversationId}/messages`);
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

export async function sendTemplate(conversationId, name, languageCode, components) {
  const res = await fetch(`/api/whatsapp/template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, name, languageCode, components }),
  });
  return res.json();
}
