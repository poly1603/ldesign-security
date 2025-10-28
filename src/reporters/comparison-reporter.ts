import { writeFile } from 'fs/promises'
import type { SecurityScanResult, Severity } from '../types'
import { BaseReporter } from './base-reporter'

/**
 * 对比类型
 */
export type ComparisonType = 'version' | 'branch' | 'before-after' | 'timeline'

/**
 * 对比结果
 */
export interface ComparisonResult {
  type: ComparisonType
  baseline: ComparisonSnapshot
  current: ComparisonSnapshot
  changes: ComparisonChanges
  summary: ComparisonSummary
  timestamp: string
}

/**
 * 对比快照
 */
export interface ComparisonSnapshot {
  label: string
  date: string
  result: SecurityScanResult
  metadata?: {
    version?: string
    branch?: string
    commit?: string
    tag?: string
  }
}

/**
 * 对比变化
 */
export interface ComparisonChanges {
  vulnerabilities: {
    added: number
    removed: number
    unchanged: number
    details: ChangeDetail[]
  }
  codeIssues: {
    added: number
    removed: number
    unchanged: number
    details: ChangeDetail[]
  }
  secrets: {
    added: number
    removed: number
    unchanged: number
  }
  riskLevel: {
    from: string
    to: string
    changed: boolean
  }
  totalIssues: {
    from: number
    to: number
    delta: number
    percentage: number
  }
}

/**
 * 变化详情
 */
export interface ChangeDetail {
  type: 'added' | 'removed' | 'unchanged'
  severity: Severity
  package?: string
  file?: string
  line?: number
  message: string
}

/**
 * 对比摘要
 */
export interface ComparisonSummary {
  improved: boolean
  totalChanges: number
  criticalChanges: number
  trend: 'improving' | 'degrading' | 'stable'
  recommendations: string[]
}

/**
 * 对比报告生成器配置
 */
export interface ComparisonReporterOptions {
  format?: 'html' | 'json' | 'markdown' | 'text'
  includeUnchanged?: boolean
  highlightCritical?: boolean
}

/**
 * 对比报告生成器
 * 支持版本对比、分支对比、修复前后对比等场景
 * 
 * @example
 * ```typescript
 * const reporter = new ComparisonReporter({
 *   format: 'html',
 *   includeUnchanged: false,
 *   highlightCritical: true
 * })
 * 
 * const comparison = reporter.compare(baselineResult, currentResult, 'version')
 * await reporter.saveComparison(comparison, './comparison-report.html')
 * 
 * // 趋势分析
 * const trend = reporter.analyzeTrend([result1, result2, result3])
 * ```
 */
export class ComparisonReporter extends BaseReporter {
  private options: Required<ComparisonReporterOptions>

  constructor(options: ComparisonReporterOptions = {}) {
    super({} as any) // BaseReporter 需要 result，这里用空对象
    this.options = {
      format: options.format || 'html',
      includeUnchanged: options.includeUnchanged ?? false,
      highlightCritical: options.highlightCritical ?? true
    }
  }

  /**
   * 对比两个扫描结果
   */
  compare(
    baseline: SecurityScanResult,
    current: SecurityScanResult,
    type: ComparisonType = 'before-after',
    metadata?: { baseline?: any; current?: any }
  ): ComparisonResult {
    const changes = this.calculateChanges(baseline, current)
    const summary = this.generateSummary(changes)

    return {
      type,
      baseline: {
        label: type === 'version' ? 'Previous Version' : 'Baseline',
        date: baseline.timestamp,
        result: baseline,
        metadata: metadata?.baseline
      },
      current: {
        label: type === 'version' ? 'Current Version' : 'Current',
        date: current.timestamp,
        result: current,
        metadata: metadata?.current
      },
      changes,
      summary,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 对比多个版本的趋势
   */
  analyzeTrend(results: SecurityScanResult[]): {
    trend: 'improving' | 'degrading' | 'stable'
    dataPoints: Array<{ date: string; totalIssues: number; riskLevel: string }>
    averageChange: number
    recommendations: string[]
  } {
    if (results.length < 2) {
      throw new Error('至少需要 2 个扫描结果进行趋势分析')
    }

    const dataPoints = results.map(r => ({
      date: r.timestamp,
      totalIssues: r.summary.totalIssues,
      riskLevel: r.riskLevel
    }))

    // 计算平均变化率
    const changes = []
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1].summary.totalIssues
      const curr = results[i].summary.totalIssues
      const change = ((curr - prev) / prev) * 100
      changes.push(change)
    }

    const averageChange = changes.reduce((a, b) => a + b, 0) / changes.length

    let trend: 'improving' | 'degrading' | 'stable'
    if (averageChange < -5) {
      trend = 'improving'
    } else if (averageChange > 5) {
      trend = 'degrading'
    } else {
      trend = 'stable'
    }

    const recommendations = this.generateTrendRecommendations(trend, dataPoints)

    return {
      trend,
      dataPoints,
      averageChange,
      recommendations
    }
  }

  /**
   * 保存对比报告
   */
  async saveComparison(comparison: ComparisonResult, outputPath: string): Promise<void> {
    let content: string

    switch (this.options.format) {
      case 'html':
        content = this.generateHTMLReport(comparison)
        break
      case 'json':
        content = JSON.stringify(comparison, null, 2)
        break
      case 'markdown':
        content = this.generateMarkdownReport(comparison)
        break
      case 'text':
        content = this.generateTextReport(comparison)
        break
      default:
        throw new Error(`不支持的格式: ${this.options.format}`)
    }

    await writeFile(outputPath, content, 'utf-8')
  }

  /**
   * 计算变化
   */
  private calculateChanges(
    baseline: SecurityScanResult,
    current: SecurityScanResult
  ): ComparisonChanges {
    // 漏洞变化
    const vulnerabilityChanges = this.compareArray(
      baseline.vulnerabilities,
      current.vulnerabilities,
      (v) => `${v.package}:${v.title}`
    )

    // 代码问题变化
    const codeIssueChanges = this.compareArray(
      baseline.codeIssues,
      current.codeIssues,
      (c) => `${c.file}:${c.line}:${c.ruleId}`
    )

    // 敏感信息变化
    const secretChanges = this.compareArray(
      baseline.secrets || [],
      current.secrets || [],
      (s) => `${s.file}:${s.line}:${s.type}`
    )

    // 风险等级变化
    const riskLevelChanged = baseline.riskLevel !== current.riskLevel

    // 总问题数变化
    const baselineTotal = baseline.summary.totalIssues
    const currentTotal = current.summary.totalIssues
    const delta = currentTotal - baselineTotal
    const percentage = baselineTotal > 0 ? (delta / baselineTotal) * 100 : 0

    return {
      vulnerabilities: {
        added: vulnerabilityChanges.added.length,
        removed: vulnerabilityChanges.removed.length,
        unchanged: vulnerabilityChanges.unchanged.length,
        details: [
          ...vulnerabilityChanges.added.map(v => ({
            type: 'added' as const,
            severity: v.severity,
            package: v.package,
            message: v.title
          })),
          ...vulnerabilityChanges.removed.map(v => ({
            type: 'removed' as const,
            severity: v.severity,
            package: v.package,
            message: v.title
          }))
        ]
      },
      codeIssues: {
        added: codeIssueChanges.added.length,
        removed: codeIssueChanges.removed.length,
        unchanged: codeIssueChanges.unchanged.length,
        details: [
          ...codeIssueChanges.added.map(c => ({
            type: 'added' as const,
            severity: c.severity,
            file: c.file,
            line: c.line,
            message: c.message
          })),
          ...codeIssueChanges.removed.map(c => ({
            type: 'removed' as const,
            severity: c.severity,
            file: c.file,
            line: c.line,
            message: c.message
          }))
        ]
      },
      secrets: {
        added: secretChanges.added.length,
        removed: secretChanges.removed.length,
        unchanged: secretChanges.unchanged.length
      },
      riskLevel: {
        from: baseline.riskLevel,
        to: current.riskLevel,
        changed: riskLevelChanged
      },
      totalIssues: {
        from: baselineTotal,
        to: currentTotal,
        delta,
        percentage
      }
    }
  }

  /**
   * 对比数组
   */
  private compareArray<T>(
    baseline: T[],
    current: T[],
    keyFn: (item: T) => string
  ): { added: T[]; removed: T[]; unchanged: T[] } {
    const baselineKeys = new Set(baseline.map(keyFn))
    const currentKeys = new Set(current.map(keyFn))

    const added = current.filter(item => !baselineKeys.has(keyFn(item)))
    const removed = baseline.filter(item => !currentKeys.has(keyFn(item)))
    const unchanged = current.filter(item => baselineKeys.has(keyFn(item)))

    return { added, removed, unchanged }
  }

  /**
   * 生成摘要
   */
  private generateSummary(changes: ComparisonChanges): ComparisonSummary {
    const totalChanges = 
      changes.vulnerabilities.added + changes.vulnerabilities.removed +
      changes.codeIssues.added + changes.codeIssues.removed +
      changes.secrets.added + changes.secrets.removed

    const criticalChanges = changes.vulnerabilities.details
      .filter(d => d.severity === 'critical')
      .length + changes.codeIssues.details
      .filter(d => d.severity === 'critical')
      .length

    const improved = changes.totalIssues.delta < 0
    const trend = this.determineTrend(changes)
    const recommendations = this.generateRecommendations(changes)

    return {
      improved,
      totalChanges,
      criticalChanges,
      trend,
      recommendations
    }
  }

  /**
   * 确定趋势
   */
  private determineTrend(changes: ComparisonChanges): 'improving' | 'degrading' | 'stable' {
    const delta = changes.totalIssues.delta
    const percentage = Math.abs(changes.totalIssues.percentage)

    if (delta < 0 && percentage > 10) {
      return 'improving'
    } else if (delta > 0 && percentage > 10) {
      return 'degrading'
    }
    return 'stable'
  }

  /**
   * 生成建议
   */
  private generateRecommendations(changes: ComparisonChanges): string[] {
    const recommendations: string[] = []

    if (changes.vulnerabilities.added > 0) {
      recommendations.push(`发现 ${changes.vulnerabilities.added} 个新漏洞，建议立即修复`)
    }

    if (changes.riskLevel.changed) {
      if (changes.riskLevel.to > changes.riskLevel.from) {
        recommendations.push(`风险等级从 ${changes.riskLevel.from} 上升到 ${changes.riskLevel.to}，需要重点关注`)
      } else {
        recommendations.push(`风险等级从 ${changes.riskLevel.from} 下降到 ${changes.riskLevel.to}，安全态势改善`)
      }
    }

    if (changes.secrets.added > 0) {
      recommendations.push(`发现 ${changes.secrets.added} 个新的敏感信息泄露，请及时处理`)
    }

    if (changes.totalIssues.delta > 0) {
      recommendations.push(`总问题数增加了 ${changes.totalIssues.delta} 个（${changes.totalIssues.percentage.toFixed(1)}%）`)
    } else if (changes.totalIssues.delta < 0) {
      recommendations.push(`总问题数减少了 ${Math.abs(changes.totalIssues.delta)} 个（${Math.abs(changes.totalIssues.percentage).toFixed(1)}%），继续保持`)
    }

    if (recommendations.length === 0) {
      recommendations.push('安全状态保持稳定')
    }

    return recommendations
  }

  /**
   * 生成趋势建议
   */
  private generateTrendRecommendations(
    trend: 'improving' | 'degrading' | 'stable',
    dataPoints: Array<{ date: string; totalIssues: number; riskLevel: string }>
  ): string[] {
    const recommendations: string[] = []

    if (trend === 'degrading') {
      recommendations.push('⚠️ 安全态势持续恶化，需要立即采取行动')
      recommendations.push('建议加强代码审查和安全测试')
      recommendations.push('考虑引入自动化安全扫描到 CI/CD 流程')
    } else if (trend === 'improving') {
      recommendations.push('✅ 安全态势持续改善，继续保持')
      recommendations.push('可以分享最佳实践给团队其他成员')
    } else {
      recommendations.push('📊 安全状态稳定')
      recommendations.push('建议定期扫描以保持安全态势')
    }

    // 检查最近的变化
    if (dataPoints.length >= 2) {
      const latest = dataPoints[dataPoints.length - 1]
      const previous = dataPoints[dataPoints.length - 2]
      
      if (latest.totalIssues > previous.totalIssues * 1.5) {
        recommendations.push('⚠️ 最近一次扫描发现问题数量激增，请立即排查')
      }
    }

    return recommendations
  }

  /**
   * 生成 HTML 报告
   */
  private generateHTMLReport(comparison: ComparisonResult): string {
    const { baseline, current, changes, summary } = comparison

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>安全扫描对比报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-top: 0; }
    h2 { color: #555; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f9f9f9; padding: 20px; border-radius: 6px; text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; margin: 10px 0; }
    .stat-label { color: #666; font-size: 0.9em; }
    .improved { color: #22c55e; }
    .degraded { color: #ef4444; }
    .stable { color: #6b7280; }
    .change-list { list-style: none; padding: 0; }
    .change-item { padding: 10px; margin: 5px 0; border-radius: 4px; }
    .added { background: #fef3c7; border-left: 4px solid #f59e0b; }
    .removed { background: #dbeafe; border-left: 4px solid #3b82f6; }
    .critical { color: #dc2626; font-weight: bold; }
    .high { color: #ea580c; }
    .recommendations { background: #eff6ff; padding: 20px; border-radius: 6px; border-left: 4px solid #3b82f6; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔒 安全扫描对比报告</h1>
    <p><strong>对比类型:</strong> ${comparison.type}</p>
    <p><strong>生成时间:</strong> ${new Date(comparison.timestamp).toLocaleString('zh-CN')}</p>

    <h2>📊 总体变化</h2>
    <div class="summary">
      <div class="stat-card">
        <div class="stat-label">总问题数</div>
        <div class="stat-value ${changes.totalIssues.delta < 0 ? 'improved' : changes.totalIssues.delta > 0 ? 'degraded' : 'stable'}">
          ${changes.totalIssues.from} → ${changes.totalIssues.to}
        </div>
        <div>${changes.totalIssues.delta > 0 ? '+' : ''}${changes.totalIssues.delta} (${changes.totalIssues.percentage.toFixed(1)}%)</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">风险等级</div>
        <div class="stat-value ${changes.riskLevel.changed ? (changes.riskLevel.to > changes.riskLevel.from ? 'degraded' : 'improved') : 'stable'}">
          ${changes.riskLevel.from} → ${changes.riskLevel.to}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">趋势</div>
        <div class="stat-value ${summary.trend === 'improving' ? 'improved' : summary.trend === 'degrading' ? 'degraded' : 'stable'}">
          ${summary.trend === 'improving' ? '📈 改善' : summary.trend === 'degrading' ? '📉 恶化' : '➡️ 稳定'}
        </div>
      </div>
    </div>

    <h2>🐛 漏洞变化</h2>
    <p>新增: <span class="degraded">${changes.vulnerabilities.added}</span> | 
       修复: <span class="improved">${changes.vulnerabilities.removed}</span> | 
       未变: ${changes.vulnerabilities.unchanged}</p>
    ${this.renderChangeDetails(changes.vulnerabilities.details)}

    <h2>⚠️ 代码问题变化</h2>
    <p>新增: <span class="degraded">${changes.codeIssues.added}</span> | 
       修复: <span class="improved">${changes.codeIssues.removed}</span> | 
       未变: ${changes.codeIssues.unchanged}</p>
    ${this.renderChangeDetails(changes.codeIssues.details)}

    <h2>💡 建议</h2>
    <div class="recommendations">
      <ul>
        ${summary.recommendations.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
  </div>
</body>
</html>`
  }

  /**
   * 渲染变化详情
   */
  private renderChangeDetails(details: ChangeDetail[]): string {
    if (details.length === 0) {
      return '<p>无变化</p>'
    }

    const items = details
      .slice(0, 20) // 只显示前 20 个
      .map(d => `
        <li class="change-item ${d.type}">
          <span class="${d.severity}">[${d.severity.toUpperCase()}]</span>
          ${d.type === 'added' ? '➕' : '➖'}
          ${d.package || d.file || ''} - ${d.message}
        </li>
      `).join('')

    const remaining = details.length - 20
    const moreText = remaining > 0 ? `<p>还有 ${remaining} 个变化未显示...</p>` : ''

    return `<ul class="change-list">${items}</ul>${moreText}`
  }

  /**
   * 生成 Markdown 报告
   */
  private generateMarkdownReport(comparison: ComparisonResult): string {
    const { changes, summary } = comparison

    return `# 🔒 安全扫描对比报告

**对比类型**: ${comparison.type}  
**生成时间**: ${new Date(comparison.timestamp).toLocaleString('zh-CN')}

## 📊 总体变化

| 指标 | 基线 | 当前 | 变化 |
|------|------|------|------|
| 总问题数 | ${changes.totalIssues.from} | ${changes.totalIssues.to} | ${changes.totalIssues.delta > 0 ? '+' : ''}${changes.totalIssues.delta} (${changes.totalIssues.percentage.toFixed(1)}%) |
| 风险等级 | ${changes.riskLevel.from} | ${changes.riskLevel.to} | ${changes.riskLevel.changed ? '变化' : '不变'} |
| 趋势 | - | ${summary.trend} | ${summary.improved ? '✅ 改善' : '⚠️'} |

## 🐛 漏洞变化

- **新增**: ${changes.vulnerabilities.added}
- **修复**: ${changes.vulnerabilities.removed}
- **未变**: ${changes.vulnerabilities.unchanged}

## ⚠️ 代码问题变化

- **新增**: ${changes.codeIssues.added}
- **修复**: ${changes.codeIssues.removed}
- **未变**: ${changes.codeIssues.unchanged}

## 🔑 敏感信息变化

- **新增**: ${changes.secrets.added}
- **修复**: ${changes.secrets.removed}
- **未变**: ${changes.secrets.unchanged}

## 💡 建议

${summary.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`
  }

  /**
   * 生成文本报告
   */
  private generateTextReport(comparison: ComparisonResult): string {
    const { changes, summary } = comparison

    return `
安全扫描对比报告
================
对比类型: ${comparison.type}
生成时间: ${new Date(comparison.timestamp).toLocaleString('zh-CN')}

总体变化
--------
总问题数: ${changes.totalIssues.from} → ${changes.totalIssues.to} (${changes.totalIssues.delta > 0 ? '+' : ''}${changes.totalIssues.delta})
风险等级: ${changes.riskLevel.from} → ${changes.riskLevel.to}
趋势: ${summary.trend}

详细变化
--------
漏洞: 新增 ${changes.vulnerabilities.added}, 修复 ${changes.vulnerabilities.removed}
代码问题: 新增 ${changes.codeIssues.added}, 修复 ${changes.codeIssues.removed}
敏感信息: 新增 ${changes.secrets.added}, 修复 ${changes.secrets.removed}

建议
----
${summary.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`
  }
}
