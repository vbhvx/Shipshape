import { describe, it, expect } from 'vitest';
import { deriveProjectName, cleanDisplayTitle } from '@/lib/project-utils';

describe('Project Utilities', () => {
  describe('deriveProjectName', () => {
    it('uses customName when provided and valid', () => {
      expect(deriveProjectName('build a todo app', 'My Super Todo')).toBe('My Super Todo');
    });

    it('cleans leading command verbs and strips articles', () => {
      expect(deriveProjectName('build a todo app')).toBe('Todo App');
      expect(deriveProjectName('create an expense tracker')).toBe('Expense Tracker');
      expect(deriveProjectName('generate a kanban board')).toBe('Kanban Board');
      expect(deriveProjectName('make a real estate crm')).toBe('Real Estate Crm');
    });

    it('preserves clean names and capitalizes appropriately', () => {
      expect(deriveProjectName('personal fitness tracker')).toBe('Personal Fitness Tracker');
    });

    it('falls back to New Project for empty or minimal inputs', () => {
      expect(deriveProjectName('')).toBe('New Project');
      expect(deriveProjectName('build a')).toBe('New Project');
    });
  });

  describe('cleanDisplayTitle', () => {
    it('cleans up legacy command-style titles', () => {
      expect(cleanDisplayTitle('build a todo app')).toBe('Todo App');
      expect(cleanDisplayTitle('create a notes app')).toBe('Notes App');
    });

    it('preserves normal titles', () => {
      expect(cleanDisplayTitle('Task Manager')).toBe('Task Manager');
      expect(cleanDisplayTitle('Shipshape App')).toBe('Shipshape App');
    });
  });
});

