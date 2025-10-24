import fs from 'fs-extra'
import path from 'path'
import type { SecurityScanResult, MetricsData } from '../types'

/**
 * 扫描历史管理器（基于文件的简化版本）
 * 完整版本应使用 SQLite（better-sqlite3）
 */
export class ScanHistory {
  private historyDir: string

  constructor(private projectDir: string = process.cwd()) {
    this.historyDir = path.join(projectDir, '.security-history')
  }

  /**
   * 保存扫描结果
   */
  async save(result: SecurityScanResult): Promise<void> {
    await fs.ensureDir(this.historyDir)

    const timestamp = new Date(result.timestamp).getTime()
    const filename = `scan-${timestamp}.json`
    const filePath = path.join(this.historyDir, filename)

    await fs.writeJSON(filePath, result, { spaces: 2 })
  }

  /**
   * 查询历史记录
   */
  async query(options: {
    limit?: number
    since?: Date
    until?: Date
  } = {}): Promise<SecurityScanResult[]> {
    const results: SecurityScanResult[] = []

    try {
      if (!await fs.pathExists(this.historyDir)) {
        return []
      }

      const files = await fs.readdir(this.historyDir)
      const scanFiles = files
        .filter(f => f.startsWith('scan-') && f.endsWith('.json'))
        .sort()
        .reverse() // 最新的在前

      const limit = options.limit || 10

      for (const file of scanFiles.slice(0, limit)) {
        const filePath = path.join(this.historyDir, file)
        const result = await fs.readJSON(filePath)

        // 时间过滤
        const scanTime = new Date(result.timestamp).getTime()
        if (options.since && scanTime < options.since.getTime()) continue
        if (options.until && scanTime > options.until.getTime()) continue

        results.push(result)
      }

      return results
    } catch (error) {
      return []
    }
  }

  /**
   * 获取最新的扫描结果
   */
  async getLatest(): Promise<SecurityScanResult | null> {
    const results = await this.query({ limit: 1 })
    return results[0] || null
  }

  /**
   * 分析趋势
   */
  async analyzeTrend(days: number = 30): Promise<{
    trend: 'improving' | 'stable' | 'worsening'
    data: MetricsData[]
    summary: {
      avgIssues: number
      maxIssues: number
      minIssues: number
      changeRate: number
    }
  }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const history = await this.query({ since })

    if (history.length === 0) {
      return {
        trend: 'stable',
        data: [],
        summary: {
          avgIssues: 0,
          maxIssues: 0,
          minIssues: 0,
          changeRate: 0
        }
      }
    }

    // 转换为指标数据
    const data: MetricsData[] = history.map(result => ({
      timestamp: result.timestamp,
      scanDuration: result.duration,
      totalIssues: result.summary.totalIssues,
      severityBreakdown: {
        critical: result.summary.critical,
        high: result.summary.high,
        medium: result.summary.medium,
        low: result.summary.low
      },
      vulnerabilityCount: result.vulnerabilities.length,
      codeIssueCount: result.codeIssues.length,
      dependencyIssueCount: result.dependencyIssues.length,
      licenseIssueCount: result.licenseIssues?.length || 0,
      secretCount: result.secrets?.length || 0,
      injectionCount: result.injectionIssues?.length || 0,
      riskLevel: result.riskLevel
    }))

    // 计算统计
    const issueCounts = data.map(d => d.totalIssues)
    const avgIssues = issueCounts.reduce((a, b) => a + b, 0) / issueCounts.length
    const maxIssues = Math.max(...issueCounts)
    const minIssues = Math.min(...issueCounts)

    // 计算变化率（最新 vs 最早）
    const changeRate = issueCounts.length > 1
      ? ((issueCounts[0] - issueCounts[issueCounts.length - 1]) / issueCounts[issueCounts.length - 1]) * 100
      : 0

    // 判断趋势
    let trend: 'improving' | 'stable' | 'worsening' = 'stable'
    if (changeRate < -10) {
      trend = 'worsening' // 问题增加
    } else if (changeRate > 10) {
      trend = 'improving' // 问题减少
    }

    return {
      trend,
      data,
      summary: {
        avgIssues: Math.round(avgIssues),
        maxIssues,
        minIssues,
        changeRate: Math.round(changeRate * 100) / 100
      }
    }
  }

  /**
   * 清理旧记录
   */
  async cleanup(olderThan: Date): Promise<number> {
    let cleaned = 0

    try {
      if (!await fs.pathExists(this.historyDir)) {
        return 0
      }

      const files = await fs.readdir(this.historyDir)
      const threshold = olderThan.getTime()

      for (const file of files) {
        if (!file.startsWith('scan-')) continue

        const timestamp = parseInt(file.replace('scan-', '').replace('.json', ''))

        if (timestamp < threshold) {
          const filePath = path.join(this.historyDir, file)
          await fs.remove(filePath)
          cleaned++
        }
      }

      return cleaned
    } catch (error) {
      return 0
    }
  }

  /**
   * 导出历史数据
   */
  async export(format: 'json' | 'csv' = 'json'): Promise<string> {
    const history = await this.query({ limit: 100 })

    if (format === 'json') {
      return JSON.stringify(history, null, 2)
    }

    // CSV 格式
    const headers = ['timestamp', 'riskLevel', 'totalIssues', 'critical', 'high', 'medium', 'low']
    let csv = headers.join(',') + '\n'

    for (const result of history) {
      const row = [
        result.timestamp,
        result.riskLevel,
        result.summary.totalIssues,
        result.summary.critical,
        result.summary.high,
        result.summary.medium,
        result.summary.low
      ]
      csv += row.join(',') + '\n'
    }

    return csv
  }
}


