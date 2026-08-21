import assert from 'node:assert/strict';
import test from 'node:test';
import { collectReferenceCandidates } from './reference-images.ts';

test('collectReferenceCandidates keeps all refs under limit', () => {
  const result = collectReferenceCandidates(
    {},
    {
      uploadedAttachments: ['u1', 'u2', 'u3'],
      metadata: {},
    },
    8,
  );

  assert.equal(result.sourceCount, 3);
  assert.equal(result.limitedCandidates.length, 3);
  assert.equal(result.truncated, false);
});

test('collectReferenceCandidates truncates injected refs over limit', () => {
  const uploaded = Array.from({ length: 12 }, (_, i) => `u${i + 1}`);
  const result = collectReferenceCandidates(
    {},
    {
      uploadedAttachments: uploaded,
      metadata: {},
    },
    8,
  );

  assert.equal(result.sourceCount, 12);
  assert.equal(result.limitedCandidates.length, 8);
  assert.equal(result.truncated, true);
});

test('falls back to ATTACHMENT_N when uploaded urls are absent', () => {
  const result = collectReferenceCandidates(
    {},
    {
      attachments: [{ type: 'image/png' }, { type: 'image/jpeg' }, { type: 'text/plain' }],
      metadata: {},
    },
    8,
  );

  assert.deepEqual(result.limitedCandidates, ['ATTACHMENT_0', 'ATTACHMENT_1']);
  assert.equal(result.sourceCount, 2);
  assert.equal(result.truncated, false);
});
