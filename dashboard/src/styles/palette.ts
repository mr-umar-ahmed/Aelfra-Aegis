/**
 * Aelfra Aegis Design System — Palette
 * 
 * These are the ONLY colors allowed in the UI.
 * Never use inline hex values — always reference via Tailwind classes:
 *   bg-ocean, text-villa, border-river, text-siren, etc.
 */

export const OCEAN_DEEP = "#4E635E" as const;
export const VILLA_NOVA = "#E2E0C8" as const;
export const SIREN_SONG = "#A6B49E" as const;
export const BIG_RIVER  = "#818C78" as const;

export const palette = {
  ocean: OCEAN_DEEP,
  villa: VILLA_NOVA,
  siren: SIREN_SONG,
  river: BIG_RIVER,
} as const;

/**
 * Tailwind-compatible theme extension object.
 * Import this in tailwind.config.ts:
 *   import { tailwindColors } from "./src/styles/palette";
 *   colors: { ...tailwindColors }
 */
export const tailwindColors = {
  ocean: OCEAN_DEEP,
  villa: VILLA_NOVA,
  siren: SIREN_SONG,
  river: BIG_RIVER,
} as const;
