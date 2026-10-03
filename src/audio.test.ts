import assert from 'node:assert/strict';
import test from 'node:test';
import { AMBIENT_VOICES, ambientVoiceFor, createSound, isSoundMode, soundLabel } from './audio.ts';
import { SCENE_CHOICES } from './scenes/index.ts';

test('sound modes round-trip through the guard', () => {
  assert.equal(isSoundMode('off'), true);
  assert.equal(isSoundMode('chime'), true);
  assert.equal(isSoundMode('ambient'), true);
  assert.equal(isSoundMode('loud'), false);
  assert.equal(isSoundMode(null), false);
  assert.equal(soundLabel('off'), 'Sound off');
  assert.equal(soundLabel('chime'), 'Chime');
  assert.equal(soundLabel('ambient'), 'Ambient');
});

test('every scene has a sane ambient voice', () => {
  assert.equal(SCENE_CHOICES.length, 8);
  for (const choice of SCENE_CHOICES) {
    const voice = AMBIENT_VOICES[choice.id];
    assert.ok(voice.label.length > 0);
    assert.ok(Number.isFinite(voice.frequency) && voice.frequency > 0);
    assert.ok(Number.isFinite(voice.q) && voice.q > 0);
    assert.ok(voice.gain > 0 && voice.gain < 0.2);
    if (voice.lfoFrequency == null) {
      assert.equal(voice.lfoDepth, 0);
    } else {
      assert.ok(voice.lfoFrequency > 0 && voice.lfoFrequency < 20);
      assert.ok(voice.lfoDepth > 0 && voice.lfoDepth < voice.gain);
    }
  }
});

test('voices differ by scene like background sounds', () => {
  assert.ok(ambientVoiceFor('rain').frequency > ambientVoiceFor('night').frequency);
  assert.notEqual(ambientVoiceFor('ocean').label, ambientVoiceFor('rain').label);
  assert.ok(ambientVoiceFor('ocean').lfoFrequency !== null);
  assert.equal(ambientVoiceFor('night').lfoFrequency, null);
  assert.equal(ambientVoiceFor('nope').label, ambientVoiceFor('meadow').label);
});

test('ambient label follows the scene without needing audio hardware', () => {
  const sound = createSound();
  assert.equal(sound.mode, 'chime');
  assert.equal(sound.label(), 'Chime');
  sound.setScene('rain');
  sound.setMode('ambient');
  assert.equal(sound.label(), 'Rain');
  sound.setScene('ocean');
  assert.equal(sound.label(), 'Ocean');
  sound.cycle();
  assert.equal(sound.mode, 'off');
  assert.equal(sound.label(), 'Sound off');
});
