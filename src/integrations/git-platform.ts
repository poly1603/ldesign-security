import { execa } from 'execa'
import type { SecurityScanResult } from '../types'

/**
 * Git 平台类型
 */
export type GitPlatform = 'github' | 'gitlab' | 'bitbucket'

/**
 * Git 平台集成配置
 */
export interface GitPlatformConfig {
  platform: GitPlatform
  token: string
  repository: string
  owner?: string
  baseUrl?: string
}

/**
 * PR/MR 评论配置
 */
export interface CommentOptions {
  pullRequestId: number
  body: string
  severityThreshold?: 'critical' | 'high' | 'medium' | 'low'
}

/**
 * Issue 创建配置
 */
export interface IssueOptions {
  title: string
  body: string
  labels?: string[]
  assignees?: string[]
}

/**
 * Git 平台集成
 * 支持 GitHub PR 评论、GitLab MR 评论、自动创建 Issue
 * 
 * @example
 * ```typescript
 * const integration = new GitPlatformIntegration({
 *   platform: 'github',
 *   token: process.env.GITHUB_TOKEN!,
 *   repository: 'owner/repo'
 * })
 * 
 * // 在 PR 上评论扫描结果
 * await integration.commentOnPR(123, scanResult)
 * 
 * // 为严重漏洞创建 Issue
 * await integration.createIssuesForVulnerabilities(scanResult)
 * ```
 */
export class GitPlatformIntegration {
  private config: GitPlatformConfig

  constructor(config: GitPlatformConfig) {
    this.config = config
  }

  /**
   * 在 PR/MR 上评论扫描结果
   */
  async commentOnPR(pullRequestId: number, scanResult: SecurityScanResult): Promise<void> {
    const comment = this.formatScanResultComment(scanResult)
    
    switch (this.config.platform) {
      case 'github':
        await this.githubComment(pullRequestId, comment)
        break
      case 'gitlab':
        await this.gitlabComment(pullRequestId, comment)
        break
      default:
        throw new Error(`不支持的平台: ${this.config.platform}`)
    }
  }

  /**
   * 为严重漏洞创建 Issue
   */
  async createIssuesForVulnerabilities(
    scanResult: SecurityScanResult,
    severityThreshold: 'critical' | 'high' = 'critical'
  ): Promise<void> {
    const vulnerabilities = scanResult.vulnerabilities.filter(
      v => this.shouldCreateIssue(v.severity, severityThreshold)
    )

    for (const vuln of vulnerabilities) {
      const issue: IssueOptions = {
        title: `[Security] ${vuln.title}`,
        body: this.formatVulnerabilityIssue(vuln),
        labels: ['security', `severity:${vuln.severity}`]
      }

      await this.createIssue(issue)
    }
  }

  /**
   * 创建 Issue
   */
  async createIssue(options: IssueOptions): Promise<void> {
    switch (this.config.platform) {
      case 'github':
        await this.githubCreateIssue(options)
        break
      case 'gitlab':
        await this.gitlabCreateIssue(options)
        break
      default:
        throw new Error(`不支持的平台: ${this.config.platform}`)
    }
  }

  /**
   * GitHub PR 评论
   */
  private async githubComment(pullRequestId: number, body: string): Promise<void> {
    const [owner, repo] = this.parseRepository()
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${pullRequestId}/comments`

    await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({ body })
    })
  }

  /**
   * GitHub 创建 Issue
   */
  private async githubCreateIssue(options: IssueOptions): Promise<void> {
    const [owner, repo] = this.parseRepository()
    const url = `https://api.github.com/repos/${owner}/${repo}/issues`

    await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify(options)
    })
  }

  /**
   * GitLab MR 评论
   */
  private async gitlabComment(mergeRequestId: number, body: string): Promise<void> {
    const projectId = encodeURIComponent(this.config.repository)
    const baseUrl = this.config.baseUrl || 'https://gitlab.com'
    const url = `${baseUrl}/api/v4/projects/${projectId}/merge_requests/${mergeRequestId}/notes`

    await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({ body })
    })
  }

  /**
   * GitLab 创建 Issue
   */
  private async gitlabCreateIssue(options: IssueOptions): Promise<void> {
    const projectId = encodeURIComponent(this.config.repository)
    const baseUrl = this.config.baseUrl || 'https://gitlab.com'
    const url = `${baseUrl}/api/v4/projects/${projectId}/issues`

    await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        title: options.title,
        description: options.body,
        labels: options.labels?.join(',')
      })
    })
  }

  /**
   * HTTP 请求封装
   */
  private async fetch(url: string, options: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.config.platform === 'github') {
      headers['Authorization'] = `token ${this.config.token}`
      headers['Accept'] = 'application/vnd.github.v3+json'
    } else if (this.config.platform === 'gitlab') {
      headers['PRIVATE-TOKEN'] = this.config.token
    }

    // 实际实现应使用 fetch 或 axios
    // 这里为简化示例
    console.log(`HTTP ${options.method} ${url}`)
    console.log('Headers:', headers)
    console.log('Body:', options.body)
  }

  /**
   * 格式化扫描结果为评论
   */
  private formatScanResultComment(result: SecurityScanResult): string {
    const { summary, riskLevel } = result

    let comment = `## 🔒 安全扫描报告\n\n`
    comment += `**风险等级**: ${this.getRiskLevelEmoji(riskLevel)} ${riskLevel.toUpperCase()}\n\n`
    comment += `### 📊 问题统计\n\n`
    comment += `| 严重程度 | 数量 |\n`
    comment += `|---------|------|\n`
    comment += `| 🔴 严重 | ${summary.critical} |\n`
    comment += `| 🟠 高危 | ${summary.high} |\n`
    comment += `| 🟡 中危 | ${summary.medium} |\n`
    comment += `| 🟢 低危 | ${summary.low} |\n\n`

    if (result.vulnerabilities.length > 0) {
      comment += `### 🐛 漏洞详情\n\n`
      result.vulnerabilities.slice(0, 5).forEach(v => {
        comment += `- **${v.package}**: ${v.title} (${v.severity})\n`
      })
      if (result.vulnerabilities.length > 5) {
        comment += `\n_还有 ${result.vulnerabilities.length - 5} 个漏洞未显示..._\n`
      }
    }

    comment += `\n---\n`
    comment += `_由 @ldesign/security 自动生成_`

    return comment
  }

  /**
   * 格式化漏洞为 Issue
   */
  private formatVulnerabilityIssue(vuln: any): string {
    let body = `## 漏洞详情\n\n`
    body += `- **包名**: ${vuln.package}\n`
    body += `- **严重程度**: ${vuln.severity}\n`
    body += `- **标题**: ${vuln.title}\n`
    body += `- **描述**: ${vuln.description}\n\n`
    body += `### 修复建议\n\n${vuln.recommendation}\n\n`
    
    if (vuln.cve) {
      body += `### 参考\n\n- CVE: ${vuln.cve}\n`
    }
    if (vuln.url) {
      body += `- URL: ${vuln.url}\n`
    }

    return body
  }

  /**
   * 解析仓库信息
   */
  private parseRepository(): [string, string] {
    if (this.config.owner) {
      return [this.config.owner, this.config.repository]
    }
    const parts = this.config.repository.split('/')
    if (parts.length !== 2) {
      throw new Error('repository 格式应为 owner/repo')
    }
    return parts as [string, string]
  }

  /**
   * 获取风险等级表情
   */
  private getRiskLevelEmoji(level: string): string {
    const emojis: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
      none: '✅'
    }
    return emojis[level] || '⚪'
  }

  /**
   * 判断是否应该创建 Issue
   */
  private shouldCreateIssue(severity: string, threshold: string): boolean {
    const levels = ['low', 'medium', 'high', 'critical']
    const severityIndex = levels.indexOf(severity)
    const thresholdIndex = levels.indexOf(threshold)
    return severityIndex >= thresholdIndex
  }
}
