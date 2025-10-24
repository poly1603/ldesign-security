import type { SecurityScanResult } from '../types'

/**
 * 报告生成器基类
 */
export abstract class BaseReporter {
  constructor(protected result: SecurityScanResult) { }

  /**
   * 生成报告
   */
  abstract generate(): Promise<string>

  /**
   * 保存报告到文件
   */
  abstract save(outputPath: string): Promise<void>

  /**
   * 获取报告格式
   */
  abstract getFormat(): string

  /**
   * 计算风险评分 (0-100)
   */
  protected calculateRiskScore(): number {
    const weights = {
      critical: 25,
      high: 15,
      medium: 5,
      low: 1
    }

    const score =
      (this.result.summary.critical * weights.critical) +
      (this.result.summary.high * weights.high) +
      (this.result.summary.medium * weights.medium) +
      (this.result.summary.low * weights.low)

    return Math.min(100, score)
  }

  /**
   * 获取风险等级描述
   */
  protected getRiskDescription(): string {
    switch (this.result.riskLevel) {
      case 'critical':
        return 'Critical risk - Immediate action required'
      case 'high':
        return 'High risk - Should be addressed soon'
      case 'medium':
        return 'Medium risk - Should be addressed when possible'
      case 'low':
        return 'Low risk - Can be addressed at convenience'
      case 'none':
        return 'No security issues detected'
      default:
        return 'Unknown risk level'
    }
  }

  /**
   * 格式化时间戳
   */
  protected formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  /**
   * 格式化持续时间
   */
  protected formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`
    }

    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) {
      return `${seconds}s`
    }

    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }
}


