import { describe, expect, it } from 'bun:test'
import { parseUrlDetails, runBrowserToolCli } from '../browser-tool'

describe('browser-tool parse-url', () => {
  it('parses https URL details', () => {
    const parsed = parseUrlDetails('https://www.example.com/path?q=1#hash')
    expect(parsed.protocol).toBe('https:')
    expect(parsed.hostname).toBe('www.example.com')
    expect(parsed.pathname).toBe('/path')
    expect(parsed.search).toBe('?q=1')
    expect(parsed.hash).toBe('#hash')
  })

  it('parses file URL details and basename', () => {
    const parsed = parseUrlDetails('file:///tmp/report.html')
    expect(parsed.protocol).toBe('file:')
    expect(parsed.pathname).toBe('/tmp/report.html')
    expect(parsed.basename).toBe('report.html')
  })

  it('returns non-zero for invalid parse-url input', () => {
    const logs: string[] = []
    const errors: string[] = []
    const io = {
      log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => errors.push(args.map(String).join(' ')),
    }

    const code = runBrowserToolCli(['bun', 'browser-tool', 'parse-url', 'not a url'], io)

    expect(code).toBe(1)
    expect(errors[0]).toContain('Error: invalid URL')
    expect(logs.length).toBe(0)
  })
})
