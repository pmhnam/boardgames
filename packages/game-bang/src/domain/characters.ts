/**
 * What each character does is code; how much life it has and whether it is dealt at all is
 * config.
 */
export const CHARACTER_IDS = [
  /** Draws a card for each life point lost. */
  'bartCassidy',
  /** Shows the second card drawn; a heart or diamond earns a third. */
  'blackJack',
  /** Plays BANG! as Missed! and Missed! as BANG!. */
  'calamityJanet',
  /** Takes a card from the hand of whoever costs them a life point. */
  'elGringo',
  /** May draw the first card from another player's hand. */
  'jesseJones',
  /** Always has a barrel. */
  'jourdonnais',
  /** Looks at three cards and keeps two. */
  'kitCarlson',
  /** Flips two cards for every "draw!" and takes the better. */
  'luckyDuke',
  /** Seen by everyone from one further away. */
  'paulRegret',
  /** May draw the first card from the discard pile. */
  'pedroRamirez',
  /** Sees everyone from one closer. */
  'roseDoolan',
  /** May discard two cards to regain a life point. */
  'sidKetchum',
  /** A BANG! from them takes two Missed! to dodge. */
  'slabTheKiller',
  /** Draws a card whenever their hand is empty. */
  'suzyLafayette',
  /** Takes the cards of anyone eliminated. */
  'vultureSam',
  /** May play any number of BANG! cards. */
  'willyTheKid',
] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];
