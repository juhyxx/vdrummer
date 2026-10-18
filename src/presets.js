// Prepared rhythms, grouped by genre; each loads with its genre's kit.
// Rows: '-' rest, 'g' ghost, 'x' hit, 'X' accent, one character per step, spaced by beat.
// A row covering one bar repeats over all bars (see fromPreset in pattern.js).
// `div` is the resolution in steps per beat: 2 = 1/8, 3 = 1/8 triplets, 4 = 1/16.

export const GENRES = [
  { id: 'rock', name: 'Rock & pop' },
  { id: 'metal', name: 'Metal' },
  { id: 'jazz', name: 'Jazz & latin' },
  { id: 'electronic', name: 'Electronic' },
];

const rock = [
  {
    id: 'rock', name: 'Rock beat', tempo: 110, div: 2,
    rows: {
      hhc: 'Xx Xx Xx Xx',
      snare: '-- X- -- X-',
      kick: 'x- -- xx --',
    },
  },
  {
    id: 'rock16', name: 'Rock 16ths', tempo: 92, div: 4,
    rows: {
      hhc: 'Xxxx Xxxx Xxxx Xxxx',
      snare: '---- X--- ---- X---',
      kick: 'x--- --x- x-x- ----',
    },
  },
  {
    id: 'rockfill', name: 'Beat with fill', tempo: 112, div: 4, bars: 2,
    rows: {
      crash: 'x--- ---- ---- ---- ---- ---- ---- ----',
      hhc: '--x- x-x- x-x- x-x- x-x- x-x- ---- ----',
      snare: '---- X--- ---- X--- ---- X--- Xxxx ----',
      tom1: '---- ---- ---- ---- ---- ---- ---- xx--',
      tom2: '---- ---- ---- ---- ---- ---- ---- --x-',
      tom3: '---- ---- ---- ---- ---- ---- ---- ---x',
      kick: 'x--- --x- x-x- ---- x--- --x- x--- ----',
    },
  },
  {
    id: 'halftime', name: 'Half-time', tempo: 140, div: 2,
    rows: {
      hhc: 'Xx xx Xx xx',
      snare: '-- -- X- --',
      kick: 'x- -x -- --',
    },
  },
  {
    id: 'disco', name: 'Four on the floor', tempo: 120, div: 2,
    rows: {
      hho: '-x -x -x -x',
      hhc: 'x- x- x- x-',
      snare: '-- X- -- X-',
      kick: 'x- x- x- x-',
    },
  },
  {
    id: 'funk', name: 'Funk', tempo: 96, div: 4,
    rows: {
      hhc: 'Xgxg Xgxg Xgxg Xgxg',
      snare: '-g-- X--g -g-g X--g',
      kick: 'x-x- ---- --x- -x--',
    },
  },
  {
    id: 'shuffle', name: 'Shuffle', tempo: 104, div: 3,
    rows: {
      hhc: 'x-x x-x x-x x-x',
      snare: '--- X-- --- X--',
      kick: 'x-- --- x-x ---',
    },
  },
  {
    id: 'ballad', name: 'Ballad 12/8', tempo: 64, div: 3,
    rows: {
      hhc: 'Xxx Xxx Xxx Xxx',
      snare: '--- X-- --- X--',
      kick: 'x-- --x x-- ---',
    },
  },
  {
    id: 'onedrop', name: 'Reggae one drop', tempo: 76, div: 3,
    rows: {
      hhc: 'x-x x-x x-x x-x',
      rim: '--- --- X-- ---',
      kick: '--- --- x-- ---',
    },
  },
];

const metal = [
  {
    id: 'doublebass', name: 'Double bass', tempo: 150, div: 4,
    rows: {
      crash: 'x--- ---- ---- ----',
      ride: '---- x--- x--- x---',
      snare: '---- X--- ---- X---',
      kick: 'xxxx xxxx xxxx xxxx',
    },
  },
  {
    id: 'blast', name: 'Blast beat', tempo: 180, div: 4,
    rows: {
      crash: 'x--- ---- ---- ----',
      ride: '--x- x-x- x-x- x-x-',
      snare: '-x-x -x-x -x-x -x-x',
      kick: 'x-x- x-x- x-x- x-x-',
    },
  },
  {
    id: 'thrash', name: 'Thrash', tempo: 200, div: 2,
    rows: {
      crash: 'x- -- -- --',
      ride: '-- x- x- x-',
      snare: '-X -X -X -X',
      kick: 'x- x- x- x-',
    },
  },
  {
    id: 'gallop', name: 'Gallop', tempo: 150, div: 4,
    rows: {
      crash: 'x--- x--- x--- x---',
      snare: '---- X--- ---- X---',
      kick: 'x-xx x-xx x-xx x-xx',
    },
  },
  {
    id: 'dbeat', name: 'D-beat', tempo: 170, div: 2,
    rows: {
      crash: 'x- -- -- --',
      hhc: '-x xx xx xx',
      snare: '-- X- -- X-',
      kick: 'x- -x x- -x',
    },
  },
  {
    id: 'breakdown', name: 'Breakdown', tempo: 110, div: 4, bars: 2,
    rows: {
      crash: 'x--- x--- x--- x---',
      snare: '---- ---- X--- ----',
      kick: 'xx-x --x- --x- -x-- xx-x --x- ---- xxxx',
    },
  },
];

const jazz = [
  {
    id: 'swing', name: 'Swing', tempo: 140, div: 3, bars: 2,
    rows: {
      ride: 'x-- x-x x-- x-x',
      hhp: '--- x-- --- x--',
      kick: 'g-- g-- g-- g--',
      snare: '--- --g --- --- --- --- --g --x',
    },
  },
  {
    id: 'fastswing', name: 'Up-tempo swing', tempo: 220, div: 3,
    rows: {
      ride: 'x-- x-x x-- x-x',
      hhp: '--- x-- --- x--',
    },
  },
  {
    id: 'waltz', name: 'Jazz waltz', tempo: 150, beats: 3, div: 3,
    rows: {
      ride: 'x-- x-x x--',
      hhp: '--- x-- x--',
      kick: 'g-- --- ---',
      snare: '--- --- --g',
    },
  },
  {
    id: 'bossa', name: 'Bossa nova', tempo: 130, div: 2, bars: 2,
    rows: {
      hhc: 'xx xx xx xx',
      rim: 'x- -x -- x- -- x- -x --',
      kick: 'x- -x x- -x',
    },
  },
];

const electronic = [
  {
    id: 'house', name: 'House', tempo: 124, div: 4,
    rows: {
      hho: '--x- --x- --x- --x-',
      rim: '---- X--- ---- X---',
      kick: 'x--- x--- x--- x---',
    },
  },
  {
    id: 'techno', name: 'Techno', tempo: 132, div: 4,
    rows: {
      hho: '--x- --x- --x- --x-',
      hhc: '---g ---g ---g ---g',
      snare: '---- x--- ---- x---',
      kick: 'x--- x--- x--- x---',
    },
  },
  {
    id: 'breakbeat', name: 'Breakbeat', tempo: 136, div: 4, bars: 2,
    rows: {
      ride: 'x-x- x-x- x-x- x-x-',
      snare: '---- X--g -g-- X--g -g-- X--g -g-- -gX-',
      kick: 'x-x- ---- --xx ---- x-x- ---- --x- ----',
    },
  },
  {
    id: 'dnb', name: 'Drum & bass', tempo: 174, div: 4,
    rows: {
      hhc: 'x-g- x-g- x-g- x-g-',
      snare: '---- X--- ---- X---',
      kick: 'x--- ---- --x- ----',
    },
  },
  {
    id: 'boombap', name: 'Boom bap', tempo: 90, div: 4, swing: 40,
    rows: {
      hhc: 'x-x- x-x- x-x- x-x-',
      snare: '---- X--- ---- X---',
      kick: 'x--- ---x --x- ----',
    },
  },
  {
    id: 'trap', name: 'Trap', tempo: 140, div: 4,
    rows: {
      hhc: 'x-x- x-x- x-x- xxxx',
      rim: '---- ---- X--- ----',
      kick: 'x--- ---- -x-- --x-',
    },
  },
];

const withGenre = (genre, list) => list.map((p) => ({ ...p, genre, kit: genre }));

export const PRESETS = [
  ...withGenre('rock', rock),
  ...withGenre('metal', metal),
  ...withGenre('jazz', jazz),
  ...withGenre('electronic', electronic),
];
