import fs from 'fs-extra'
import { BaseReporter } from './base-reporter'
import type { SecurityScanResult } from '../types'

/**
 * Excel 报告生成器（简化版本）
 * 完整版本应使用 exceljs 库
 */
export class ExcelReporter extends BaseReporter {
  constructor(result: SecurityScanResult) {
    super(result)
  }

  /**
   * 生成 Excel 报告（CSV 格式作为简化实现）
   */
  async generate(): Promise<string> {
    let csv = ''

    // 摘要工作表
    csv += '=== Summary ===\n'
    csv += 'Metric,Value\n'
    csv += `Total Issues,${this.result.summary.totalIssues}\n`
    csv += `Risk Level,${this.result.riskLevel}\n`
    csv += `Critical,${this.result.summary.critical}\n`
    csv += `High,${this.result.summary.high}\n`
    csv += `Medium,${this.result.summary.medium}\n`
    csv += `Low,${this.result.summary.low}\n`
    csv += `Scan Duration,${this.result.duration}ms\n`
    csv += `Timestamp,${this.result.timestamp}\n\n`

    // 漏洞工作表
    if (this.result.vulnerabilities.length > 0) {
      csv += '=== Vulnerabilities ===\n'
      csv += 'Package,Severity,Title,CVE,Source,Fix Available\n'

      this.result.vulnerabilities.forEach(vuln => {
        csv += `"${vuln.package}",${vuln.severity},"${this.escapeCsv(vuln.title)}",${vuln.cve || ''},${vuln.source || 'npm'},${vuln.fixAvailable ? 'Yes' : 'No'}\n`
      })
      csv += '\n'
    }

    // 代码问题工作表
    if (this.result.codeIssues.length > 0) {
      csv += '=== Code Issues ===\n'
      csv += 'File,Line,Column,Severity,Rule,Message\n'

      this.result.codeIssues.forEach(issue => {
        csv += `"${issue.file}",${issue.line},${issue.column},${issue.severity},${issue.ruleId},"${this.escapeCsv(issue.message)}"\n`
      })
      csv += '\n'
    }

    // 敏感信息工作表
    if (this.result.secrets && this.result.secrets.length > 0) {
      csv += '=== Exposed Secrets ===\n'
      csv += 'File,Line,Type,Pattern,Severity,Suggestion\n'

      this.result.secrets.forEach(secret => {
        csv += `"${secret.file}",${secret.line},${secret.type},${secret.pattern},${secret.severity},"${this.escapeCsv(secret.suggestion)}"\n`
      })
      csv += '\n'
    }

    // 注入问题工作表
    if (this.result.injectionIssues && this.result.injectionIssues.length > 0) {
      csv += '=== Injection Issues ===\n'
      csv += 'File,Line,Type,Severity,Description,Suggestion\n'

      this.result.injectionIssues.forEach(injection => {
        csv += `"${injection.file}",${injection.line},${injection.type},${injection.severity},"${this.escapeCsv(injection.description)}","${this.escapeCsv(injection.suggestion)}"\n`
      })
      csv += '\n'
    }

    return csv
  }

  /**
   * 转义 CSV 值
   */
  private escapeCsv(value: string): string {
    return value.replace(/"/g, '""')
  }

  /**
   * 保存到文件
   */
  async save(outputPath: string): Promise<void> {
    const content = await this.generate()
    // 使用 .csv 扩展名
    const csvPath = outputPath.replace(/\.xlsx?$/i, '.csv')
    await fs.writeFile(csvPath, content, 'utf-8')
  }

  /**
   * 获取格式
   */
  getFormat(): string {
    return 'excel'
  }
}


