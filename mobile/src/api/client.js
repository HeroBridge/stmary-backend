// API client for the Hero One Eleven backend.
// CONFIG: set this to your deployed ALB/API domain before building.
export const API_BASE = 'https://api.YOUR-DOMAIN.org';

let authToken = null;
export const setToken = (t) => { authToken = t; };

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  login: (identifier, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  register: (data) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  redeemCode: (code) => request('/api/codes/redeem', { method: 'POST', body: JSON.stringify({ code }) }),
  previewCode: (code) => request(`/api/codes/preview/${encodeURIComponent(code)}`),
  carousel: () => request('/api/feeds/carousel'),
  feed: (groupId) => request(`/api/feeds${groupId ? `?group_id=${groupId}` : ''}`),
  likePost: (id) => request(`/api/feeds/${id}/like`, { method: 'POST' }),
  resources: (params = '') => request(`/api/resources${params}`),
  openResource: (id) => request(`/api/resources/${id}/open`),
  events: () => request('/api/events'),
  rsvp: (id, status) => request(`/api/events/${id}/rsvp`, { method: 'POST', body: JSON.stringify({ status }) }),
  myProfile: () => request('/api/profiles/me'),
  policies: () => request('/api/governance/policies'),
  setConsent: (policy_id, granted) => request('/api/governance/consents', { method: 'POST', body: JSON.stringify({ policy_id, granted }) }),
};

// --- Community layer v1 additions ---
export const apiV1 = {
  createPost: (body, group_id, attachments) =>
    request('/api/feeds', { method: 'POST', body: JSON.stringify({ body, group_id, attachments }) }),
  conversations: () => request('/api/messages/conversations'),
  startConversation: (participant_ids) =>
    request('/api/messages/conversations', { method: 'POST', body: JSON.stringify({ participant_ids }) }),
  messages: (convId) => request(`/api/messages/conversations/${convId}/messages`),
  sendMessage: (convId, body) =>
    request(`/api/messages/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  myImpact: () => request('/api/profiles/me/impact'),
  registerPushToken: (token, platform) =>
    request('/api/profiles/me/push-token', { method: 'POST', body: JSON.stringify({ token, platform }) }),
  deleteAccount: () =>
    request('/api/profiles/me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }),
  directory: (q) => request(`/api/community/directory${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  guidelines: () => request('/api/community/guidelines'),
  acceptGuidelines: () => request('/api/community/guidelines/accept', { method: 'POST' }),
  notifications: () => request('/api/community/notifications'),
  markNotificationsRead: () => request('/api/community/notifications/read', { method: 'POST', body: JSON.stringify({}) }),
  react: (postId, type) => request(`/api/feeds/${postId}/react`, { method: 'POST', body: JSON.stringify({ type }) }),
  reportPost: (postId, reason) => request(`/api/feeds/${postId}/report`, { method: 'POST', body: JSON.stringify({ reason }) }),
  searchResources: (q) => request(`/api/resources?q=${encodeURIComponent(q)}`),
  featuredResources: () => request('/api/resources?featured=true'),
  resourceTags: () => request('/api/resources/tags'),
  resourcePage: (id) => request(`/api/resources/${id}`),
  resourceProgress: (id, progress_pct, completed) =>
    request(`/api/resources/${id}/progress`, { method: 'POST', body: JSON.stringify({ progress_pct, completed }) }),
  resourceFeedback: (id, useful, rating, comment) =>
    request(`/api/resources/${id}/feedback`, { method: 'POST', body: JSON.stringify({ useful, rating, comment }) }),
  saveResource: (id) => request(`/api/resources/${id}/save`, { method: 'POST' }),
  branding: () => request('/api/community/branding'),
  mentorBriefing: (menteeId) => request(`/api/mentorship/briefing/${menteeId}`),
  principleApplied: (menteeId, principle_id, note) =>
    request(`/api/mentorship/briefing/${menteeId}/applied`,
      { method: 'POST', body: JSON.stringify({ principle_id, note }) }),
  myMentees: () => request('/api/mentorship/mentees'),
  updateBranding: (patch) => request('/api/admin/branding', { method: 'PUT', body: JSON.stringify(patch) }),
};
