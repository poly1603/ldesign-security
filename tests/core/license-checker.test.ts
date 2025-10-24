import { describe, it, expect, beforeEach } from 'vitest'
import { LicenseChecker } from '../../src/core/license-checker'
import path from 'path'

describe('LicenseChecker', () => {
  let checker: LicenseChecker
  const fixturesPath = path.join(__dirname, '../fixtures')

  beforeEach(() => {
    checker = new LicenseChecker(fixturesPath)
  })

  describe('check()', () => {
    it('should return license check result', async () => {
      const result = await checker.check()

      expect(result).toHaveProperty('compliant')
      expect(result).toHaveProperty('nonCompliant')
      expect(result).toHaveProperty('unknown')
      expect(result).toHaveProperty('conflicts')
      expect(result).toHaveProperty('summary')
      expect(Array.isArray(result.compliant)).toBe(true)
      expect(Array.isArray(result.nonCompliant)).toBe(true)
    })

    it('should have valid summary', async () => {
      const result = await checker.check()

      expect(result.summary.total).toBeGreaterThanOrEqual(0)
      expect(result.summary.compliant).toBeGreaterThanOrEqual(0)
      expect(result.summary.nonCompliant).toBeGreaterThanOrEqual(0)
    })
  })

  describe('generateReport()', () => {
    it('should generate text report', async () => {
      const report = await checker.generateReport('text')
      expect(typeof report).toBe('string')
      expect(report).toContain('License Compliance Report')
    })

    it('should generate json report', async () => {
      const report = await checker.generateReport('json')
      expect(() => JSON.parse(report)).not.toThrow()
    })

    it('should generate html report', async () => {
      const report = await checker.generateReport('html')
      expect(report).toContain('<!DOCTYPE html>')
      expect(report).toContain('License Compliance Report')
    })
  })
})

