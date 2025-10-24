import fs from 'fs-extra'
import { BaseReporter } from './base-reporter'
import type { SecurityScanResult } from '../types'

/**
 * Markdown 报告生成器
 */
export class MarkdownReporter extends BaseReporter {
  constructor(result: SecurityScanResult) {
    super(result)
  }

  /**
   * 生成 Markdown 报告
   */
  async generate(): Promise<string> {
    const riskScore = this.calculateRiskScore()

    let md = `# 🔒 Security Scan Report\n\n`
    md += `**Generated**: ${this.formatTimestamp(this.result.timestamp)}  \n`
    md += `**Duration**: ${this.formatDuration(this.result.duration)}  \n`
    md += `**Risk Level**: ${this.getRiskEmoji(this.result.riskLevel)} **${this.result.riskLevel.toUpperCase()}**  \n`
    md += `**Risk Score**: ${riskScore}/100\n\n`

    md += `---\n\n`

    // 摘要
    md += `## 📊 Summary\n\n`
    md += `| Metric | Count |\n`
    md += `|--------|-------|\n`
    md += `| Total Issues | ${this.result.summary.totalIssues} |\n`
    md += `| Critical | ${this.result.summary.critical} |\n`
    md += `| High | ${this.result.summary.high} |\n`
    md += `| Medium | ${this.result.summary.medium} |\n`
    md += `| Low | ${this.result.summary.low} |\n\n`

    // 漏洞
    if (this.result.vulnerabilities.length > 0) {
      md += `## 🚨 Vulnerabilities (${this.result.vulnerabilities.length})\n\n`
      md += `| Package | Severity | Title | CVE | Fix |\n`
      md += `|---------|----------|-------|-----|-----|\n`

      this.result.vulnerabilities.slice(0, 20).forEach(vuln => {
        md += `| \`${vuln.package}\` | ${this.getSeverityBadge(vuln.severity)} | ${vuln.title} | ${vuln.cve || '-'} | ${vuln.fixAvailable ? '✅' : '❌'} |\n`
      })

      if (this.result.vulnerabilities.length > 20) {
        md += `\n*... and ${this.result.vulnerabilities.length - 20} more vulnerabilities*\n`
      }
      md += `\n`
    }

    // 敏感信息
    if (this.result.secrets && this.result.secrets.length > 0) {
      md += `## 🔑 Exposed Secrets (${this.result.secrets.length})\n\n`

      this.result.secrets.slice(0, 10).forEach(secret => {
        md += `### ${secret.pattern}\n\n`
        md += `- **File**: \`${secret.file}:${secret.line}\`\n`
        md += `- **Type**: ${secret.type}\n`
        md += `- **Severity**: ${this.getSeverityBadge(secret.severity)}\n`
        md += `- **Suggestion**: ${secret.suggestion}\n\n`
      })

      if (this.result.secrets.length > 10) {
        md += `*... and ${this.result.secrets.length - 10} more secrets*\n\n`
      }
    }

    // 注入问题
    if (this.result.injectionIssues && this.result.injectionIssues.length > 0) {
      md += `## 💉 Injection Vulnerabilities (${this.result.injectionIssues.length})\n\n`

      this.result.injectionIssues.slice(0, 10).forEach(injection => {
        md += `### ${injection.type.toUpperCase()} Injection\n\n`
        md += `- **File**: \`${injection.file}:${injection.line}\`\n`
        md += `- **Severity**: ${this.getSeverityBadge(injection.severity)}\n`
        md += `- **Description**: ${injection.description}\n`
        md += `- **Code**: \`${injection.code}\`\n`
        md += `- **Suggestion**: ${injection.suggestion}\n\n`
      })

      if (this.result.injectionIssues.length > 10) {
        md += `*... and ${this.result.injectionIssues.length - 10} more injection issues*\n\n`
      }
    }

    // 代码问题
    if (this.result.codeIssues.length > 0) {
      md += `## ⚠️ Code Issues (${this.result.codeIssues.length})\n\n`
      md += `| File | Line | Severity | Message |\n`
      md += `|------|------|----------|----------|\n`

      this.result.codeIssues.slice(0, 15).forEach(issue => {
        md += `| \`${issue.file}\` | ${issue.line} | ${this.getSeverityBadge(issue.severity)} | ${issue.message} |\n`
      })

      if (this.result.codeIssues.length > 15) {
        md += `\n*... and ${this.result.codeIssues.length - 15} more code issues*\n`
      }
      md += `\n`
    }

    // 许可证问题
    if (this.result.licenseIssues && this.result.licenseIssues.length > 0) {
      const nonCompliant = this.result.licenseIssues.filter(l => !l.compatible)

      if (nonCompliant.length > 0) {
        md += `## 📄 License Issues (${nonCompliant.length})\n\n`
        md += `| Package | Version | License | Issue |\n`
        md += `|---------|---------|---------|-------|\n`

        nonCompliant.forEach(license => {
          md += `| \`${license.package}\` | ${license.version} | ${license.license} | ${license.issue || 'Non-compliant'} |\n`
        })
        md += `\n`
      }
    }

    // 供应链问题
    if (this.result.supplyChainIssues && this.result.supplyChainIssues.length > 0) {
      md += `## 🔗 Supply Chain Issues (${this.result.supplyChainIssues.length})\n\n`

      this.result.supplyChainIssues.forEach(issue => {
        md += `### ${issue.package}@${issue.version}\n\n`
        md += `- **Type**: ${issue.type}\n`
        md += `- **Severity**: ${this.getSeverityBadge(issue.severity)}\n`
        md += `- **Description**: ${issue.description}\n`
        md += `- **Recommendation**: ${issue.recommendation}\n\n`
      })
    }

    // 总结
    md += `---\n\n`
    md += `## 💡 Recommendations\n\n`

    if (this.result.summary.totalIssues === 0) {
      md += `✅ No security issues detected! Great job!\n\n`
    } else {
      md += `1. Run \`lsec fix\` to automatically fix vulnerabilities\n`
      md += `2. Review and fix exposed secrets immediately\n`
      md += `3. Address injection vulnerabilities in code\n`
      md += `4. Update dependencies with security issues\n\n`
    }

    md += `---\n\n`
    md += `*Report generated by @ldesign/security*\n`

    return md
  }

  /**
   * 获取严重程度徽章
   */
  private getSeverityBadge(severity: string): string {
    const badges: Record<string, string> = {
      critical: '![critical](https://img.shields.io/badge/-CRITICAL-red)',
      high: '![high](https://img.shields.io/badge/-HIGH-orange)',
      medium: '![medium](https://img.shields.io/badge/-MEDIUM-yellow)',
      low: '![low](https://img.shields.io/badge/-LOW-blue)'
    }
    return badges[severity] || severity
  }

  /**
   * 获取风险emoji
   */
  private getRiskEmoji(riskLevel: string): string {
    const emojis: Record<string, string> = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️',
      none: '✅'
    }
    return emojis[riskLevel] || '📊'
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
    return 'markdown'
  }
}


