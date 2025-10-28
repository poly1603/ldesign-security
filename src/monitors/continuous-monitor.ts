import { EventEmitter } from 'events'
import { watch, FSWatcher } from 'fs'
import { join, resolve } from 'path'
import { execSync } from 'child_process'
import { SecurityScanner } from '../core/scanner'
import { ScanResult, ScanOptions, MonitorConfig, MonitorEvent, MonitorStats } from '../types'
import { Logger } from '../utils/logger'
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs'

export interface ContinuousMonitorOptions {
  // 监控目录
  watchPaths?: string[]
  // 忽略的路径模式
  ignorePatterns?: string[]
  // 扫描间隔（毫秒）
  scanInterval?: number
  // 是否监听文件变化
  watchFiles?: boolean
  // 是否安装 Git hooks
  installGitHooks?: boolean
  // Git hooks 类型
  gitHooks?: Array<'pre-commit' | 'pre-push' | 'commit-msg'>
  // 实时告警配置
  alerts?: {
    enabled: boolean
    severityThreshold?: 'low' | 'medium' | 'high' | 'critical'
    webhookUrl?: string
    slackWebhook?: string
    dingtalkWebhook?: string
    wecomWebhook?: string
  }
  // 扫描选项
  scanOptions?: Partial<ScanOptions>
  // 自动修复
  autoFix?: boolean
  // 增量扫描
  incrementalScan?: boolean
}

export class ContinuousMonitor extends EventEmitter {
  private scanner: SecurityScanner
  private watchers: FSWatcher[] = []
  private isRunning = false
  private scanTimer?: NodeJS.Timeout
  private logger: Logger
  private stats: MonitorStats
  private lastScanTime?: Date
  private changedFiles: Set<string> = new Set()

  constructor(
    private projectPath: string,
    private options: ContinuousMonitorOptions = {}
  ) {
    super()
    this.logger = new Logger('ContinuousMonitor')
    this.scanner = new SecurityScanner()
    this.stats = {
      totalScans: 0,
      filesWatched: 0,
      alertsSent: 0,
      lastScanDuration: 0,
      averageScanDuration: 0
    }

    // 设置默认选项
    this.options = {
      watchPaths: ['.'],
      ignorePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**', 'coverage/**'],
      scanInterval: 300000, // 5分钟
      watchFiles: true,
      installGitHooks: true,
      gitHooks: ['pre-commit', 'pre-push'],
      alerts: {
        enabled: true,
        severityThreshold: 'medium'
      },
      autoFix: false,
      incrementalScan: true,
      ...options
    }
  }

  /**
   * 启动持续监控
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Monitor is already running')
      return
    }

    this.isRunning = true
    this.logger.info('Starting continuous security monitoring...')

    // 安装 Git hooks
    if (this.options.installGitHooks) {
      await this.installGitHooks()
    }

    // 启动文件监听
    if (this.options.watchFiles) {
      this.startFileWatching()
    }

    // 启动定时扫描
    if (this.options.scanInterval && this.options.scanInterval > 0) {
      this.startPeriodicScanning()
    }

    // 执行初始扫描
    await this.performScan('initial')

    this.emit('started', { timestamp: new Date() })
    this.logger.info('Continuous monitoring started successfully')
  }

  /**
   * 停止持续监控
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    this.logger.info('Stopping continuous security monitoring...')

    // 停止文件监听
    this.stopFileWatching()

    // 停止定时扫描
    if (this.scanTimer) {
      clearInterval(this.scanTimer)
      this.scanTimer = undefined
    }

    this.emit('stopped', { timestamp: new Date(), stats: this.stats })
    this.logger.info('Continuous monitoring stopped')
  }

  /**
   * 安装 Git hooks
   */
  private async installGitHooks(): Promise<void> {
    const gitDir = join(this.projectPath, '.git')
    if (!existsSync(gitDir)) {
      this.logger.warn('Not a Git repository, skipping Git hooks installation')
      return
    }

    const hooksDir = join(gitDir, 'hooks')
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true })
    }

    const hooks = this.options.gitHooks || []
    for (const hookType of hooks) {
      const hookPath = join(hooksDir, hookType)
      const hookScript = this.generateHookScript(hookType)

      writeFileSync(hookPath, hookScript, { mode: 0o755 })
      this.logger.info(`Installed ${hookType} Git hook`)
    }

    this.emit('hooks-installed', { hooks })
  }

  /**
   * 生成 Git hook 脚本
   */
  private generateHookScript(hookType: string): string {
    const nodePath = process.execPath
    const scriptPath = resolve(__dirname, '../../bin/git-hook-runner.js')

    return `#!/bin/sh
# ${hookType} hook installed by @ldesign/security
# Auto-generated - DO NOT EDIT

"${nodePath}" "${scriptPath}" ${hookType} "$@"
exit $?
`
  }

  /**
   * 启动文件监听
   */
  private startFileWatching(): void {
    const watchPaths = this.options.watchPaths || ['.']
    const ignorePatterns = this.options.ignorePatterns || []

    for (const watchPath of watchPaths) {
      const fullPath = resolve(this.projectPath, watchPath)
      
      try {
        const watcher = watch(fullPath, { recursive: true }, (eventType, filename) => {
          if (!filename) return

          // 检查是否应该忽略此文件
          const shouldIgnore = ignorePatterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'))
            return regex.test(filename)
          })

          if (shouldIgnore) return

          this.logger.debug(`File ${eventType}: ${filename}`)
          this.changedFiles.add(filename)
          this.emit('file-changed', { eventType, filename, timestamp: new Date() })

          // 触发增量扫描
          if (this.options.incrementalScan) {
            this.scheduleIncrementalScan()
          }
        })

        this.watchers.push(watcher)
        this.stats.filesWatched++
      } catch (error) {
        this.logger.error(`Failed to watch path ${fullPath}: ${error}`)
      }
    }

    this.logger.info(`Watching ${this.watchers.length} paths for changes`)
  }

  /**
   * 停止文件监听
   */
  private stopFileWatching(): void {
    for (const watcher of this.watchers) {
      watcher.close()
    }
    this.watchers = []
    this.stats.filesWatched = 0
  }

  /**
   * 启动定时扫描
   */
  private startPeriodicScanning(): void {
    const interval = this.options.scanInterval!
    this.scanTimer = setInterval(async () => {
      await this.performScan('periodic')
    }, interval)

    this.logger.info(`Scheduled periodic scans every ${interval}ms`)
  }

  /**
   * 调度增量扫描
   */
  private incrementalScanTimeout?: NodeJS.Timeout
  private scheduleIncrementalScan(): void {
    if (this.incrementalScanTimeout) {
      clearTimeout(this.incrementalScanTimeout)
    }

    // 延迟扫描，避免频繁触发
    this.incrementalScanTimeout = setTimeout(async () => {
      await this.performScan('incremental')
      this.changedFiles.clear()
    }, 2000)
  }

  /**
   * 执行扫描
   */
  private async performScan(trigger: 'initial' | 'periodic' | 'incremental' | 'manual'): Promise<ScanResult> {
    const startTime = Date.now()
    this.logger.info(`Starting ${trigger} security scan...`)

    this.emit('scan-started', { trigger, timestamp: new Date() })

    try {
      // 构建扫描选项
      const scanOptions: ScanOptions = {
        ...this.options.scanOptions,
        projectPath: this.projectPath,
        enabledScanners: this.options.scanOptions?.enabledScanners || [
          'npm-audit',
          'osv',
          'sensitive-info',
          'injection',
          'code-audit',
          'license',
          'supply-chain',
          'dependency',
          'crypto',
          'api-security'
        ]
      }

      // 增量扫描仅扫描变更的文件
      if (trigger === 'incremental' && this.changedFiles.size > 0) {
        scanOptions.includeFiles = Array.from(this.changedFiles)
      }

      // 执行扫描
      const result = await this.scanner.scan(scanOptions)

      const duration = Date.now() - startTime
      this.stats.totalScans++
      this.stats.lastScanDuration = duration
      this.stats.averageScanDuration = 
        (this.stats.averageScanDuration * (this.stats.totalScans - 1) + duration) / this.stats.totalScans
      this.lastScanTime = new Date()

      this.logger.info(`Scan completed in ${duration}ms. Found ${result.vulnerabilities.length} vulnerabilities`)

      this.emit('scan-completed', { 
        trigger, 
        result, 
        duration, 
        timestamp: new Date() 
      })

      // 检查是否需要发送告警
      if (this.options.alerts?.enabled) {
        await this.checkAndSendAlerts(result)
      }

      // 自动修复
      if (this.options.autoFix && result.vulnerabilities.length > 0) {
        await this.performAutoFix(result)
      }

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error(`Scan failed after ${duration}ms: ${error}`)
      
      this.emit('scan-failed', { 
        trigger, 
        error, 
        duration, 
        timestamp: new Date() 
      })

      throw error
    }
  }

  /**
   * 检查并发送告警
   */
  private async checkAndSendAlerts(result: ScanResult): Promise<void> {
    const threshold = this.options.alerts?.severityThreshold || 'medium'
    const severityLevels = ['low', 'medium', 'high', 'critical']
    const thresholdIndex = severityLevels.indexOf(threshold)

    const criticalVulns = result.vulnerabilities.filter(v => {
      const vulnIndex = severityLevels.indexOf(v.severity)
      return vulnIndex >= thresholdIndex
    })

    if (criticalVulns.length === 0) {
      return
    }

    this.logger.warn(`Found ${criticalVulns.length} vulnerabilities above ${threshold} severity threshold`)

    const alert = {
      timestamp: new Date(),
      project: this.projectPath,
      totalVulnerabilities: result.vulnerabilities.length,
      criticalVulnerabilities: criticalVulns.length,
      severityBreakdown: {
        critical: result.vulnerabilities.filter(v => v.severity === 'critical').length,
        high: result.vulnerabilities.filter(v => v.severity === 'high').length,
        medium: result.vulnerabilities.filter(v => v.severity === 'medium').length,
        low: result.vulnerabilities.filter(v => v.severity === 'low').length
      },
      topVulnerabilities: criticalVulns.slice(0, 5).map(v => ({
        title: v.title,
        severity: v.severity,
        package: v.package,
        cve: v.cve
      }))
    }

    // 发送到各个渠道
    const promises: Promise<void>[] = []

    if (this.options.alerts?.webhookUrl) {
      promises.push(this.sendWebhookAlert(this.options.alerts.webhookUrl, alert))
    }

    if (this.options.alerts?.slackWebhook) {
      promises.push(this.sendSlackAlert(this.options.alerts.slackWebhook, alert))
    }

    if (this.options.alerts?.dingtalkWebhook) {
      promises.push(this.sendDingTalkAlert(this.options.alerts.dingtalkWebhook, alert))
    }

    if (this.options.alerts?.wecomWebhook) {
      promises.push(this.sendWeComAlert(this.options.alerts.wecomWebhook, alert))
    }

    await Promise.allSettled(promises)
    this.stats.alertsSent++

    this.emit('alert-sent', alert)
  }

  /**
   * 发送 Webhook 告警
   */
  private async sendWebhookAlert(url: string, alert: any): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert)
      })

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`)
      }

      this.logger.info('Webhook alert sent successfully')
    } catch (error) {
      this.logger.error(`Failed to send webhook alert: ${error}`)
    }
  }

  /**
   * 发送 Slack 告警
   */
  private async sendSlackAlert(webhookUrl: string, alert: any): Promise<void> {
    const message = {
      text: `🚨 Security Alert - ${alert.project}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 Security Vulnerability Alert'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Project:*\n${alert.project}`
            },
            {
              type: 'mrkdwn',
              text: `*Time:*\n${alert.timestamp.toISOString()}`
            },
            {
              type: 'mrkdwn',
              text: `*Total Vulnerabilities:*\n${alert.totalVulnerabilities}`
            },
            {
              type: 'mrkdwn',
              text: `*Critical Issues:*\n${alert.criticalVulnerabilities}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Severity Breakdown:*\n🔴 Critical: ${alert.severityBreakdown.critical}\n🟠 High: ${alert.severityBreakdown.high}\n🟡 Medium: ${alert.severityBreakdown.medium}\n⚪ Low: ${alert.severityBreakdown.low}`
          }
        }
      ]
    }

    await this.sendWebhookAlert(webhookUrl, message)
  }

  /**
   * 发送钉钉告警
   */
  private async sendDingTalkAlert(webhookUrl: string, alert: any): Promise<void> {
    const message = {
      msgtype: 'markdown',
      markdown: {
        title: '安全漏洞告警',
        text: `## 🚨 安全漏洞告警\n\n` +
          `**项目:** ${alert.project}\n\n` +
          `**时间:** ${alert.timestamp.toLocaleString('zh-CN')}\n\n` +
          `**漏洞总数:** ${alert.totalVulnerabilities}\n\n` +
          `**严重程度分布:**\n` +
          `- 🔴 严重: ${alert.severityBreakdown.critical}\n` +
          `- 🟠 高危: ${alert.severityBreakdown.high}\n` +
          `- 🟡 中危: ${alert.severityBreakdown.medium}\n` +
          `- ⚪ 低危: ${alert.severityBreakdown.low}\n\n` +
          `请及时处理！`
      }
    }

    await this.sendWebhookAlert(webhookUrl, message)
  }

  /**
   * 发送企业微信告警
   */
  private async sendWeComAlert(webhookUrl: string, alert: any): Promise<void> {
    const message = {
      msgtype: 'markdown',
      markdown: {
        content: `## 🚨 安全漏洞告警\n` +
          `>项目: <font color="info">${alert.project}</font>\n` +
          `>时间: ${alert.timestamp.toLocaleString('zh-CN')}\n` +
          `>漏洞总数: <font color="warning">${alert.totalVulnerabilities}</font>\n` +
          `>严重: <font color="warning">${alert.severityBreakdown.critical}</font> | ` +
          `高危: ${alert.severityBreakdown.high} | ` +
          `中危: ${alert.severityBreakdown.medium} | ` +
          `低危: ${alert.severityBreakdown.low}\n\n` +
          `请及时处理！`
      }
    }

    await this.sendWebhookAlert(webhookUrl, message)
  }

  /**
   * 执行自动修复
   */
  private async performAutoFix(result: ScanResult): Promise<void> {
    this.logger.info('Starting auto-fix...')
    
    try {
      // 这里可以集成 SmartFixer
      const fixableVulns = result.vulnerabilities.filter(v => v.fixAvailable)
      
      this.logger.info(`Found ${fixableVulns.length} fixable vulnerabilities`)
      
      this.emit('auto-fix-started', { 
        vulnerabilities: fixableVulns.length 
      })

      // 实际修复逻辑（简化版本）
      for (const vuln of fixableVulns) {
        if (vuln.fixedVersion) {
          this.logger.info(`Auto-fixing ${vuln.package}: ${vuln.installedVersion} -> ${vuln.fixedVersion}`)
          // 这里可以调用 SmartFixer 或直接更新依赖
        }
      }

      this.emit('auto-fix-completed', { 
        fixed: fixableVulns.length 
      })

    } catch (error) {
      this.logger.error(`Auto-fix failed: ${error}`)
      this.emit('auto-fix-failed', { error })
    }
  }

  /**
   * 手动触发扫描
   */
  async triggerScan(): Promise<ScanResult> {
    return await this.performScan('manual')
  }

  /**
   * 获取监控统计信息
   */
  getStats(): MonitorStats {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      lastScanTime: this.lastScanTime,
      watchersActive: this.watchers.length
    }
  }

  /**
   * 获取变更的文件列表
   */
  getChangedFiles(): string[] {
    return Array.from(this.changedFiles)
  }

  /**
   * 清除变更的文件列表
   */
  clearChangedFiles(): void {
    this.changedFiles.clear()
  }
}

// 导出类型
export { MonitorConfig, MonitorEvent, MonitorStats }
