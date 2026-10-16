import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, formatAnswer, autoSubmitLength } from '../src/answer.js';

test('numeric answers compare numerically', () => {
  assert.equal(checkAnswer('63', '63'), true);
  assert.equal(checkAnswer('63', '36'), false);
  assert.equal(checkAnswer('23.5', '23.5'), true);
  assert.equal(checkAnswer('48.5', '48.50'), true);
  assert.equal(checkAnswer('0.7', '.7'), true);
  assert.equal(checkAnswer('63', ''), false);
  assert.equal(checkAnswer('63', '6.'), false);
});

test('remainder answers compare quotient and remainder', () => {
  assert.equal(checkAnswer('4 r 3', '4r3'), true);
  assert.equal(checkAnswer('4 r 3', '4 r 3'), true);
  assert.equal(checkAnswer('4 r 3', '4 r 2'), false);
  assert.equal(checkAnswer('4 r 3', '4'), false);
});

test('formatAnswer renders money with 2dp when fractional', () => {
  assert.equal(formatAnswer('48', '£', ''), '£48');
  assert.equal(formatAnswer('48.5', '£', ''), '£48.50');
  assert.equal(formatAnswer('37.5', '', '%'), '37.5%');
  assert.equal(formatAnswer('4 r 3', '', ''), '4 r 3');
});

test('autoSubmitLength only for plain integers', () => {
  assert.equal(autoSubmitLength('63'), 2);
  assert.equal(autoSubmitLength('23.5'), null);
  assert.equal(autoSubmitLength('4 r 3'), null);
});
