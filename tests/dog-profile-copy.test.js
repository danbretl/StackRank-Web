import assert from 'node:assert/strict';
import test from 'node:test';
import { hasUnsafeDogProfileCopy } from '../lib/dog-profile-copy.js';

test('profile screen permits a named, aged dog’s explicitly attributed training observation', () => {
  assert.equal(hasUnsafeDogProfileCopy('Affectionate and easy to train in her owner’s account, one-year-old Jasmine is a Pugapoo who likes sleeping under blankets.'), false);
  assert.equal(hasUnsafeDogProfileCopy("Easygoing and easy to train in his owner's account, 3-year-old Milo was fond of fetching."), false);
});

test('profile screen retains the restriction on generic or incomplete training claims', () => {
  for (const text of [
    'Pugapoos are easy to train.',
    'Easy to train and affectionate, this cross enjoys company.',
    'This cross is easy to train in its owners’ accounts.',
    'She is easy to train in her owner’s account.',
    'They are easy to train in her owner’s account, one-year-old dogs are playful.',
  ]) assert.equal(hasUnsafeDogProfileCopy(text), true, text);
});

test('an attributed training observation does not exempt other claims or sentences', () => {
  const scoped = 'Affectionate and easy to train in her owner’s account, one-year-old Jasmine is a Pugapoo.';
  for (const claim of ['This breed is easy to train.', 'Safe with children.', 'Hypoallergenic.', 'Perfect for families.', 'Aggressive.', 'Good with children.']) {
    assert.equal(hasUnsafeDogProfileCopy(`${scoped} ${claim}`), true, claim);
  }
});

test('profile screen permits a named keeper’s explicitly attributed adverse guardian observation', () => {
  const scoped = 'Raptor Sarabi Kennel describes a guardian affectionate toward its family but aggressive toward unfamiliar beings.';
  assert.equal(hasUnsafeDogProfileCopy(scoped), false);
  for (const claim of ['Aggressive.', 'Safe with children.', 'Perfect for families.']) {
    assert.equal(hasUnsafeDogProfileCopy(`${scoped} ${claim}`), true, claim);
  }
  for (const text of [
    'Sarabis are aggressive toward unfamiliar beings.',
    'A guardian affectionate toward its family but aggressive toward unfamiliar beings.',
    'Some owners describe aggressive dogs.',
  ]) assert.equal(hasUnsafeDogProfileCopy(text), true, text);
});
