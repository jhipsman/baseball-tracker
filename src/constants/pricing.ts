/** What the public site and billing say about price. Change it here; pages and checkout follow. */
export const PRICING = {
  /** Every new team: free, no card. */
  trialDays: 30,
  team: { monthly: 19, yearly: 190 },
  /** Teams at which the club discount starts. */
  clubFrom: 5,
} as const;
