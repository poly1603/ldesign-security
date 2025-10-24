import { execa } from 'execa'
import type { SecurityScanResult, NotificationConfig, WebhookConfig, SlackConfig } from '../types'

/**
 * 通知器 - 发送扫描结果通知
 */
export class Notifier {
  constructor(private config: NotificationConfig) { }

  /**
   * 发送通知
   */
  async notify(result: SecurityScanResult): Promise<void> {
    if (!this.config.enabled) {
      return
    }

    const promises: Promise<void>[] = []

    // Webhook 通知
    if (this.config.webhook) {
      promises.push(this.sendWebhook(result, this.config.webhook))
    }

    // Slack 通知
    if (this.config.slack) {
      promises.push(this.sendSlack(result, this.config.slack))
    }

    // 钉钉通知
    if (this.config.dingtalk) {
      promises.push(this.sendDingTalk(result, this.config.dingtalk))
    }

    // 企业微信通知
    if (this.config.wecom) {
      promises.push(this.sendWeCom(result, this.config.wecom))
    }

    // 邮件通知
    if (this.config.email) {
      promises.push(this.sendEmail(result, this.config.email))
    }

    await Promise.allSettled(promises)
  }

  /**
   * 发送 Webhook 通知
   */
  private async sendWebhook(result: SecurityScanResult, config: WebhookConfig): Promise<void> {
    try {
      // 检查严重程度过滤
      if (!this.shouldNotify(result, config.severityFilter)) {
        return
      }

      const payload = this.buildPayload(result)
      const method = config.method || 'POST'

      await fetch(config.url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        body: JSON.stringify(payload)
      })
    } catch (error) {
      console.warn('Webhook 通知发送失败:', error)
    }
  }

  /**
   * 发送 Slack 通知
   */
  private async sendSlack(result: SecurityScanResult, config: SlackConfig): Promise<void> {
    try {
      if (!this.shouldNotify(result, config.severityFilter)) {
        return
      }

      const color = this.getSeverityColor(result.riskLevel)
      const emoji = this.getRiskEmoji(result.riskLevel)

      const payload = {
        username: config.username || '@ldesign/security',
        channel: config.channel,
        attachments: [
          {
            color,
            title: `${emoji} Security Scan Report`,
            fields: [
              {
                title: 'Risk Level',
                value: result.riskLevel.toUpperCase(),
                short: true
              },
              {
                title: 'Total Issues',
                value: result.summary.totalIssues.toString(),
                short: true
              },
              {
                title: 'Critical',
                value: result.summary.critical.toString(),
                short: true
              },
              {
                title: 'High',
                value: result.summary.high.toString(),
                short: true
              },
              {
                title: 'Medium',
                value: result.summary.medium.toString(),
                short: true
              },
              {
                title: 'Low',
                value: result.summary.low.toString(),
                short: true
              },
              {
                title: 'Scan Duration',
                value: `${result.duration}ms`,
                short: true
              },
              {
                title: 'Timestamp',
                value: new Date(result.timestamp).toLocaleString(),
                short: true
              }
            ],
            footer: '@ldesign/security',
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      }

      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
    } catch (error) {
      console.warn('Slack 通知发送失败:', error)
    }
  }

  /**
   * 发送钉钉通知
   */
  private async sendDingTalk(result: SecurityScanResult, config: any): Promise<void> {
    try {
      if (!this.shouldNotify(result, config.severityFilter)) {
        return
      }

      const emoji = this.getRiskEmoji(result.riskLevel)

      const text = `
${emoji} **安全扫描报告**

**风险等级**: ${result.riskLevel.toUpperCase()}
**总问题数**: ${result.summary.totalIssues}
**严重**: ${result.summary.critical} | **高**: ${result.summary.high}
**中**: ${result.summary.medium} | **低**: ${result.summary.low}

**扫描时间**: ${new Date(result.timestamp).toLocaleString('zh-CN')}
**耗时**: ${result.duration}ms

${result.metadata?.projectDir ? `**项目**: ${result.metadata.projectDir}` : ''}
      `.trim()

      const payload: any = {
        msgtype: 'markdown',
        markdown: {
          title: '安全扫描报告',
          text
        }
      }

      // 如果有签名密钥
      if (config.secret) {
        const timestamp = Date.now()
        const crypto = await import('crypto')
        const sign = crypto
          .createHmac('sha256', config.secret)
          .update(`${timestamp}\n${config.secret}`)
          .digest('base64')

        payload.timestamp = timestamp
        payload.sign = sign
      }

      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
    } catch (error) {
      console.warn('钉钉通知发送失败:', error)
    }
  }

  /**
   * 发送企业微信通知
   */
  private async sendWeCom(result: SecurityScanResult, config: any): Promise<void> {
    try {
      if (!this.shouldNotify(result, config.severityFilter)) {
        return
      }

      const emoji = this.getRiskEmoji(result.riskLevel)

      const content = `
${emoji} 安全扫描报告

风险等级: ${result.riskLevel.toUpperCase()}
总问题数: ${result.summary.totalIssues}
严重: ${result.summary.critical} | 高: ${result.summary.high}
中: ${result.summary.medium} | 低: ${result.summary.low}

扫描时间: ${new Date(result.timestamp).toLocaleString('zh-CN')}
耗时: ${result.duration}ms

${result.metadata?.projectDir ? `项目: ${result.metadata.projectDir}` : ''}
      `.trim()

      const payload = {
        msgtype: 'text',
        text: {
          content
        }
      }

      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
    } catch (error) {
      console.warn('企业微信通知发送失败:', error)
    }
  }

  /**
   * 发送邮件通知
   */
  private async sendEmail(result: SecurityScanResult, config: any): Promise<void> {
    try {
      if (!this.shouldNotify(result, config.severityFilter)) {
        return
      }

      // 使用 nodemailer 或其他邮件库
      // 这里提供一个简化的实现
      console.log('邮件通知功能需要配置 SMTP 服务器')
      console.log('收件人:', config.to)
      console.log('主题: 安全扫描报告')

      // 实际项目中应该使用 nodemailer
      // const nodemailer = require('nodemailer')
      // const transporter = nodemailer.createTransporter(config.smtp)
      // await transporter.sendMail({
      //   from: config.from,
      //   to: config.to,
      //   subject: '安全扫描报告',
      //   html: emailHtml
      // })
    } catch (error) {
      console.warn('邮件通知发送失败:', error)
    }
  }

  /**
   * 构建通用 payload
   */
  private buildPayload(result: SecurityScanResult): any {
    return {
      type: 'security-scan-report',
      timestamp: result.timestamp,
      riskLevel: result.riskLevel,
      summary: result.summary,
      duration: result.duration,
      metadata: result.metadata,
      vulnerabilities: result.vulnerabilities,
      codeIssues: result.codeIssues,
      dependencyIssues: result.dependencyIssues
    }
  }

  /**
   * 检查是否应该发送通知
   */
  private shouldNotify(result: SecurityScanResult, severityFilter?: string[]): boolean {
    if (!severityFilter || severityFilter.length === 0) {
      return true
    }

    // 检查是否有匹配的严重程度
    const hasCritical = result.summary.critical > 0 && severityFilter.includes('critical')
    const hasHigh = result.summary.high > 0 && severityFilter.includes('high')
    const hasMedium = result.summary.medium > 0 && severityFilter.includes('medium')
    const hasLow = result.summary.low > 0 && severityFilter.includes('low')

    return hasCritical || hasHigh || hasMedium || hasLow
  }

  /**
   * 获取严重程度颜色
   */
  private getSeverityColor(riskLevel: string): string {
    switch (riskLevel) {
      case 'critical': return 'danger'
      case 'high': return 'warning'
      case 'medium': return '#ffc107'
      case 'low': return 'good'
      case 'none': return 'good'
      default: return '#666666'
    }
  }

  /**
   * 获取风险 emoji
   */
  private getRiskEmoji(riskLevel: string): string {
    switch (riskLevel) {
      case 'critical': return '🚨'
      case 'high': return '⚠️'
      case 'medium': return '⚡'
      case 'low': return 'ℹ️'
      case 'none': return '✅'
      default: return '📊'
    }
  }
}


