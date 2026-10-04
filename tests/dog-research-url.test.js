import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGACY_TANG_STANDARD, validDogResearchUrl } from '../lib/dog-research-url.js';

test('legacy factual-source exception cannot admit other insecure or credential-bearing URLs', () => {
  assert.equal(validDogResearchUrl(LEGACY_TANG_STANDARD), true);
  assert.equal(validDogResearchUrl('https://www.cku.org.cn/inform/view/5525.html'), true);
  for (const url of [
    'http://example.org/standard', LEGACY_TANG_STANDARD + '?redirect=elsewhere',
    LEGACY_TANG_STANDARD.replace('tangdog', 'other'),
    LEGACY_TANG_STANDARD.replace('old.cku.org.cn', 'old.cku.org.cn.example.org'),
    'https://name:secret@example.org/standard', 'javascript:alert(1)',
  ]) assert.equal(validDogResearchUrl(url), false, url);
});
