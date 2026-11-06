import { critDamage, mitigate } from "../../src/combat/damage";

test("armor mitigation", () => {
  expect(mitigate(100, 100)).toBe(50);
});

test("crit stacks", () => {
  expect(critDamage(100, 1.5)).toBe(120);
});
