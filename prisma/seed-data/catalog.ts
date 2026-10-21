/**
 * Starting catalog and price lists. All prices are USD and can be changed
 * later from the admin panel; these values only bootstrap a fresh database.
 */

import type { OrderType, RankSystem } from "../../src/generated/prisma/enums";

type TierDef = {
  tier: string;
  /** Divisions from lowest to highest. Omit for single-rung tiers. */
  divisions?: readonly string[];
  /** Price per division climbed inside / out of this tier. Array = per division. */
  divisionPrice: number | readonly number[];
  winPrice: number;
  placementPrice: number;
};

export type RankStepSeed = {
  position: number;
  tier: string;
  division: string | null;
  divisionPrice: number | null;
  winPrice: number;
  placementPrice: number;
};

export type GameSeed = {
  name: string;
  slug: string;
  logoUrl: string;
  rankSystem: RankSystem;
  supportedOrderTypes: OrderType[];
  basePrice: number;
  coachingHourlyRate: number;
  rankSteps?: RankStepSeed[];
  ratingBrackets?: { minRating: number; maxRating: number; pricePer100: number; winPrice: number }[];
  servers: { code: string; name: string; region: string; priceModifier: number }[];
  lpGain?: { key: string; label: string; percentage: number; isDefault?: boolean }[];
  /** Game-specific wording for the "specific role/champion" add-on. */
  specificRoleLabel: string;
};

/** Expands tier definitions into an ordered ladder. The top rung has no division price. */
function buildLadder(tiers: readonly TierDef[], priceFactor = 1): RankStepSeed[] {
  const steps: RankStepSeed[] = [];
  for (const def of tiers) {
    const divisions = def.divisions ?? [null];
    divisions.forEach((division, index) => {
      const price = Array.isArray(def.divisionPrice) ? def.divisionPrice[index] : def.divisionPrice;
      steps.push({
        position: steps.length,
        tier: def.tier,
        division,
        divisionPrice: round2(Number(price) * priceFactor),
        winPrice: round2(def.winPrice * priceFactor),
        placementPrice: round2(def.placementPrice * priceFactor),
      });
    });
  }
  steps[steps.length - 1].divisionPrice = null;
  return steps;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const LOL_DIVISIONS = ["IV", "III", "II", "I"] as const;

const LOL_TIERS: readonly TierDef[] = [
  { tier: "Iron", divisions: LOL_DIVISIONS, divisionPrice: 5, winPrice: 2, placementPrice: 2.5 },
  { tier: "Bronze", divisions: LOL_DIVISIONS, divisionPrice: 6, winPrice: 2.5, placementPrice: 3 },
  { tier: "Silver", divisions: LOL_DIVISIONS, divisionPrice: 8, winPrice: 3, placementPrice: 3.5 },
  { tier: "Gold", divisions: LOL_DIVISIONS, divisionPrice: 11, winPrice: 4, placementPrice: 5 },
  { tier: "Platinum", divisions: LOL_DIVISIONS, divisionPrice: 15, winPrice: 5, placementPrice: 6 },
  { tier: "Emerald", divisions: LOL_DIVISIONS, divisionPrice: 22, winPrice: 7, placementPrice: 8 },
  { tier: "Diamond", divisions: LOL_DIVISIONS, divisionPrice: [35, 40, 48, 60], winPrice: 10, placementPrice: 12 },
  { tier: "Master", divisionPrice: 250, winPrice: 15, placementPrice: 18 },
  { tier: "Grandmaster", divisionPrice: 400, winPrice: 22, placementPrice: 25 },
  { tier: "Challenger", divisionPrice: 0, winPrice: 30, placementPrice: 35 },
];

const VALORANT_DIVISIONS = ["1", "2", "3"] as const;

const VALORANT_TIERS: readonly TierDef[] = [
  { tier: "Iron", divisions: VALORANT_DIVISIONS, divisionPrice: 4, winPrice: 2, placementPrice: 2.5 },
  { tier: "Bronze", divisions: VALORANT_DIVISIONS, divisionPrice: 5, winPrice: 2.5, placementPrice: 3 },
  { tier: "Silver", divisions: VALORANT_DIVISIONS, divisionPrice: 6, winPrice: 3, placementPrice: 3.5 },
  { tier: "Gold", divisions: VALORANT_DIVISIONS, divisionPrice: 8, winPrice: 4, placementPrice: 4.5 },
  { tier: "Platinum", divisions: VALORANT_DIVISIONS, divisionPrice: 11, winPrice: 5, placementPrice: 6 },
  { tier: "Diamond", divisions: VALORANT_DIVISIONS, divisionPrice: 16, winPrice: 7, placementPrice: 8 },
  { tier: "Ascendant", divisions: VALORANT_DIVISIONS, divisionPrice: 24, winPrice: 10, placementPrice: 12 },
  { tier: "Immortal", divisions: VALORANT_DIVISIONS, divisionPrice: [45, 60, 150], winPrice: 16, placementPrice: 18 },
  { tier: "Radiant", divisionPrice: 0, winPrice: 30, placementPrice: 35 },
];

const OW_DIVISIONS = ["5", "4", "3", "2", "1"] as const;

const OVERWATCH_TIERS: readonly TierDef[] = [
  { tier: "Bronze", divisions: OW_DIVISIONS, divisionPrice: 3, winPrice: 1.5, placementPrice: 2 },
  { tier: "Silver", divisions: OW_DIVISIONS, divisionPrice: 4, winPrice: 2, placementPrice: 2.5 },
  { tier: "Gold", divisions: OW_DIVISIONS, divisionPrice: 5, winPrice: 2.5, placementPrice: 3 },
  { tier: "Platinum", divisions: OW_DIVISIONS, divisionPrice: 7, winPrice: 3, placementPrice: 4 },
  { tier: "Diamond", divisions: OW_DIVISIONS, divisionPrice: 10, winPrice: 4.5, placementPrice: 5.5 },
  { tier: "Master", divisions: OW_DIVISIONS, divisionPrice: 15, winPrice: 6, placementPrice: 7 },
  { tier: "Grandmaster", divisions: OW_DIVISIONS, divisionPrice: 25, winPrice: 9, placementPrice: 10 },
  { tier: "Champion", divisions: OW_DIVISIONS, divisionPrice: 40, winPrice: 14, placementPrice: 16 },
];

const WR_TIERS: readonly TierDef[] = LOL_TIERS.filter((def) => def.tier !== "Iron");

const MR_DIVISIONS = ["3", "2", "1"] as const;

const MARVEL_RIVALS_TIERS: readonly TierDef[] = [
  { tier: "Bronze", divisions: MR_DIVISIONS, divisionPrice: 3, winPrice: 1.5, placementPrice: 2 },
  { tier: "Silver", divisions: MR_DIVISIONS, divisionPrice: 4, winPrice: 2, placementPrice: 2.5 },
  { tier: "Gold", divisions: MR_DIVISIONS, divisionPrice: 6, winPrice: 3, placementPrice: 3.5 },
  { tier: "Platinum", divisions: MR_DIVISIONS, divisionPrice: 8, winPrice: 4, placementPrice: 5 },
  { tier: "Diamond", divisions: MR_DIVISIONS, divisionPrice: 12, winPrice: 5.5, placementPrice: 6.5 },
  { tier: "Grandmaster", divisions: MR_DIVISIONS, divisionPrice: 20, winPrice: 8, placementPrice: 9 },
  { tier: "Celestial", divisions: MR_DIVISIONS, divisionPrice: 32, winPrice: 12, placementPrice: 14 },
  { tier: "Eternity", divisions: MR_DIVISIONS, divisionPrice: 50, winPrice: 18, placementPrice: 20 },
  { tier: "One Above All", divisionPrice: 0, winPrice: 30, placementPrice: 35 },
];

const RIOT_LOL_SERVERS = [
  { code: "EUW", name: "Europe West", region: "EU", priceModifier: 0 },
  { code: "EUNE", name: "Europe Nordic & East", region: "EU", priceModifier: 0 },
  { code: "TR", name: "Turkey", region: "EU", priceModifier: 0 },
  { code: "NA", name: "North America", region: "NA", priceModifier: 10 },
  { code: "OCE", name: "Oceania", region: "OCE", priceModifier: 10 },
  { code: "BR", name: "Brazil", region: "SA", priceModifier: 5 },
  { code: "LAN", name: "Latin America North", region: "SA", priceModifier: 5 },
  { code: "LAS", name: "Latin America South", region: "SA", priceModifier: 5 },
  { code: "KR", name: "Korea", region: "ASIA", priceModifier: 20 },
  { code: "JP", name: "Japan", region: "ASIA", priceModifier: 15 },
];

const LOL_LP_GAIN = [
  { key: "normal_lp", label: "Normal LP (+20 or more)", percentage: 0, isDefault: true },
  { key: "low_lp", label: "Low LP (+15 to +19)", percentage: 20 },
  { key: "very_low_lp", label: "Very low LP (below +15)", percentage: 40 },
  { key: "smurf_queue", label: "Smurf queue (+25 or more)", percentage: -10 },
];

export const GAMES: GameSeed[] = [
  {
    name: "League of Legends",
    slug: "league-of-legends",
    logoUrl: "/games/league-of-legends.svg",
    rankSystem: "DIVISION",
    supportedOrderTypes: ["DIVISION", "WIN", "PLACEMENT", "COACHING"],
    basePrice: 0,
    coachingHourlyRate: 20,
    rankSteps: buildLadder(LOL_TIERS),
    servers: RIOT_LOL_SERVERS,
    lpGain: LOL_LP_GAIN,
    specificRoleLabel: "Specific roles & champions",
  },
  {
    name: "Valorant",
    slug: "valorant",
    logoUrl: "/games/valorant.svg",
    rankSystem: "DIVISION",
    supportedOrderTypes: ["DIVISION", "WIN", "PLACEMENT", "COACHING"],
    basePrice: 0,
    coachingHourlyRate: 18,
    rankSteps: buildLadder(VALORANT_TIERS),
    servers: [
      { code: "EU", name: "Europe", region: "EU", priceModifier: 0 },
      { code: "NA", name: "North America", region: "NA", priceModifier: 10 },
      { code: "AP", name: "Asia Pacific", region: "ASIA", priceModifier: 10 },
      { code: "KR", name: "Korea", region: "ASIA", priceModifier: 20 },
      { code: "LATAM", name: "Latin America", region: "SA", priceModifier: 5 },
      { code: "BR", name: "Brazil", region: "SA", priceModifier: 5 },
    ],
    lpGain: [
      { key: "normal_rr", label: "Normal RR (+18 or more)", percentage: 0, isDefault: true },
      { key: "low_rr", label: "Low RR (below +18)", percentage: 25 },
    ],
    specificRoleLabel: "Specific agents",
  },
  {
    name: "Teamfight Tactics",
    slug: "teamfight-tactics",
    logoUrl: "/games/teamfight-tactics.svg",
    rankSystem: "DIVISION",
    supportedOrderTypes: ["DIVISION", "WIN", "PLACEMENT", "COACHING"],
    basePrice: 0,
    coachingHourlyRate: 15,
    rankSteps: buildLadder(LOL_TIERS, 0.7),
    servers: RIOT_LOL_SERVERS,
    lpGain: LOL_LP_GAIN,
    specificRoleLabel: "Specific comps",
  },
  {
    name: "Counter-Strike 2",
    slug: "counter-strike-2",
    logoUrl: "/games/counter-strike-2.svg",
    rankSystem: "RATING",
    supportedOrderTypes: ["DIVISION", "WIN", "COACHING"],
    basePrice: 0,
    coachingHourlyRate: 18,
    ratingBrackets: [
      { minRating: 0, maxRating: 5000, pricePer100: 1.5, winPrice: 2 },
      { minRating: 5000, maxRating: 10000, pricePer100: 2.5, winPrice: 3 },
      { minRating: 10000, maxRating: 15000, pricePer100: 4, winPrice: 4 },
      { minRating: 15000, maxRating: 20000, pricePer100: 6.5, winPrice: 6 },
      { minRating: 20000, maxRating: 25000, pricePer100: 10, winPrice: 8 },
      { minRating: 25000, maxRating: 30000, pricePer100: 16, winPrice: 12 },
      { minRating: 30000, maxRating: 35000, pricePer100: 25, winPrice: 18 },
    ],
    servers: [
      { code: "EU", name: "Europe", region: "EU", priceModifier: 0 },
      { code: "NA", name: "North America", region: "NA", priceModifier: 10 },
      { code: "ASIA", name: "Asia", region: "ASIA", priceModifier: 10 },
      { code: "SA", name: "South America", region: "SA", priceModifier: 5 },
    ],
    specificRoleLabel: "Specific role (AWP, entry...)",
  },
  {
    name: "Overwatch 2",
    slug: "overwatch-2",
    logoUrl: "/games/overwatch-2.svg",
    rankSystem: "DIVISION",
    supportedOrderTypes: ["DIVISION", "WIN", "PLACEMENT", "COACHING"],
    basePrice: 0,
    coachingHourlyRate: 15,
    rankSteps: buildLadder(OVERWATCH_TIERS),
    servers: [
      { code: "EU", name: "Europe", region: "EU", priceModifier: 0 },
      { code: "AMERICAS", name: "Americas", region: "NA", priceModifier: 10 },
      { code: "ASIA", name: "Asia", region: "ASIA", priceModifier: 10 },
    ],
    specificRoleLabel: "Specific heroes",
  },
  {
    name: "Wild Rift",
    slug: "wild-rift",
    logoUrl: "/games/wild-rift.svg",
    rankSystem: "DIVISION",
    supportedOrderTypes: ["DIVISION", "WIN", "PLACEMENT", "COACHING"],
    basePrice: 0,
    coachingHourlyRate: 14,
    rankSteps: buildLadder(WR_TIERS, 0.8),
    servers: [
      { code: "EU", name: "Europe", region: "EU", priceModifier: 0 },
      { code: "TR", name: "Turkey", region: "EU", priceModifier: 0 },
      { code: "NA", name: "North America", region: "NA", priceModifier: 10 },
      { code: "SEA", name: "South-East Asia", region: "ASIA", priceModifier: 10 },
      { code: "KR", name: "Korea", region: "ASIA", priceModifier: 20 },
      { code: "BR", name: "Brazil", region: "SA", priceModifier: 5 },
    ],
    lpGain: LOL_LP_GAIN,
    specificRoleLabel: "Specific roles & champions",
  },
  {
    name: "Marvel Rivals",
    slug: "marvel-rivals",
    logoUrl: "/games/marvel-rivals.svg",
    rankSystem: "DIVISION",
    supportedOrderTypes: ["DIVISION", "WIN", "PLACEMENT", "COACHING"],
    basePrice: 0,
    coachingHourlyRate: 15,
    rankSteps: buildLadder(MARVEL_RIVALS_TIERS),
    servers: [
      { code: "EU", name: "Europe", region: "EU", priceModifier: 0 },
      { code: "NA", name: "North America", region: "NA", priceModifier: 10 },
      { code: "ASIA", name: "Asia", region: "ASIA", priceModifier: 10 },
      { code: "SA", name: "South America", region: "SA", priceModifier: 5 },
    ],
    lpGain: [
      { key: "normal_rs", label: "Normal rank score (+20 or more)", percentage: 0, isDefault: true },
      { key: "low_rs", label: "Low rank score (below +20)", percentage: 20 },
    ],
    specificRoleLabel: "Specific heroes",
  },
];

/** Add-ons offered for every game (percentages from the product spec). */
export const COMMON_ADD_ONS = [
  { key: "priority", label: "Priority / Express", description: "Your order is started first and played with extra hours.", percentage: 20 },
  { key: "offline_mode", label: "Appear offline", description: "Booster stays invisible in the friends list.", percentage: 0 },
  { key: "specific_role", label: "Specific role / champion", description: "Booster plays only the roles or picks you choose.", percentage: 15 },
  { key: "vpn", label: "VPN connection", description: "Booster logs in through a VPN in your country.", percentage: 5 },
  { key: "live_stream", label: "Live stream", description: "Watch every game live on a private stream.", percentage: 25 },
] as const;
