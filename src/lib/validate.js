const DISCORD_ID = /^\d{1,20}$/;
const DISCORD_AVATAR = /^(?:a_)?[a-f0-9]{16,64}$/i;

export function discordId(value) {
  const id = String(value == null ? '' : value).trim();
  return DISCORD_ID.test(id) ? id : '';
}

export function discordAvatar(value) {
  const avatar = String(value == null ? '' : value).trim();
  return DISCORD_AVATAR.test(avatar) ? avatar : '';
}

export function yesFlag(value) {
  return value === 'yes';
}
