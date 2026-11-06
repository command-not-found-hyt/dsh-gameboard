export const ARMOR_CONSTANT = 100;

export function mitigate(damage: number, armor: number): number {
  return damage * (ARMOR_CONSTANT / (ARMOR_CONSTANT + armor));
}

export function critDamage(base: number, multiplier: number): number {
  return base * multiplier;
}
