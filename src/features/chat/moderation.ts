/**
 * Profanity / insult filter for chat in the four site languages. Matching
 * words are masked and the message is flagged for staff review. A word list
 * is a deterrent, not a guarantee.
 */

/** Whole words only: short or ambiguous ones that are also parts of normal words. */
const WORDS = [
  // Turkish
  // ("piç" / "oç" are left out: with accents folded they read as "pic" / "oc".)
  "amk", "aq", "amq", "sik", "sikik", "kahpe", "gavat", "puşt", "ibne", "kaltak", "gerizekalı", "gerizekali", "şerefsiz",
  // English
  "cunt", "cunts", "twat", "wanker", "fag", "retard", "retarded", "retards", "kys", "dickhead", "bastard",
  "nigger", "niggers", "nigga", "niggas",
  // German
  "fotze", "missgeburt", "schlampe", "spast", "fick", "ficken", "fickt",
  // Spanish
  "puta", "putas", "puto", "putos", "mierda", "marica", "maricón", "joder", "jódete", "malparido",
];

/** Matched anywhere inside a word (compounds, suffixes): long stems with no innocent use. */
const STEMS = [
  // Turkish
  "siktir", "sikeyim", "sikerim", "sikim", "orospu", "yarrak", "pezevenk", "amcık", "amcik", "götveren",
  // English
  "fuck", "bitch", "whore", "slut", "faggot", "asshole",
  // German
  "hurensohn", "arschloch", "wichser", "scheiß", "scheiss",
  // Spanish
  "hijoputa", "hijodeputa", "gilipoll", "pendej", "cabrón",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

/**
 * Lowercase, accents folded (ş→s, ö→o, ß→ss), leetspeak undone and runs of 3+
 * equal letters collapsed ("fuuuck"). Pairs stay, so "nigger" never becomes "Niger".
 * Dotless ı is kept: folding it would turn the everyday "sık" into "sik".
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/[013457@$]/g, (char) => LEET[char] ?? char)
    .replace(/(.)\1{2,}/gu, "$1");
}

const words = new Set(WORDS.map(normalize));
const stems = STEMS.map(normalize);

function isBlocked(token: string): boolean {
  const value = normalize(token);
  return words.has(value) || stems.some((stem) => value.includes(stem));
}

export type ModerationResult = { text: string; flagged: boolean };

export function moderate(text: string): ModerationResult {
  let flagged = false;
  const masked = text.replace(/[\p{L}\p{N}@$]+/gu, (token) => {
    if (!isBlocked(token)) return token;
    flagged = true;
    return "*".repeat([...token].length);
  });
  return { text: masked, flagged };
}
