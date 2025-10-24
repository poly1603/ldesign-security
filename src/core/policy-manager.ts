import fs from 'fs-extra'
import path from 'path'
import type { SecurityPolicy } from '../types'

/**
 * 策略管理器 - 管理安全策略配置
 */
export class PolicyManager {
  private static CONFIG_FILES = [
    '.securityrc',
    '.securityrc.json',
    '.securityrc.js',
    'security.config.js',
    'security.config.json'
  ]

  private policy: SecurityPolicy | null = null

  constructor(private projectDir: string = process.cwd()) { }

  /**
   * 加载策略配置
   */
  async load(): Promise<SecurityPolicy> {
    if (this.policy) {
      return this.policy
    }

    // 按优先级查找配置文件
    for (const configFile of PolicyManager.CONFIG_FILES) {
      const configPath = path.join(this.projectDir, configFile)

      if (await fs.pathExists(configPath)) {
        try {
          this.policy = await this.loadConfigFile(configPath)
          return this.policy
        } catch (error) {
          console.warn(`Failed to load config from ${configFile}:`, error)
        }
      }
    }

    // 尝试从 package.json 读取
    try {
      const pkgPath = path.join(this.projectDir, 'package.json')
      if (await fs.pathExists(pkgPath)) {
        const pkg = await fs.readJSON(pkgPath)
        if (pkg.security) {
          this.policy = pkg.security
          return this.policy
        }
      }
    } catch {
      // 忽略
    }

    // 返回默认策略
    this.policy = this.getDefaultPolicy()
    return this.policy
  }

  /**
   * 加载配置文件
   */
  private async loadConfigFile(configPath: string): Promise<SecurityPolicy> {
    const ext = path.extname(configPath)

    if (ext === '.json' || configPath.endsWith('.securityrc')) {
      return await fs.readJSON(configPath)
    }

    if (ext === '.js') {
      // 动态导入 JS 配置
      const fullPath = path.resolve(configPath)
      const module = await import(fullPath)
      return module.default || module
    }

    throw new Error(`Unsupported config file format: ${ext}`)
  }

  /**
   * 获取默认策略
   */
  private getDefaultPolicy(): SecurityPolicy {
    return {
      scan: {
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
          '**/coverage/**',
          '**/*.test.{js,ts,jsx,tsx}',
          '**/*.spec.{js,ts,jsx,tsx}'
        ],
        severity: 'medium',
        failOn: 'high'
      },
      license: {
        whitelist: [
          'MIT',
          'Apache-2.0',
          'BSD-2-Clause',
          'BSD-3-Clause',
          'ISC',
          '0BSD',
          'Unlicense',
          'CC0-1.0'
        ],
        blacklist: [],
        allowUnknown: false
      },
      notifications: {
        enabled: false
      },
      reports: {
        format: ['json', 'html'],
        output: './security-reports'
      }
    }
  }

  /**
   * 保存策略配置
   */
  async save(policy: SecurityPolicy, format: 'json' | 'js' = 'json'): Promise<void> {
    const configFile = format === 'json' ? '.securityrc.json' : 'security.config.js'
    const configPath = path.join(this.projectDir, configFile)

    if (format === 'json') {
      await fs.writeJSON(configPath, policy, { spaces: 2 })
    } else {
      const content = `module.exports = ${JSON.stringify(policy, null, 2)}\n`
      await fs.writeFile(configPath, content, 'utf-8')
    }

    this.policy = policy
  }

  /**
   * 获取当前策略
   */
  async getPolicy(): Promise<SecurityPolicy> {
    if (!this.policy) {
      await this.load()
    }
    return this.policy!
  }

  /**
   * 更新策略
   */
  async update(updates: Partial<SecurityPolicy>): Promise<void> {
    const current = await this.getPolicy()
    this.policy = { ...current, ...updates }
  }

  /**
   * 验证策略配置
   */
  validate(policy: SecurityPolicy): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 验证扫描配置
    if (policy.scan) {
      const validSeverities = ['critical', 'high', 'medium', 'low']

      if (policy.scan.severity && !validSeverities.includes(policy.scan.severity)) {
        errors.push(`Invalid severity: ${policy.scan.severity}`)
      }

      if (policy.scan.failOn && !validSeverities.includes(policy.scan.failOn)) {
        errors.push(`Invalid failOn: ${policy.scan.failOn}`)
      }
    }

    // 验证通知配置
    if (policy.notifications) {
      if (policy.notifications.webhook) {
        try {
          new URL(policy.notifications.webhook.url)
        } catch {
          errors.push('Invalid webhook URL')
        }
      }

      if (policy.notifications.slack) {
        try {
          new URL(policy.notifications.slack.webhookUrl)
        } catch {
          errors.push('Invalid Slack webhook URL')
        }
      }
    }

    // 验证报告配置
    if (policy.reports) {
      const validFormats = ['html', 'pdf', 'json', 'yaml', 'markdown', 'sarif']

      for (const format of policy.reports.format) {
        if (!validFormats.includes(format)) {
          errors.push(`Invalid report format: ${format}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 合并策略（将用户策略与默认策略合并）
   */
  merge(userPolicy: Partial<SecurityPolicy>): SecurityPolicy {
    const defaultPolicy = this.getDefaultPolicy()

    return {
      scan: { ...defaultPolicy.scan, ...userPolicy.scan },
      license: { ...defaultPolicy.license, ...userPolicy.license },
      notifications: { ...defaultPolicy.notifications, ...userPolicy.notifications },
      schedule: userPolicy.schedule || defaultPolicy.schedule,
      reports: { ...defaultPolicy.reports, ...userPolicy.reports }
    }
  }

  /**
   * 生成示例配置
   */
  static generateExample(): SecurityPolicy {
    return {
      scan: {
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**'
        ],
        severity: 'medium',
        failOn: 'high'
      },
      license: {
        whitelist: [
          'MIT',
          'Apache-2.0',
          'BSD-3-Clause'
        ],
        blacklist: [
          'GPL-3.0'
        ],
        allowUnknown: false
      },
      notifications: {
        enabled: true,
        webhook: {
          url: 'https://hooks.example.com/webhook',
          severityFilter: ['critical', 'high']
        },
        slack: {
          webhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
          channel: '#security-alerts',
          severityFilter: ['critical', 'high']
        }
      },
      schedule: '0 0 * * *', // Daily at midnight
      reports: {
        format: ['html', 'json', 'sarif'],
        output: './security-reports',
        includeCharts: true,
        includeDependencyGraph: true
      }
    }
  }

  /**
   * 创建初始配置文件
   */
  async init(format: 'json' | 'js' = 'json'): Promise<void> {
    const example = PolicyManager.generateExample()
    await this.save(example, format)
  }
}


