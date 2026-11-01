/** Placeholder accounts (roster-only players, demo people) have an address nobody can receive mail at. */
export const isPlaceholderEmail = (email: string | null | undefined) =>
  !email || /\.invalid$/i.test(email);
