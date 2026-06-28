/** API base URL resolved at build time by CRA. */
export function getHost() {
  // Explicit override — set REACT_APP_API_HOST in Render dashboard (build env var)
  if (process.env.REACT_APP_API_HOST) return process.env.REACT_APP_API_HOST;
  // Same-origin relative paths work when React and API are on the same Render service
  if (process.env.NODE_ENV === "production") return "";
  return "http://localhost:5002";
}

const api = (path) => `${getHost()}${path}`;

export const host = getHost();

export function getIceServers() {
  if (process.env.REACT_APP_ICE_SERVERS) {
    try {
      return JSON.parse(process.env.REACT_APP_ICE_SERVERS);
    } catch {
      /* fall through to defaults */
    }
  }
  const servers = [{ urls: "stun:stun.l.google.com:19302" }];
  if (process.env.REACT_APP_TURN_URL) {
    servers.push({
      urls: process.env.REACT_APP_TURN_URL,
      username: process.env.REACT_APP_TURN_USERNAME || "",
      credential: process.env.REACT_APP_TURN_CREDENTIAL || "",
    });
  }
  return servers;
}

export const loginRoute = api("/api/auth/login");
export const registerRoute = api("/api/auth/register");
export const logoutRoute = api("/api/auth/logout");
export const allUsersRoute = api("/api/auth/allusers");
export const sendMessageRoute = api("/api/messages/addmsg");
export const recieveMessageRoute = api("/api/messages/getmsg");
export const setAvatarRoute = api("/api/auth/setavatar");
export const sendFileMessageRoute = api("/api/messages/addfilemsg");
export const searchMessagesRoute = api("/api/messages/search");
export const deleteMessageRoute  = (id) => api(`/api/messages/${id}/delete`);
export const editMessageRoute    = (id) => api(`/api/messages/${id}/edit`);
export const pinMessageRoute     = (id) => api(`/api/messages/${id}/pin`);
export const reactMessageRoute   = (id) => api(`/api/messages/${id}/react`);
export const forwardMessageRoute = api("/api/messages/forward");
export const lastMessagesRoute   = api("/api/messages/lastmessages");
export const groupSharedContentRoute = api("/api/messages/groupshared");
export const clearChatRoute      = api("/api/messages/clearchat");
export const deleteChatRoute     = api("/api/messages/deletechat");
export const blockUserRoute      = api("/api/messages/block");
export const checkBlockRoute     = api("/api/messages/checkblock");
export const updateProfileRoute  = (id) => api(`/api/auth/profile/${id}`);
export const deleteAccountRoute  = (id) => api(`/api/auth/account/${id}`);
export const requestPasswordResetRoute = api("/api/auth/password-reset/request");
export const verifyPasswordResetRoute = api("/api/auth/password-reset/verify");
export const resetPasswordRoute = api("/api/auth/password-reset/confirm");
export const createGroupRoute    = api("/api/groups/create");
export const myGroupsRoute       = (userId) => api(`/api/groups/my/${userId}`);
export const addGroupMembersRoute = (groupId) => api(`/api/groups/${groupId}/members`);
export const updateGroupProfileRoute = (groupId) => api(`/api/groups/${groupId}/profile`);
export const leaveGroupRoute = (groupId) => api(`/api/groups/${groupId}/leave`);
