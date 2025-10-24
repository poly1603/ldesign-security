import fs from 'fs-extra'
import { BaseReporter } from './base-reporter'
import type { SecurityScanResult } from '../types'

/**
 * PDF 报告生成器
 * 注意：需要安装 pdfkit 依赖
 */
export class PDFReporter extends BaseReporter {
  constructor(result: SecurityScanResult) {
    super(result)
  }

  /**
   * 生成 PDF 报告（返回字符串路径）
   */
  async generate(): Promise<string> {
    // PDF 生成需要 pdfkit 库
    // 这里返回一个提示信息
    const info = `PDF Report Generation
    
This feature requires the 'pdfkit' package to be installed.

Install it with:
  npm install pdfkit @types/pdfkit

Alternatively, use other report formats:
  - HTML: Full interactive report with charts
  - Markdown: GitHub-friendly format
  - JSON/YAML: Structured data
  - SARIF: GitHub Code Scanning compatible

For now, use HTML format for visual reports:
  lsec report --format html
    `

    return info
  }

  /**
   * 生成PDF内容（占位符）
   */
  private generateContent(doc: any): void {
    const riskScore = this.calculateRiskScore()

    // 封面
    this.addCoverPage(doc, riskScore)

    // 摘要页
    doc.addPage()
    this.addSummarySection(doc)

    // 漏洞详情
    if (this.result.vulnerabilities.length > 0) {
      doc.addPage()
      this.addVulnerabilitiesSection(doc)
    }

    // 敏感信息
    if (this.result.secrets && this.result.secrets.length > 0) {
      doc.addPage()
      this.addSecretsSection(doc)
    }

    // 注入问题
    if (this.result.injectionIssues && this.result.injectionIssues.length > 0) {
      doc.addPage()
      this.addInjectionsSection(doc)
    }

    // 代码问题
    if (this.result.codeIssues.length > 0) {
      doc.addPage()
      this.addCodeIssuesSection(doc)
    }

    // 建议
    doc.addPage()
    this.addRecommendationsSection(doc)
  }

  /**
   * 添加封面页
   */
  private addCoverPage(doc: any, riskScore: number): void {
    doc
      .fontSize(36)
      .fillColor('#2c3e50')
      .text('Security Scan Report', { align: 'center' })
      .moveDown(2)

    doc
      .fontSize(16)
      .fillColor('#7f8c8d')
      .text(this.formatTimestamp(this.result.timestamp), { align: 'center' })
      .moveDown(1)

    // 风险等级
    const riskColor = this.getRiskColor(this.result.riskLevel)
    doc
      .fontSize(48)
      .fillColor(riskColor)
      .text(this.result.riskLevel.toUpperCase(), { align: 'center' })
      .moveDown(1)

    doc
      .fontSize(24)
      .fillColor('#34495e')
      .text(`Risk Score: ${riskScore}/100`, { align: 'center' })
  }

  /**
   * 添加摘要部分
   */
  private addSummarySection(doc: any): void {
    doc
      .fontSize(24)
      .fillColor('#2c3e50')
      .text('Summary', { underline: true })
      .moveDown(1)

    doc
      .fontSize(12)
      .fillColor('#34495e')
      .text(`Total Issues: ${this.result.summary.totalIssues}`)
      .text(`Critical: ${this.result.summary.critical}`)
      .text(`High: ${this.result.summary.high}`)
      .text(`Medium: ${this.result.summary.medium}`)
      .text(`Low: ${this.result.summary.low}`)
      .moveDown(1)

    if (this.result.metadata) {
      doc
        .text(`Scanned Files: ${this.result.metadata.scannedFiles || 0}`)
        .text(`Scanned Packages: ${this.result.metadata.scannedPackages || 0}`)
    }
  }

  /**
   * 添加漏洞部分
   */
  private addVulnerabilitiesSection(doc: any): void {
    doc
      .fontSize(20)
      .fillColor('#e74c3c')
      .text(`🚨 Vulnerabilities (${this.result.vulnerabilities.length})`, { underline: true })
      .moveDown(0.5)

    this.result.vulnerabilities.slice(0, 15).forEach((vuln, index) => {
      doc
        .fontSize(12)
        .fillColor('#2c3e50')
        .text(`${index + 1}. ${vuln.package}`, { bold: true })
        .fontSize(10)
        .fillColor('#7f8c8d')
        .text(`   Severity: ${vuln.severity.toUpperCase()}`)
        .text(`   ${vuln.title}`)

      if (vuln.cve) {
        doc.text(`   CVE: ${vuln.cve}`)
      }

      doc.text(`   Fix: ${vuln.recommendation}`)
        .moveDown(0.5)
    })

    if (this.result.vulnerabilities.length > 15) {
      doc
        .fontSize(10)
        .fillColor('#95a5a6')
        .text(`... and ${this.result.vulnerabilities.length - 15} more vulnerabilities`)
    }
  }

  /**
   * 添加敏感信息部分
   */
  private addSecretsSection(doc: any): void {
    doc
      .fontSize(20)
      .fillColor('#e74c3c')
      .text(`🔑 Exposed Secrets (${this.result.secrets!.length})`, { underline: true })
      .moveDown(0.5)

    this.result.secrets!.slice(0, 10).forEach((secret, index) => {
      doc
        .fontSize(12)
        .fillColor('#2c3e50')
        .text(`${index + 1}. ${secret.pattern}`, { bold: true })
        .fontSize(10)
        .fillColor('#7f8c8d')
        .text(`   File: ${secret.file}:${secret.line}`)
        .text(`   Type: ${secret.type}`)
        .text(`   Severity: ${secret.severity.toUpperCase()}`)
        .moveDown(0.5)
    })
  }

  /**
   * 添加注入问题部分
   */
  private addInjectionsSection(doc: any): void {
    doc
      .fontSize(20)
      .fillColor('#e67e22')
      .text(`💉 Injection Vulnerabilities (${this.result.injectionIssues!.length})`, { underline: true })
      .moveDown(0.5)

    this.result.injectionIssues!.slice(0, 10).forEach((injection, index) => {
      doc
        .fontSize(12)
        .fillColor('#2c3e50')
        .text(`${index + 1}. ${injection.type.toUpperCase()} Injection`, { bold: true })
        .fontSize(10)
        .fillColor('#7f8c8d')
        .text(`   File: ${injection.file}:${injection.line}`)
        .text(`   ${injection.description}`)
        .moveDown(0.5)
    })
  }

  /**
   * 添加代码问题部分
   */
  private addCodeIssuesSection(doc: any): void {
    doc
      .fontSize(20)
      .fillColor('#f39c12')
      .text(`⚠️ Code Issues (${this.result.codeIssues.length})`, { underline: true })
      .moveDown(0.5)

    doc
      .fontSize(10)
      .fillColor('#7f8c8d')
      .text(`Showing first 10 issues. Run 'lsec report --format html' for full details.`)
      .moveDown(0.5)

    this.result.codeIssues.slice(0, 10).forEach((issue, index) => {
      doc
        .fontSize(10)
        .fillColor('#34495e')
        .text(`${index + 1}. ${issue.file}:${issue.line} - ${issue.message}`)
    })
  }

  /**
   * 添加建议部分
   */
  private addRecommendationsSection(doc: any): void {
    doc
      .fontSize(20)
      .fillColor('#27ae60')
      .text('💡 Recommendations', { underline: true })
      .moveDown(1)

    if (this.result.summary.totalIssues === 0) {
      doc
        .fontSize(14)
        .fillColor('#27ae60')
        .text('✅ No security issues detected! Your project is secure.')
    } else {
      doc
        .fontSize(12)
        .fillColor('#34495e')
        .text('1. Run `lsec fix` to automatically fix known vulnerabilities')
        .text('2. Remove or secure all exposed secrets immediately')
        .text('3. Fix injection vulnerabilities using parameterized queries')
        .text('4. Update dependencies to their latest secure versions')
        .text('5. Review and address license compliance issues')
    }

    // 页脚
    doc
      .moveDown(3)
      .fontSize(8)
      .fillColor('#95a5a6')
      .text('Generated by @ldesign/security', { align: 'center' })
  }

  /**
   * 获取风险颜色
   */
  private getRiskColor(riskLevel: string): string {
    const colors: Record<string, string> = {
      critical: '#e74c3c',
      high: '#e67e22',
      medium: '#f39c12',
      low: '#3498db',
      none: '#27ae60'
    }
    return colors[riskLevel] || '#95a5a6'
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
    return 'pdf'
  }
}


