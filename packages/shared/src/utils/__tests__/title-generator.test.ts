import { describe, test, expect } from 'bun:test';
import {
  sliceAtWord,
  selectSpreadMessages,
  validateTitle,
  buildTitlePrompt,
  buildRegenerateTitlePrompt,
} from '../title-generator.ts';

// ---------------------------------------------------------------------------
// sliceAtWord
// ---------------------------------------------------------------------------
describe('sliceAtWord', () => {
  test('returns short text unchanged', () => {
    expect(sliceAtWord('hello world', 500)).toBe('hello world');
  });

  test('cuts at last word boundary before max', () => {
    expect(sliceAtWord('aaa bbb ccc ddd', 10)).toBe('aaa bbb');
  });

  test('falls back to hard cut when no spaces exist', () => {
    const noSpaces = 'a'.repeat(600);
    expect(sliceAtWord(noSpaces, 500)).toBe('a'.repeat(500));
  });

  test('handles exact boundary', () => {
    expect(sliceAtWord('12345', 5)).toBe('12345');
  });

  test('handles single long word preceded by space', () => {
    // "x " + 500 a's — space at index 1, then no more spaces
    const text = 'x ' + 'a'.repeat(500);
    const result = sliceAtWord(text, 10);
    expect(result).toBe('x');
  });
});

// ---------------------------------------------------------------------------
// selectSpreadMessages
// ---------------------------------------------------------------------------
describe('selectSpreadMessages', () => {
  test('returns empty for no messages', () => {
    expect(selectSpreadMessages([])).toEqual([]);
  });

  test('returns the single message for 1', () => {
    expect(selectSpreadMessages(['a'])).toEqual(['a']);
  });

  test('returns both for 2 messages', () => {
    expect(selectSpreadMessages(['a', 'b'])).toEqual(['a', 'b']);
  });

  test('returns all three for 3 messages', () => {
    expect(selectSpreadMessages(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  test('picks first, ~66%, and last for 4 messages', () => {
    const msgs = ['a', 'b', 'c', 'd'];
    const result = selectSpreadMessages(msgs);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('a'); // first
    expect(result[2]).toBe('d'); // last
    // middle should be index 2 (floor(4*2/3) = 2) → 'c'
    expect(result[1]).toBe('c');
  });

  test('picks first, ~66%, and last for 100 messages', () => {
    const msgs = Array.from({ length: 100 }, (_, i) => `msg${i}`);
    const result = selectSpreadMessages(msgs);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('msg0');
    expect(result[2]).toBe('msg99');
    // middle: floor(100*2/3) = 66
    expect(result[1]).toBe('msg66');
  });

  test('biases toward end more than midpoint', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => `msg${i}`);
    const result = selectSpreadMessages(msgs);
    // floor(10*2/3) = 6, which is past the midpoint (5)
    expect(result[1]).toBe('msg6');
  });
});

// ---------------------------------------------------------------------------
// validateTitle
// ---------------------------------------------------------------------------
describe('validateTitle', () => {
  test('returns null for null/undefined/empty', () => {
    expect(validateTitle(null)).toBeNull();
    expect(validateTitle(undefined)).toBeNull();
    expect(validateTitle('')).toBeNull();
    expect(validateTitle('   ')).toBeNull();
  });

  test('passes clean titles through', () => {
    expect(validateTitle('Dark Mode Support')).toBe('Dark Mode Support');
    expect(validateTitle('API Auth')).toBe('API Auth');
  });

  test('strips surrounding whitespace', () => {
    expect(validateTitle('  Dark Mode  ')).toBe('Dark Mode');
  });

  // --- Preamble stripping ---

  test('strips "Title: ..." preamble', () => {
    expect(validateTitle('Title: Dark Mode Support')).toBe('Dark Mode Support');
  });

  test('strips "Topic: ..." preamble', () => {
    expect(validateTitle('Topic: Auth Fix')).toBe('Auth Fix');
  });

  test('strips "Sure, here is: ..." preamble', () => {
    expect(validateTitle('Sure, the title is: Auth Fix')).toBe('Auth Fix');
  });

  test('strips "Here\'s the title: ..." preamble', () => {
    expect(validateTitle("Here's the title: Database Migration")).toBe('Database Migration');
  });

  test('strips "Here is the topic: ..."', () => {
    expect(validateTitle('Here is the topic: React Performance')).toBe('React Performance');
  });

  // --- Quote stripping ---

  test('strips surrounding double quotes', () => {
    expect(validateTitle('"Dark Mode Support"')).toBe('Dark Mode Support');
  });

  test('strips surrounding single quotes', () => {
    expect(validateTitle("'Dark Mode Support'")).toBe('Dark Mode Support');
  });

  test('does not strip mismatched quotes', () => {
    expect(validateTitle('"Dark Mode Support\'')).toBe('"Dark Mode Support\'');
  });

  // --- Markdown stripping ---

  test('strips single # heading', () => {
    expect(validateTitle('# Some Title')).toBe('Some Title');
  });

  test('strips ## heading', () => {
    expect(validateTitle('## Some Title')).toBe('Some Title');
  });

  test('strips ### heading', () => {
    expect(validateTitle('### Some Title')).toBe('Some Title');
  });

  test('strips **bold** wrapping', () => {
    expect(validateTitle('**Dark Mode Support**')).toBe('Dark Mode Support');
  });

  test('strips leading dash list marker', () => {
    expect(validateTitle('- Some Title')).toBe('Some Title');
  });

  // --- Length/word-count bounds ---

  test('rejects titles >= 100 chars', () => {
    expect(validateTitle('a'.repeat(100))).toBeNull();
  });

  test('accepts title of 99 chars', () => {
    expect(validateTitle('a'.repeat(99))).toBe('a'.repeat(99));
  });

  test('rejects titles with more than 10 words', () => {
    expect(validateTitle('one two three four five six seven eight nine ten eleven')).toBeNull();
  });

  test('accepts 10-word title', () => {
    const tenWords = 'one two three four five six seven eight nine ten';
    expect(validateTitle(tenWords)).toBe(tenWords);
  });

  // --- Combined preamble + quotes ---

  test('handles "Title: \\"Foo Bar\\"" combo', () => {
    expect(validateTitle('Title: "Foo Bar"')).toBe('Foo Bar');
  });
});

// ---------------------------------------------------------------------------
// buildTitlePrompt
// ---------------------------------------------------------------------------
describe('buildTitlePrompt', () => {
  test('includes user message snippet', () => {
    const prompt = buildTitlePrompt('Help me with dark mode');
    expect(prompt).toContain('Help me with dark mode');
  });

  test('includes auto-detect language instruction when no language given', () => {
    const prompt = buildTitlePrompt('hello');
    expect(prompt).toContain('Reply in the same language');
  });

  test('includes explicit language instruction when provided', () => {
    const prompt = buildTitlePrompt('hello', { language: 'Hungarian' });
    expect(prompt).toContain('Reply in Hungarian.');
    expect(prompt).not.toContain('same language');
  });

  test('truncates long messages', () => {
    const longMsg = 'word '.repeat(200); // ~1000 chars
    const prompt = buildTitlePrompt(longMsg);
    // The snippet should be roughly 500 chars, not the full message
    expect(prompt.length).toBeLessThan(longMsg.length);
  });
});

// ---------------------------------------------------------------------------
// buildRegenerateTitlePrompt
// ---------------------------------------------------------------------------
describe('buildRegenerateTitlePrompt', () => {
  test('includes section label for 1 message', () => {
    const prompt = buildRegenerateTitlePrompt(['msg1'], 'response');
    expect(prompt).toContain('User message:');
  });

  test('includes section label for 2 messages', () => {
    const prompt = buildRegenerateTitlePrompt(['msg1', 'msg2'], 'response');
    expect(prompt).toContain('User messages (first, last):');
  });

  test('includes section label for 3 messages', () => {
    const prompt = buildRegenerateTitlePrompt(['msg1', 'msg2', 'msg3'], 'response');
    expect(prompt).toContain('User messages (first, middle, last):');
  });

  test('includes language instruction when provided', () => {
    const prompt = buildRegenerateTitlePrompt(['msg'], 'resp', { language: 'German' });
    expect(prompt).toContain('Reply in German.');
  });

  test('includes assistant response snippet', () => {
    const prompt = buildRegenerateTitlePrompt(['msg'], 'I helped with auth');
    expect(prompt).toContain('I helped with auth');
  });
});
