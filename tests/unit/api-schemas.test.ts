import { describe, it, expect } from 'vitest';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  PlanRequestSchema,
  GenerateRequestSchema,
  ModifyRequestSchema,
  RestoreVersionSchema,
} from '../../src/types';

describe('API Request Validation Schemas', () => {
  describe('CreateProjectSchema', () => {
    it('accepts valid project creation payload', () => {
      const payload = {
        name: 'Distributed PulseStream',
        description: 'Cloud infrastructure observability dashboard',
        templateId: 'nextjs-typescript',
      };
      const result = CreateProjectSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe(payload.name);
        expect(result.data.templateId).toBe('nextjs-typescript');
      }
    });

    it('supplies default templateId when omitted', () => {
      const payload = {
        name: 'Kroma Studio',
        description: 'Creative asset management workspace',
      };
      const result = CreateProjectSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.templateId).toBe('nextjs-typescript');
      }
    });

    it('rejects empty name or empty description', () => {
      expect(CreateProjectSchema.safeParse({ name: '', description: 'Desc' }).success).toBe(false);
      expect(CreateProjectSchema.safeParse({ name: 'Valid', description: '' }).success).toBe(false);
    });

    it('rejects names exceeding 100 characters', () => {
      const longName = 'A'.repeat(101);
      const result = CreateProjectSchema.safeParse({
        name: longName,
        description: 'Valid description',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateProjectSchema', () => {
    it('accepts valid partial updates', () => {
      const res1 = UpdateProjectSchema.safeParse({ name: 'Renamed Project' });
      expect(res1.success).toBe(true);

      const res2 = UpdateProjectSchema.safeParse({ status: 'running' });
      expect(res2.success).toBe(true);

      const res3 = UpdateProjectSchema.safeParse({
        name: 'New Name',
        description: 'New Description',
        status: 'ready',
        activeVersionId: 'ver_123',
      });
      expect(res3.success).toBe(true);
    });

    it('rejects invalid project status enum', () => {
      const result = UpdateProjectSchema.safeParse({ status: 'destroyed' as any });
      expect(result.success).toBe(false);
    });

    it('rejects unknown or arbitrary injected fields', () => {
      const result = UpdateProjectSchema.safeParse({
        name: 'Project',
        injectedField: 'malicious_code',
        ownerUserId: 'different_user',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('PlanRequestSchema', () => {
    it('accepts valid prompt', () => {
      const result = PlanRequestSchema.safeParse({
        prompt: 'Build a fintech wealth tracker',
      });
      expect(result.success).toBe(true);
    });

    it('rejects prompt that is too short', () => {
      const result = PlanRequestSchema.safeParse({ prompt: 'ab' });
      expect(result.success).toBe(false);
    });
  });

  describe('GenerateRequestSchema', () => {
    it('accepts a bounded deterministic build prompt', () => {
      expect(
        GenerateRequestSchema.safeParse({
          prompt: 'Build a customer feedback portal with triage',
          modelProvider: 'deterministic',
        }).success
      ).toBe(true);
    });

    it('rejects empty requests and unavailable provider labels', () => {
      expect(GenerateRequestSchema.safeParse({}).success).toBe(false);
      expect(
        GenerateRequestSchema.safeParse({
          prompt: 'Build a dashboard',
          modelProvider: 'gemini',
        }).success
      ).toBe(false);
    });
  });

  describe('ModifyRequestSchema', () => {
    it('accepts valid instruction with optional baseVersionId', () => {
      const result = ModifyRequestSchema.safeParse({
        instruction: 'Add dark mode toggle to navigation bar',
        baseVersionId: 'ver_v1',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty instruction', () => {
      const result = ModifyRequestSchema.safeParse({ instruction: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('RestoreVersionSchema', () => {
    it('accepts valid versionId and optional reason', () => {
      const result = RestoreVersionSchema.safeParse({
        versionId: 'ver_v1',
        reason: 'Rollback regression',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing or empty versionId', () => {
      const result = RestoreVersionSchema.safeParse({ versionId: '' });
      expect(result.success).toBe(false);
    });
  });
});
