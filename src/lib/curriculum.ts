// Lesson content. Each lesson adds one idea on top of everything before it.

import type { Level } from './generator';
import { ALL_TOKENS, SUBTRACTIVE, Token, toRoman } from './roman';

export type Card =
  | { t: 'intro'; numeral: string; title: string; text: string }
  | { t: 'fact'; icon: string; title: string; text: string }
  /** Tap each chunk of the numeral to reveal its value. `each` splits into single building blocks rather than decimal places. */
  | { t: 'tap'; n: number; text: string; each?: boolean }
  /** Build the numeral for n with tiles. `wrong` shows a mistake to fix. */
  | { t: 'build'; n: number; text: string; wrong?: string }
  | { t: 'pick'; q: string; options: string[]; answer: number; why: string };

export interface Lesson {
  id: string;
  group: string;
  glyph: string;
  title: string;
  subtitle: string;
  level: Level;
  cards: Card[];
}

export interface Group {
  id: string;
  num: string;
  title: string;
  blurb: string;
  lessons: Lesson[];
  trial: Level;
}

const YEAR = new Date().getFullYear();

interface LessonSeed {
  glyph: string;
  title: string;
  subtitle: string;
  add: Token[];
  max: number;
  min?: number;
  focus?: Token[];
  minLen?: number;
  include?: number[];
  cards: Card[];
}

interface GroupSeed {
  num: string;
  title: string;
  blurb: string;
  lessons: LessonSeed[];
}

const seeds: GroupSeed[] = [
  {
    num: 'I',
    title: 'Tally Marks',
    blurb: 'Meet I, V and X, and learn to add them up.',
    lessons: [
      {
        glyph: 'I',
        title: 'One Stroke at a Time',
        subtitle: 'I, II, III',
        add: ['I'],
        max: 3,
        cards: [
          { t: 'intro', numeral: 'I', title: 'It starts with a scratch', text: 'Roman numerals began as tally marks. One stroke, I, means one. It looks like the letter I, and that is exactly how the Romans wrote it.' },
          { t: 'tap', n: 3, each: true, text: 'To count higher, add more strokes. Tap each stroke to count it.' },
          { t: 'build', n: 2, text: 'Your turn. Carve the number 2.' },
          { t: 'pick', q: 'What number is III?', options: ['1', '2', '3', '111'], answer: 2, why: 'Three strokes, each worth one: 1 + 1 + 1 = 3.' },
          { t: 'fact', icon: '🏛️', title: 'No zero!', text: 'The Romans had no symbol for zero. If there was nothing to count, they simply wrote nothing (or the word "nulla").' },
        ],
      },
      {
        glyph: 'V',
        title: 'A Handful',
        subtitle: 'V is five',
        add: ['V'],
        max: 8,
        cards: [
          { t: 'intro', numeral: 'V', title: 'Five gets its own symbol', text: 'Counting lots of strokes is slow. So five gets a shortcut: V. Some say it is the shape of an open hand, between thumb and fingers.' },
          { t: 'tap', n: 7, each: true, text: 'Put smaller symbols after a bigger one and you add them. Tap each piece of VII.' },
          { t: 'build', n: 6, text: 'Build 6: start with five, then add one.' },
          { t: 'pick', q: 'What number is VIII?', options: ['5', '7', '8', '53'], answer: 2, why: 'V is 5, then three strokes: 5 + 3 = 8.' },
          { t: 'build', n: 8, text: 'Now carve 8 yourself.' },
        ],
      },
      {
        glyph: 'X',
        title: 'Two Hands',
        subtitle: 'X is ten',
        add: ['X'],
        max: 39,
        cards: [
          { t: 'intro', numeral: 'X', title: 'Ten is a cross', text: 'X means ten. One story says it is two Vs, one upside down under the other: two hands, ten fingers.' },
          { t: 'tap', n: 27, each: true, text: 'Always write the biggest symbols first, then work down. Tap each piece of XXVII.' },
          { t: 'build', n: 16, text: 'Build 16: a ten, a five, and a one.' },
          { t: 'pick', q: 'What number is XXXV?', options: ['35', '25', '15', '53'], answer: 0, why: 'Three tens and a five: 10 + 10 + 10 + 5 = 35.' },
          { t: 'build', n: 38, text: 'A long one! Carve 38, biggest symbols first.' },
          { t: 'fact', icon: '🕰️', title: 'Still ticking', text: 'Look at an old clock or watch face and you will spot I, V and X counting out the hours.' },
        ],
      },
    ],
  },
  {
    num: 'II',
    title: 'The Subtraction Trick',
    blurb: 'Why 4 is IV, 9 is IX, and nothing repeats four times.',
    lessons: [
      {
        glyph: 'IV',
        title: 'One Before Five',
        subtitle: 'IV is four',
        add: ['IV'],
        max: 39,
        cards: [
          { t: 'intro', numeral: 'IV', title: 'A clever shortcut', text: 'Here is the twist. When a smaller symbol comes BEFORE a bigger one, you subtract it. IV is "one before five": 5 − 1 = 4.' },
          { t: 'pick', q: 'VI and IV use the same symbols. Which one is 4?', options: ['VI', 'IV'], answer: 1, why: 'IV: the I comes first, so it is taken away (5 − 1). VI adds it on (5 + 1 = 6).' },
          { t: 'tap', n: 14, each: true, text: 'IV works as one chunk inside bigger numbers. Tap the two chunks of XIV.' },
          { t: 'build', n: 4, text: 'A mason carved this wrong. Fix it using the subtraction trick.', wrong: 'IIII' },
          { t: 'build', n: 24, text: 'Build 24: two tens, then four.' },
        ],
      },
      {
        glyph: 'IX',
        title: 'One Before Ten',
        subtitle: 'IX is nine',
        add: ['IX'],
        max: 39,
        cards: [
          { t: 'intro', numeral: 'IX', title: 'Same trick, bigger number', text: 'Nine works the same way as four. IX is "one before ten": 10 − 1 = 9.' },
          { t: 'pick', q: 'What number is XI?', options: ['9', '11', '10', '1'], answer: 1, why: 'The I comes AFTER the X, so add: 10 + 1 = 11. Flip it to IX and you get 9.' },
          { t: 'tap', n: 19, each: true, text: 'Tap the chunks of XIX. The first X is a plain ten; the IX is a nine.' },
          { t: 'build', n: 9, text: 'Fix the mason\'s mistake.', wrong: 'VIIII' },
          { t: 'build', n: 29, text: 'Build 29.' },
        ],
      },
      {
        glyph: 'III',
        title: 'Never Four in a Row',
        subtitle: 'Mixing it all up to 39',
        add: [],
        focus: ['IV', 'IX'],
        max: 39,
        cards: [
          { t: 'intro', numeral: 'III', title: 'The rule of three', text: 'A symbol can repeat up to three times: III, XXX. If you ever need a fourth, that is your signal to use the subtraction trick instead.' },
          { t: 'pick', q: 'Which is the right way to write 14?', options: ['XIIII', 'XIV', 'IXV', 'VIX'], answer: 1, why: 'Ten, then four: X + IV. Four strokes in a row (IIII) is the tell-tale mistake.' },
          { t: 'tap', n: 39, each: true, text: 'The biggest number you can write so far. Tap the chunks of XXXIX.' },
          { t: 'build', n: 34, text: 'Build 34.' },
          { t: 'fact', icon: '⌚', title: 'The clockmaker\'s exception', text: 'Many clock faces show 4 as IIII, not IV. Nobody is quite sure why: maybe balance, maybe tradition. Everywhere else, IV is the standard.' },
        ],
      },
    ],
  },
  {
    num: 'III',
    title: 'Fifties and Hundreds',
    blurb: 'L and C take you all the way to 399.',
    lessons: [
      {
        glyph: 'L',
        title: 'Half a Hundred',
        subtitle: 'L is fifty',
        add: ['L'],
        max: 89,
        cards: [
          { t: 'intro', numeral: 'L', title: 'Fifty', text: 'L means 50. It does for tens what V does for ones: instead of five Xs, you write one L.' },
          { t: 'tap', n: 68, text: 'Tap the chunks of LXVIII, biggest first.' },
          { t: 'build', n: 55, text: 'Build 55.' },
          { t: 'pick', q: 'What number is LXXVI?', options: ['66', '76', '126', '74'], answer: 1, why: '50 + 10 + 10 + 5 + 1 = 76.' },
          { t: 'build', n: 87, text: 'Build 87. It is a long one.' },
        ],
      },
      {
        glyph: 'XL',
        title: 'Ten Before Fifty',
        subtitle: 'XL is forty',
        add: ['XL'],
        max: 89,
        cards: [
          { t: 'intro', numeral: 'XL', title: 'The trick scales up', text: 'XXXX would break the rule of three. So forty is "ten before fifty": XL = 50 − 10 = 40.' },
          { t: 'tap', n: 44, text: 'Two subtraction chunks side by side. Tap XL and IV.' },
          { t: 'build', n: 40, text: 'Fix the mason\'s mistake.', wrong: 'XXXX' },
          { t: 'pick', q: 'What number is XLIX?', options: ['49', '51', '69', '61'], answer: 0, why: 'XL is 40 and IX is 9: 40 + 9 = 49.' },
          { t: 'build', n: 47, text: 'Build 47.' },
        ],
      },
      {
        glyph: 'C',
        title: 'Centum',
        subtitle: 'C is one hundred',
        add: ['C'],
        max: 399,
        cards: [
          { t: 'intro', numeral: 'C', title: 'One hundred', text: 'C stands for centum, Latin for a hundred. You already know it from century, cent and centimetre.' },
          { t: 'tap', n: 256, text: 'Read it place by place: hundreds, tens, ones. Tap the chunks of CCLVI.' },
          { t: 'build', n: 120, text: 'Build 120.' },
          { t: 'pick', q: 'What number is CCCLXV?', options: ['265', '365', '315', '415'], answer: 1, why: '300 + 60 + 5 = 365: the days in a year.' },
          { t: 'build', n: 248, text: 'Build 248.' },
        ],
      },
      {
        glyph: 'XC',
        title: 'Ten Before a Hundred',
        subtitle: 'XC is ninety',
        add: ['XC'],
        max: 399,
        cards: [
          { t: 'intro', numeral: 'XC', title: 'Ninety', text: 'You can guess this one. Ninety is "ten before a hundred": XC = 100 − 10 = 90.' },
          { t: 'pick', q: 'Which is the right way to write 99?', options: ['IC', 'XCIX', 'LXXXXIX', 'XCVIIII'], answer: 1, why: 'Go place by place: 90 is XC, 9 is IX. You can only subtract from the next one or two symbols up, so IC is not allowed.' },
          { t: 'tap', n: 194, text: 'Tap the chunks of CXCIV.' },
          { t: 'build', n: 90, text: 'Fix the mason\'s mistake.', wrong: 'LXXXX' },
          { t: 'build', n: 399, text: 'The biggest number so far. Build 399.' },
        ],
      },
    ],
  },
  {
    num: 'IV',
    title: 'The Big Ones',
    blurb: 'D and M unlock every number up to 3999.',
    lessons: [
      {
        glyph: 'D',
        title: 'Five Hundred',
        subtitle: 'D is five hundred',
        add: ['D'],
        max: 899,
        cards: [
          { t: 'intro', numeral: 'D', title: 'Five hundred', text: 'D is 500. Spot the pattern: I, X, C are the ones, tens and hundreds. V, L, D are their "five" partners.' },
          { t: 'tap', n: 678, text: 'Tap the chunks of DCLXXVIII.' },
          { t: 'build', n: 550, text: 'Build 550.' },
          { t: 'pick', q: 'What number is DCCC?', options: ['300', '700', '800', '530'], answer: 2, why: '500 + 100 + 100 + 100 = 800.' },
          { t: 'build', n: 766, text: 'Build 766.' },
        ],
      },
      {
        glyph: 'CD',
        title: 'A Hundred Before Five Hundred',
        subtitle: 'CD is four hundred',
        add: ['CD'],
        max: 899,
        cards: [
          { t: 'intro', numeral: 'CD', title: 'Four hundred', text: 'No CCCC allowed. Four hundred is "a hundred before five hundred": CD = 500 − 100 = 400.' },
          { t: 'tap', n: 444, text: 'Three subtraction chunks in a row! Tap CD, XL and IV.' },
          { t: 'build', n: 400, text: 'Fix the mason\'s mistake.', wrong: 'CCCC' },
          { t: 'pick', q: 'What number is CDXC?', options: ['490', '610', '510', '390'], answer: 0, why: 'CD is 400 and XC is 90: 490.' },
          { t: 'build', n: 449, text: 'Build 449.' },
        ],
      },
      {
        glyph: 'M',
        title: 'Mille',
        subtitle: 'M is one thousand',
        add: ['M'],
        max: 3999,
        cards: [
          { t: 'intro', numeral: 'M', title: 'One thousand', text: 'M stands for mille, a thousand, as in millennium and millimetre. It is the biggest symbol there is.' },
          { t: 'tap', n: 2650, text: 'Tap the chunks of MMDCL.' },
          { t: 'build', n: 1500, text: 'Build 1500.' },
          { t: 'pick', q: 'What number is MMMDCC?', options: ['2700', '3200', '3700', '3500'], answer: 2, why: 'Three thousands, then 500 + 200: 3700.' },
          { t: 'build', n: 2025, text: 'Build 2025.' },
        ],
      },
      {
        glyph: 'CM',
        title: 'A Hundred Before a Thousand',
        subtitle: 'CM is nine hundred',
        add: ['CM'],
        max: 3999,
        cards: [
          { t: 'intro', numeral: 'CM', title: 'The last piece', text: 'Nine hundred is "a hundred before a thousand": CM = 1000 − 100 = 900. With that you can write every number from 1 to 3999.' },
          { t: 'tap', n: 1994, text: 'Tap the four chunks of MCMXCIV.' },
          { t: 'build', n: 900, text: 'Fix the mason\'s mistake.', wrong: 'DCCCC' },
          { t: 'pick', q: 'What number is MCM?', options: ['2100', '1900', '2900', '1100'], answer: 1, why: 'M is 1000, then CM is 900: 1900.' },
          { t: 'build', n: 3999, text: 'The grand finale: build 3999, the biggest standard Roman numeral.' },
          { t: 'fact', icon: '📜', title: 'Why stop at 3999?', text: 'Four thousand would need MMMM, breaking the rule of three. For bigger numbers the Romans drew a bar over a symbol to multiply it by a thousand.' },
        ],
      },
    ],
  },
  {
    num: 'V',
    title: 'In the Wild',
    blurb: 'Years, long numerals, and the mistakes people really make.',
    lessons: [
      {
        glyph: 'MM',
        title: 'Anno Domini',
        subtitle: 'Reading and writing years',
        add: [],
        min: 1000,
        max: 2100,
        include: [YEAR],
        cards: [
          { t: 'intro', numeral: toRoman(YEAR), title: 'Numerals you will actually meet', text: 'Film credits, cornerstones, book title pages and monuments all love a year in Roman numerals. Most start with M or MM.' },
          { t: 'tap', n: 1776, text: 'Tap through MDCCLXXVI, the year on the US Declaration of Independence.' },
          { t: 'pick', q: 'A film ends with "© MCMXCIX". When was it made?', options: ['1999', '1899', '2001', '1919'], answer: 0, why: 'M 1000 + CM 900 + XC 90 + IX 9 = 1999.' },
          { t: 'build', n: 1066, text: 'Build 1066, the year of the Battle of Hastings.' },
          { t: 'build', n: 2000, text: 'Build the year 2000.' },
        ],
      },
      {
        glyph: '…',
        title: 'Chunk It',
        subtitle: 'Taming long numerals',
        add: [],
        max: 3999,
        minLen: 8,
        cards: [
          { t: 'intro', numeral: 'MMMDCCCLXXXVIII', title: 'Do not panic', text: 'This is the longest numeral there is: 3888. The secret to long ones is to chunk them into thousands, hundreds, tens and ones.' },
          { t: 'tap', n: 3888, text: 'Tap the four chunks of MMMDCCCLXXXVIII.' },
          { t: 'pick', q: 'What number is MMCDLXXVIII?', options: ['2478', '2678', '2428', '2488'], answer: 0, why: 'MM 2000 + CD 400 + LXX 70 + VIII 8 = 2478.' },
          { t: 'build', n: 1888, text: 'Build 1888, one place at a time.' },
          { t: 'build', n: 2748, text: 'Build 2748.' },
        ],
      },
      {
        glyph: '✗',
        title: 'The Mason\'s Mistakes',
        subtitle: 'Spot and fix common errors',
        add: [],
        focus: SUBTRACTIVE,
        max: 3999,
        cards: [
          { t: 'intro', numeral: 'IC', title: 'Tempting, but wrong', text: 'Only I, X and C can be subtracted, and only from the next two symbols up. I goes before V or X. X before L or C. C before D or M. So 99 is never IC.' },
          { t: 'pick', q: 'Which is the right way to write 49?', options: ['IL', 'XLIX', 'XXXXIX', 'XLVIIII'], answer: 1, why: '40 is XL, 9 is IX. IL tries to subtract I from L, which is too big a jump.' },
          { t: 'build', n: 95, text: 'Fix the mason\'s mistake.', wrong: 'VC' },
          { t: 'pick', q: 'Which is the right way to write 1999?', options: ['MIM', 'MCMXCIX', 'MDCCCCXCIX', 'MCMIC'], answer: 1, why: 'Place by place: M, CM, XC, IX. Shortcuts like MIM are not standard.' },
          { t: 'build', n: 490, text: 'Fix the mason\'s mistake.', wrong: 'XD' },
          { t: 'fact', icon: '🏆', title: 'You made it', text: 'Pass the final trial and you can read any standard Roman numeral ever carved. Bene factum: well done!' },
        ],
      },
    ],
  },
];

function buildGroups(): Group[] {
  const known: Token[] = [];
  return seeds.map((g, gi) => {
    const id = `g${gi + 1}`;
    const introduced: Token[] = [];
    let groupMax = 0;
    const lessons = g.lessons.map((s, li): Lesson => {
      known.push(...s.add);
      introduced.push(...s.add);
      groupMax = Math.max(groupMax, s.max);
      const lid = `${id}l${li + 1}`;
      return {
        id: lid,
        group: id,
        glyph: s.glyph,
        title: s.title,
        subtitle: s.subtitle,
        cards: s.cards,
        level: {
          key: lid,
          tokens: [...known],
          min: s.min ?? 1,
          max: s.max,
          focus: s.focus ?? s.add,
          minLen: s.minLen,
          include: s.include,
        },
      };
    });
    const trial: Level = {
      key: id,
      tokens: [...known],
      min: 1,
      max: groupMax,
      focus: introduced.length ? [...introduced] : SUBTRACTIVE,
    };
    return { id, num: g.num, title: g.title, blurb: g.blurb, lessons, trial };
  });
}

export const GROUPS: Group[] = buildGroups();
export const LESSONS: Lesson[] = GROUPS.flatMap((g) => g.lessons);
export const FULL_LEVEL: Level = { key: 'full', tokens: ALL_TOKENS, min: 1, max: 3999, focus: [] };

export const findLesson = (id: string) => LESSONS.find((l) => l.id === id);
export const findGroup = (id: string) => GROUPS.find((g) => g.id === id);
