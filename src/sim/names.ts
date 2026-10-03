// Ordinary first names (design.md §6), seeded from stroke data.
export const NAMES = [
  'Gerald', 'Doris', 'Kevin', 'Mabel', 'Nigel', 'Wendy', 'Bernard', 'Phil', 'Agnes', 'Clive', 'Brenda', 'Otis',
  'Maureen', 'Derek', 'Ingrid', 'Barry', 'Pam', 'Stanley', 'Gladys', 'Morris', 'Edna', 'Rupert', 'Hilda', 'Norman',
  'Joan', 'Trevor', 'Beryl', 'Cyril', 'Pauline', 'Graham', 'Shirley', 'Dennis', 'Vera', 'Roland', 'Marjorie', 'Leonard',
  'Sylvia', 'Keith', 'Ethel', 'Howard', 'Irene', 'Malcolm', 'June', 'Neville', 'Olive', 'Percy', 'Rita', 'Sidney',
  'Thelma', 'Walter', 'Yvonne', 'Arthur', 'Bettina', 'Colin', 'Dot', 'Eugene', 'Frances', 'Gordon', 'Hazel', 'Ivan',
  'Janet', 'Kenneth', 'Lorna', 'Mervyn', 'Nora', 'Oswald', 'Patsy', 'Quentin', 'Rosalind', 'Sven', 'Tilly', 'Ursula',
  'Vince', 'Winifred', 'Xavier', 'Yolanda', 'Zelda', 'Basil', 'Myrtle', 'Fergus', 'Lionel', 'Gwen',
];

export type Kind =
  | 'giant'
  | 'tiny'
  | 'springy'
  | 'heavy'
  | 'floaty'
  | 'worm'
  | 'many-legged'
  | 'long-armed'
  | 'headless'
  | 'biped';

export const EPITHET: Record<Kind, string> = {
  giant: 'the Enormous',
  tiny: 'the Tiny',
  springy: 'the Springy',
  heavy: 'the Heavy',
  floaty: 'the Buoyant',
  worm: 'the Worm',
  'many-legged': 'the Many-Legged',
  'long-armed': 'the Long-Armed',
  headless: 'the Headless',
  biped: 'the Brave',
};

/** Short names for severed pieces: "Leg the Worm". */
export const PIECE_NAMES = ['Leg', 'Arm', 'Bit', 'Stump', 'Squiggle', 'Twig', 'Noodle', 'Chunk'];
