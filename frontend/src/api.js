'use strict';

export async function getTeamUser(id) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/team-users/${id}`, { headers });
  return res.json();
}

export async function getInbox(teamId, filter) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  if (filter) params.append('filter', filter);
  const url = `/api/inbox?${params.toString()}`;
  const headers = getAuthHeaders();
  const res = await fetch(url, { headers, cache: 'no-store' });
  return res.json();
}

export async function getInboxCounts(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const url = `/api/inbox/counts?${params.toString()}`;
  const headers = getAuthHeaders();
  const res = await fetch(url, { headers, cache: 'no-store' });
  return res.json();
}

export async function getTemplates() {
  const headers = getAuthHeaders();
  const res = await fetch('/api/templates', { headers });
  return res.json();
}

export async function createTemplate(templateData) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/templates', {
    method: 'POST',
    headers,
    body: JSON.stringify(templateData),
  });
  return res.json();
}

export async function sendTestTemplate(to, templateName, languageCode) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/templates/send-test', {
    method: 'POST',
    headers,
    body: JSON.stringify({ to, templateName, languageCode }),
  });
  return res.json();
}

export async function getMessages(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/messages`, { headers });
  return res.json();
}

export async function markAsRead(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/read`, {
    method: 'POST',
    headers,
  });
  return res.json();
}

export async function getNotes(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/notes?actorRole=agent`, { headers });
  return res.json();
}

export async function createNote(conversationId, authorUserId, body) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/notes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ actorRole: 'agent', authorUserId, body }),
  });
  return res.json();
}

export async function claimConversation(conversationId, teamId, userId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/claim`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, teamId, userId }),
  });
  return res.json();
}

export async function reassignConversation(conversationId, teamId, newAssigneeUserId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/reassign`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, teamId, newAssigneeUserId }),
  });
  return res.json();
}

export async function reassignExternalLead(leadId, newSalesPersonId) {
  const headers = getAuthHeaders();
  const res = await fetch('https://api.starforze.com/api/leads/reassign', {
    method: 'POST',
    headers,
    body: JSON.stringify({ leadId, newSalesPersonId })
  });
  return res.json();
}

export async function releaseConversation(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/release`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId }),
  });
  return res.json();
}

export async function sendText(conversationId, text) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/whatsapp/text`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, text }),
  });
  return res.json();
}

export async function sendMedia(conversationId, kind, link, caption) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/whatsapp/media`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, kind, link, caption }),
  });
  return res.json();
}

export async function sendTemplate(conversationId, name, languageCode, components) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/whatsapp/template`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, name, languageCode, components }),
  });
  return res.json();
}

export async function uploadMedia(conversationId, file) {
  const headers = getAuthHeaders(null); // No Content-Type for FormData
  const formData = new FormData();
  formData.append('conversationId', conversationId);
  formData.append('file', file);
  
  const res = await fetch('/api/whatsapp/upload', {
    method: 'POST',
    headers,
    body: formData,
  });
  return res.json();
}

export async function uploadTemplateExampleMedia(file) {
  const headers = getAuthHeaders(null); // No Content-Type for FormData
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch('/api/templates/upload-example', {
    method: 'POST',
    headers,
    body: formData,
  });
  return res.json();
}

export async function resolveConversation(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ status: 'closed' }),
  });
  return res.json();
}

export async function pinConversation(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/pin`, {
    method: 'POST',
    headers,
  });
  return res.json();
}

export async function getDashboardData(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const url = `/api/dashboard?${params.toString()}`;
  const headers = getAuthHeaders();
  const res = await fetch(url, { headers, cache: 'no-store' });
  return res.json();
}

export async function login(email, password) {
  // Hit external API directly
  const res = await fetch('https://api.starforze.com/api/team-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function syncUser(user) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/auth/sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({ user }),
  });
  return res.json();
}

export async function getTeamUsers() {
  const res = await fetch('https://api.starforze.com/api/team-users', {
    headers: getAuthHeaders(),
  });
  return res.json();
}

export async function getWorkflows() {
  const headers = getAuthHeaders();
  const res = await fetch('/api/workflows', { headers });
  return res.json();
}

export async function createWorkflow(data) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/workflows', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateWorkflow(id, data) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/workflows/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteWorkflow(id) {
  const headers = getAuthHeaders();
  await fetch(`/api/workflows/${id}`, {
    method: 'DELETE',
    headers,
  });
}

export async function runWorkflow(id, phoneNumber) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/workflows/${id}/run`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phoneNumber }),
  });
  return res.json();
}

export async function forceReassignConversation(conversationId, teamId, newAssigneeUserId) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/conversations/reassign', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      conversationId,
      teamId,
      newAssigneeUserId,
      actorRole: 'admin' // Force admin role
    }),
  });
  return res.json();
}

function getAuthHeaders(contentType = 'application/json') {
  const token = localStorage.getItem('accessToken');
  const user = localStorage.getItem('user');
  let role = 'agent';
  if (user) {
    try {
      const u = JSON.parse(user);
      role = u.role || 'agent';
    } catch (e) {}
  }
  
  const headers = {};
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-user-role'] = role;
  }
  return headers;
}
