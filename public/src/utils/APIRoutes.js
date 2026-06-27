function resolveHost() {
  if (process.env.REACT_APP_API_HOST) return process.env.REACT_APP_API_HOST;
  if (process.env.NODE_ENV === "production" && typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:5002";
}

export const host = resolveHost();

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

export const loginRoute = `${host}/api/auth/login`;
export const registerRoute = `${host}/api/auth/register`;
export const logoutRoute = `${host}/api/auth/logout`;
export const allUsersRoute = `${host}/api/auth/allusers`;
export const sendMessageRoute = `${host}/api/messages/addmsg`;
export const recieveMessageRoute = `${host}/api/messages/getmsg`;
export const setAvatarRoute = `${host}/api/auth/setavatar`;
export const sendFileMessageRoute = `${host}/api/messages/addfilemsg`;
export const searchMessagesRoute = `${host}/api/messages/search`;
export const deleteMessageRoute  = (id) => `${host}/api/messages/${id}/delete`;
export const editMessageRoute    = (id) => `${host}/api/messages/${id}/edit`;
export const pinMessageRoute     = (id) => `${host}/api/messages/${id}/pin`;
export const reactMessageRoute   = (id) => `${host}/api/messages/${id}/react`;
export const forwardMessageRoute = `${host}/api/messages/forward`;
export const lastMessagesRoute   = `${host}/api/messages/lastmessages`;
export const groupSharedContentRoute = `${host}/api/messages/groupshared`;
export const clearChatRoute      = `${host}/api/messages/clearchat`;
export const deleteChatRoute     = `${host}/api/messages/deletechat`;
export const blockUserRoute      = `${host}/api/messages/block`;
export const checkBlockRoute     = `${host}/api/messages/checkblock`;
export const updateProfileRoute  = (id) => `${host}/api/auth/profile/${id}`;
export const deleteAccountRoute  = (id) => `${host}/api/auth/account/${id}`;
export const requestPasswordResetRoute = `${host}/api/auth/password-reset/request`;
export const verifyPasswordResetRoute = `${host}/api/auth/password-reset/verify`;
export const resetPasswordRoute = `${host}/api/auth/password-reset/confirm`;
export const createGroupRoute    = `${host}/api/groups/create`;
export const myGroupsRoute       = (userId) => `${host}/api/groups/my/${userId}`;
export const addGroupMembersRoute = (groupId) => `${host}/api/groups/${groupId}/members`;
export const updateGroupProfileRoute = (groupId) => `${host}/api/groups/${groupId}/profile`;
export const leaveGroupRoute = (groupId) => `${host}/api/groups/${groupId}/leave`;
