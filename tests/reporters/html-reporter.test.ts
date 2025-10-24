import { describe, it, expect } from 'vitest'
import { HTMLReporter } from '../../src/reporters/html-reporter'
import type { SecurityScanResult } from '../../src/types'

describe('HTMLReporter', () => {
  const mockResult: SecurityScanResult = {
    vulnerabilities: [
      {
        package: 'test-package',
        severity: 'high',
        title: 'Test Vulnerability',
        description: 'Test description',
        recommendation: 'Update to latest',
        url: 'https://example.com',
        cve: 'CVE-2021-1234',
        cvss: 7.5,
        source: 'npm',
        fixAvailable: true
      }
    ],
    codeIssues: [],
    dependencyIssues: [],
    riskLevel: 'high',
    duration: 1000,
    timestamp: new Date().toISOString(),
    summary: {
      totalIssues: 1,
      critical: 0,
      high: 1,
      medium: 0,
      low: 0
    }
  }

  describe('generate()', () => {
    it('should generate HTML report', async () => {
      const reporter = new HTMLReporter(mockResult)
      const html = await reporter.generate()

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('Security Scan Report')
      expect(html).toContain('test-package')
      expect(html).toContain('CVE-2021-1234')
    })

    it('should include risk level', async () => {
      const reporter = new HTMLReporter(mockResult)
      const html = await reporter.generate()

      expect(html).toContain('HIGH RISK')
    })

    it('should include summary statistics', async () => {
      const reporter = new HTMLReporter(mockResult)
      const html = await reporter.generate()

      expect(html).toContain('Total Issues')
      expect(html).toContain('1')
    })
  })

  describe('getFormat()', () => {
    it('should return html format', () => {
      const reporter = new HTMLReporter(mockResult)
      expect(reporter.getFormat()).toBe('html')
    })
  })
})

