import { describe, it, expect } from 'vitest';
import { createPlanFromPrompt } from '../../src/modules/planning/planning-engine';

describe('Requirement Interpretation & Application Planning Engine', () => {
  it('interprets plain-language requirements into structured specification and plan', async () => {
    const prompt = 'Build a modern SaaS Kanban board with sprint tasks, drag-and-drop, and priority filters.';
    const plan = await createPlanFromPrompt('proj_test_1', 'Kanban Flow', prompt);

    expect(plan.projectId).toBe('proj_test_1');
    expect(plan.specification.name).toBe('Kanban Flow');
    expect(plan.specification.description).toBe(prompt);

    // Verify Routes
    expect(plan.routes.length).toBeGreaterThanOrEqual(3);
    expect(plan.routes.some((r) => r.path === '/')).toBe(true);
    expect(plan.routes.some((r) => r.path === '/explore')).toBe(true);

    // Verify Core Features
    expect(plan.specification.features.length).toBeGreaterThanOrEqual(4);
    expect(plan.specification.features.some((f) => f.id === 'feat_crud')).toBe(true);

    // Verify Data Model Entities
    expect(plan.dataModel.entities.length).toBeGreaterThanOrEqual(1);
    expect(plan.dataModel.entities[0].name).toBe('TaskItem');
    expect(plan.dataModel.entities[0].fields.some((f) => f.name === 'title')).toBe(true);
    expect(plan.dataModel.entities[0].fields.some((f) => f.name === 'status')).toBe(true);

    // Verify Major Components
    expect(plan.majorComponents.some((c) => c.name === 'HeaderNav')).toBe(true);
    expect(plan.majorComponents.some((c) => c.name === 'ItemModal')).toBe(true);

    // Verify Acceptance Criteria
    expect(plan.specification.acceptanceCriteria.length).toBeGreaterThanOrEqual(3);
  });

  it('detects e-commerce domain and tailors data model to products and cart', async () => {
    const prompt = 'Online luxury fragrance store with product catalog and checkout cart';
    const plan = await createPlanFromPrompt('proj_ecom', 'ScentCraft', prompt);

    expect(plan.dataModel.entities.some((e) => e.name === 'Product')).toBe(true);
    expect(plan.dataModel.entities.some((e) => e.name === 'CartItem')).toBe(true);
  });
});
