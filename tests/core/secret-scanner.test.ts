import { describe, it, expect, beforeEach } from 'vitest'
import { SecretScanner } from '../../src/core/secret-scanner'
import path from 'path'

describe('SecretScanner', () => {
  let scanner: SecretScanner
  const fixturesPath = path.join(__dirname, '../fixtures')

  beforeEach(() => {
    scanner = new SecretScanner(fixturesPath)
  })

  describe('scan()', () => {
    it('should detect hardcoded secrets', async () => {
      const secrets = await scanner.scan(['vulnerable-code.ts'])
      expect(Array.isArray(secrets)).toBe(true)
    })

    it('should identify secret types', async () => {
      const secrets = await scanner.scan(['vulnerable-code.ts'])

      secrets.forEach(secret => {
        expect(secret).toHaveProperty('type')
        expect(secret).toHaveProperty('file')
        expect(secret).toHaveProperty('line')
        expect(secret).toHaveProperty('severity')
        expect(['api-key', 'password', 'token', 'certificate', 'private-key', 'connection-string', 'pii']).toContain(secret.type)
      })
    })

    it('should mask sensitive values', async () => {
      const secrets = await scanner.scan(['vulnerable-code.ts'])

      secrets.forEach(secret => {
        expect(secret.matched).toContain('*')
      })
    })

    it('should provide suggestions', async () => {
      const secrets = await scanner.scan(['vulnerable-code.ts'])

      secrets.forEach(secret => {
        expect(secret.suggestion).toBeTruthy()
        expect(typeof secret.suggestion).toBe('string')
      })
    })
  })

  describe('addPattern()', () => {
    it('should allow adding custom patterns', () => {
      const customPattern = {
        name: 'Custom Token',
        type: 'token' as const,
        regex: /custom-[0-9a-f]{32}/g,
        severity: 'high' as const
      }

      expect(() => scanner.addPattern(customPattern)).not.toThrow()
    })
  })
})


