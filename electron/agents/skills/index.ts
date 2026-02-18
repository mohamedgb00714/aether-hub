import { SkillRegistry } from './SkillRegistry.js';
import { builtInSkills } from './BuiltInSkills.js';

export function createSkillRegistry(): SkillRegistry {
  const registry = new SkillRegistry();
  builtInSkills.forEach(skill => registry.register(skill));
  return registry;
}
