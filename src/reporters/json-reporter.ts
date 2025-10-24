import fs from 'fs-extra'
import { BaseReporter } from './base-reporter'
import type { SecurityScanResult } from '../types'

/**
 * JSON 报告生成器
 */
export class JSONReporter extends BaseReporter {
  constructor(result: SecurityScanResult) {
    super(result)
  }

  /**
   * 生成 JSON 报告
   */
  async generate(): Promise<string> {
    const report = {
      $schema: 'https://ldesign.io/schemas/security-report.json',
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      scan: {
        timestamp: this.result.timestamp,
        duration: this.result.duration,
        projectDir: this.result.metadata?.projectDir || 'unknown'
      },
      summary: {
        totalIssues: this.result.summary.totalIssues,
        riskLevel: this.result.riskLevel,
        riskScore: this.calculateRiskScore(),
        riskDescription: this.getRiskDescription(),
        severityBreakdown: {
          critical: this.result.summary.critical,
          high: this.result.summary.high,
          medium: this.result.summary.medium,
          low: this.result.summary.low
        },
        issuesByType: {
          vulnerabilities: this.result.vulnerabilities.length,
          codeIssues: this.result.codeIssues.length,
          dependencyIssues: this.result.dependencyIssues.length,
          licenseIssues: this.result.licenseIssues?.length || 0,
          secrets: this.result.secrets?.length || 0,
          injectionIssues: this.result.injectionIssues?.length || 0,
          supplyChainIssues: this.result.supplyChainIssues?.length || 0
        }
      },
      vulnerabilities: this.result.vulnerabilities.map(vuln => ({
        package: vuln.package,
        severity: vuln.severity,
        title: vuln.title,
        description: vuln.description,
        recommendation: vuln.recommendation,
        url: vuln.url,
        cve: vuln.cve,
        cvss: vuln.cvss,
        source: vuln.source,
        fixAvailable: vuln.fixAvailable,
        fixVersion: vuln.fixVersion
      })),
      codeIssues: this.result.codeIssues.map(issue => ({
        file: issue.file,
        line: issue.line,
        column: issue.column,
        severity: issue.severity,
        message: issue.message,
        ruleId: issue.ruleId,
        type: issue.type,
        suggestion: issue.suggestion
      })),
      dependencyIssues: this.result.dependencyIssues.map(issue => ({
        package: issue.package,
        version: issue.version,
        severity: issue.severity,
        issue: issue.issue,
        recommendation: issue.recommendation,
        type: issue.type
      })),
      licenseIssues: this.result.licenseIssues?.map(license => ({
        package: license.package,
        version: license.version,
        license: license.license,
        licenseType: license.licenseType,
        compatible: license.compatible,
        issue: license.issue,
        url: license.url
      })) || [],
      secrets: this.result.secrets?.map(secret => ({
        file: secret.file,
        line: secret.line,
        column: secret.column,
        type: secret.type,
        pattern: secret.pattern,
        severity: secret.severity,
        suggestion: secret.suggestion
      })) || [],
      injectionIssues: this.result.injectionIssues?.map(injection => ({
        file: injection.file,
        line: injection.line,
        column: injection.column,
        type: injection.type,
        severity: injection.severity,
        description: injection.description,
        suggestion: injection.suggestion,
        code: injection.code
      })) || [],
      supplyChainIssues: this.result.supplyChainIssues?.map(issue => ({
        package: issue.package,
        version: issue.version,
        type: issue.type,
        severity: issue.severity,
        description: issue.description,
        evidence: issue.evidence,
        recommendation: issue.recommendation,
        score: issue.score
      })) || [],
      metadata: {
        projectDir: this.result.metadata?.projectDir,
        scannedFiles: this.result.metadata?.scannedFiles,
        scannedPackages: this.result.metadata?.scannedPackages
      }
    }

    return JSON.stringify(report, null, 2)
  }

  /**
   * 保存到文件
   */
  async save(outputPath: string): Promise<void> {
    const content = await this.generate()
    await fs.writeFile(outputPath, content, 'utf-8')
  }

  /**
   * 获取格式
   */
  getFormat(): string {
    return 'json'
  }
}

/**
 * YAML 报告生成器
 */
export class YAMLReporter extends BaseReporter {
  constructor(result: SecurityScanResult) {
    super(result)
  }

  /**
   * 生成 YAML 报告
   */
  async generate(): Promise<string> {
    // 先生成 JSON，然后转换为 YAML
    const jsonReporter = new JSONReporter(this.result)
    const jsonContent = await jsonReporter.generate()
    const data = JSON.parse(jsonContent)

    return this.convertToYAML(data)
  }

  /**
   * 转换为 YAML 格式
   */
  private convertToYAML(obj: any, indent = 0): string {
    const spaces = '  '.repeat(indent)
    let yaml = ''

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        yaml += `${spaces}${key}: null\n`
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`
        if (value.length === 0) {
          yaml += `${spaces}  []\n`
        } else {
          for (const item of value) {
            if (typeof item === 'object') {
              yaml += `${spaces}  -\n`
              yaml += this.convertToYAML(item, indent + 2).split('\n')
                .filter(line => line.trim())
                .map(line => `${spaces}  ${line}`)
                .join('\n') + '\n'
            } else {
              yaml += `${spaces}  - ${this.formatValue(item)}\n`
            }
          }
        }
      } else if (typeof value === 'object') {
        yaml += `${spaces}${key}:\n`
        yaml += this.convertToYAML(value, indent + 1)
      } else {
        yaml += `${spaces}${key}: ${this.formatValue(value)}\n`
      }
    }

    return yaml
  }

  /**
   * 格式化值
   */
  private formatValue(value: any): string {
    if (typeof value === 'string') {
      // 如果包含特殊字符，使用引号
      if (value.includes(':') || value.includes('\n') || value.includes('#')) {
        return `"${value.replace(/"/g, '\\"')}"`
      }
      return value
    }
    return String(value)
  }

  /**
   * 保存到文件
   */
  async save(outputPath: string): Promise<void> {
    const content = await this.generate()
    await fs.writeFile(outputPath, content, 'utf-8')
  }

  /**
   * 获取格式
   */
  getFormat(): string {
    return 'yaml'
  }
}


