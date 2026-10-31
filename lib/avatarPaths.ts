// A profile picture is stored as a pair in the avatars bucket: <uuid>-crop.jpg is the square
// shown everywhere (users.avatar_path), and <uuid>-full.jpg is the whole photo it was cut from,
// shown when someone opens the picture. The full photo's path is derived, so no column holds it.
const CROP_SUFFIX = "-crop.jpg";
const FULL_SUFFIX = "-full.jpg";

export function newAvatarPaths(userId: string) {
  const base = `${userId}/${crypto.randomUUID()}`;
  return { crop: `${base}${CROP_SUFFIX}`, full: `${base}${FULL_SUFFIX}` };
}

/** The whole photo behind a saved avatar. Avatars saved before cropping existed have none, so they stand in for it. */
export function fullAvatarPath(avatarPath: string): string {
  return avatarPath.endsWith(CROP_SUFFIX)
    ? `${avatarPath.slice(0, -CROP_SUFFIX.length)}${FULL_SUFFIX}`
    : avatarPath;
}

/** Every file a saved avatar owns, for removing it. */
export function avatarFiles(avatarPath: string): string[] {
  const full = fullAvatarPath(avatarPath);
  return full === avatarPath ? [avatarPath] : [avatarPath, full];
}
