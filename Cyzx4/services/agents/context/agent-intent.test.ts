import assert from 'node:assert/strict';
import test from 'node:test';

import { detectFollowUpIntent } from './agent-intent.ts';
import { buildAgentContext } from './buildAgentContext.ts';

const createContext = (prompt = '') => buildAgentContext({
  workspaceId: 'workspace-a',
  messages: [],
  assets: [],
  productAnalysis: null,
  generationPlan: prompt
    ? { prompt, referenceImageIds: [], updatedAt: 1 }
    : null,
  activeTask: null,
  lastAgentResult: null,
  canvasElements: [],
});

test('classifies the four workspace intents', () => {
  const context = createContext('Create an Instagram photo for these trousers.');

  assert.equal(detectFollowUpIntent('生成一个适合这个裤子的 INS 图', context), 'NEW_TASK');
  assert.equal(detectFollowUpIntent('场景更日常一点', context), 'UPDATE_CURRENT_PLAN');
  assert.equal(detectFollowUpIntent('生成吧', context), 'EXECUTE_CURRENT_PLAN');
  assert.equal(detectFollowUpIntent('再来一张', context), 'REGENERATE');
});

test('does not execute an omitted command without a saved generation plan', () => {
  assert.equal(detectFollowUpIntent('生成吧', createContext()), 'NEW_TASK');
});
