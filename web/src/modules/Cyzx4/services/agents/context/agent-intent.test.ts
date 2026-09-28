import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectFollowUpIntent,
  referencesExistingWorkspaceContext,
} from './agent-intent.ts';
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

test('treats a detailed production instruction as executable work instead of a plan update', () => {
  const context = createContext('先分析这个产品');
  assert.equal(
    detectFollowUpIntent('我想你帮我将我的这个产品换到这个模特上，比例保持2：3', context),
    'NEW_TASK',
  );
});

test('detects explicit references to existing workspace assets', () => {
  assert.equal(referencesExistingWorkspaceContext('把这个产品换到这个模特上'), true);
  assert.equal(referencesExistingWorkspaceContext('保持上一张的服装细节'), true);
  assert.equal(referencesExistingWorkspaceContext('新任务，不要用之前的图片'), false);
});
