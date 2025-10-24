import { SecurityScanner } from './security-scanner'
import { Notifier } from './notifier'
import type { SecurityScanResult, ScheduleConfig, NotificationConfig } from '../types'
import { logger } from '../utils/logger'

/**
 * 定时扫描调度器
 */
export class Scheduler {
  private intervals = new Map<string, NodeJS.Timeout>()
  private running = false

  constructor(
    private projectDir: string = process.cwd(),
    private config: ScheduleConfig = { enabled: false, cron: '0 0 * * *' }
  ) { }

  /**
   * 启动调度器
   */
  start(): void {
    if (!this.config.enabled) {
      logger.warn('Scheduler is disabled')
      return
    }

    this.running = true
    logger.info('Scheduler started')

    // 解析 cron 表达式并设置定时任务
    this.schedule('main', this.config.cron, async () => {
      await this.runScan()
    })

    // 如果配置了启动时扫描
    if (this.config.onStart) {
      this.runScan().catch(error => {
        logger.error('Initial scan failed', error)
      })
    }
  }

  /**
   * 停止调度器
   */
  stop(): void {
    this.running = false

    for (const [name, interval] of this.intervals.entries()) {
      clearInterval(interval)
      logger.info(`Stopped schedule: ${name}`)
    }

    this.intervals.clear()
    logger.info('Scheduler stopped')
  }

  /**
   * 添加定时任务
   */
  schedule(name: string, cronExpression: string, task: () => Promise<void>): void {
    const interval = this.parseCronToInterval(cronExpression)

    if (interval > 0) {
      const timer = setInterval(async () => {
        try {
          logger.info(`Running scheduled task: ${name}`)
          await task()
        } catch (error) {
          logger.error(`Scheduled task failed: ${name}`, error as Error)
        }
      }, interval)

      this.intervals.set(name, timer)
      logger.info(`Scheduled task: ${name} (interval: ${interval}ms)`)
    }
  }

  /**
   * 执行扫描
   */
  private async runScan(): Promise<SecurityScanResult> {
    logger.info('Starting scheduled security scan...')

    const scanner = new SecurityScanner({ projectDir: this.projectDir })
    const result = await scanner.scan()

    logger.info(`Scan completed: ${result.summary.totalIssues} issues found`)

    // 如果发现问题，发送通知
    if (result.summary.totalIssues > 0) {
      await this.sendNotification(result)
    }

    return result
  }

  /**
   * 发送通知
   */
  private async sendNotification(result: SecurityScanResult): Promise<void> {
    // 这里应该从配置加载通知设置
    // 简化实现
    logger.info(`Found ${result.summary.totalIssues} issues`)
  }

  /**
   * 解析 Cron 表达式到毫秒间隔（简化版本）
   */
  private parseCronToInterval(cronExpression: string): number {
    // 简化的 cron 解析
    // 格式: "* * * * *" (分 时 日 月 周)

    // 一些常见的预设
    const presets: Record<string, number> = {
      '@hourly': 60 * 60 * 1000,
      '@daily': 24 * 60 * 60 * 1000,
      '@weekly': 7 * 24 * 60 * 60 * 1000,
      '@monthly': 30 * 24 * 60 * 60 * 1000
    }

    if (presets[cronExpression]) {
      return presets[cronExpression]
    }

    // 默认每小时
    return 60 * 60 * 1000
  }

  /**
   * 获取调度器状态
   */
  getStatus(): {
    running: boolean
    tasks: string[]
    nextRun?: Date
  } {
    return {
      running: this.running,
      tasks: Array.from(this.intervals.keys())
    }
  }
}


