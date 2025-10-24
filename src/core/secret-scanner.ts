import fs from 'fs-extra'
import path from 'path'
import fg from 'fast-glob'
import type { SecretMatch } from '../types'

/**
 * 敏感信息扫描器 - 检测硬编码的密钥、密码等敏感信息
 */
export class SecretScanner {
  private patterns: Array<{
    name: string
    type: SecretMatch['type']
    regex: RegExp
    severity: 'critical' | 'high' | 'medium' | 'low'
  }> = [
      // API 密钥
      {
        name: 'AWS Access Key',
        type: 'api-key',
        regex: /AKIA[0-9A-Z]{16}/g,
        severity: 'critical'
      },
      {
        name: 'GitHub Token',
        type: 'token',
        regex: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
        severity: 'critical'
      },
      {
        name: 'Generic API Key',
        type: 'api-key',
        regex: /(?:api[_-]?key|apikey|api[_-]?secret)[\s]*[:=][\s]*['"]([a-zA-Z0-9_\-]{20,})['"]?/gi,
        severity: 'high'
      },
      // 密码
      {
        name: 'Password in Code',
        type: 'password',
        regex: /(?:password|passwd|pwd)[\s]*[:=][\s]*['"]([^'"]{8,})['"]?/gi,
        severity: 'high'
      },
      // Token
      {
        name: 'Bearer Token',
        type: 'token',
        regex: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
        severity: 'critical'
      },
      {
        name: 'JWT Token',
        type: 'token',
        regex: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
        severity: 'high'
      },
      // 私钥
      {
        name: 'RSA Private Key',
        type: 'private-key',
        regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g,
        severity: 'critical'
      },
      {
        name: 'SSH Private Key',
        type: 'private-key',
        regex: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
        severity: 'critical'
      },
      // 证书
      {
        name: 'Certificate',
        type: 'certificate',
        regex: /-----BEGIN CERTIFICATE-----/g,
        severity: 'medium'
      },
      // 连接字符串
      {
        name: 'Database Connection String',
        type: 'connection-string',
        regex: /(?:mysql|postgresql|mongodb|redis):\/\/[^:]+:[^@]+@[^\s]+/gi,
        severity: 'critical'
      },
      // PII
      {
        name: 'Email Address',
        type: 'pii',
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        severity: 'low'
      },
      {
        name: 'Credit Card',
        type: 'pii',
        regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        severity: 'critical'
      },
      // Slack Token
      {
        name: 'Slack Token',
        type: 'token',
        regex: /xox[baprs]-[0-9a-zA-Z]{10,48}/g,
        severity: 'critical'
      },
      // Google API Key
      {
        name: 'Google API Key',
        type: 'api-key',
        regex: /AIza[0-9A-Za-z_-]{35}/g,
        severity: 'critical'
      },
      // Stripe Key
      {
        name: 'Stripe Key',
        type: 'api-key',
        regex: /(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}/g,
        severity: 'critical'
      }
    ]

  constructor(private projectDir: string = process.cwd()) { }

  /**
   * 扫描敏感信息
   */
  async scan(patterns?: string[]): Promise<SecretMatch[]> {
    const secrets: SecretMatch[] = []

    try {
      const scanPatterns = patterns || [
        '**/*.{js,ts,jsx,tsx,vue,json,yaml,yml,env}',
        '!**/node_modules/**',
        '!**/dist/**',
        '!**/build/**',
        '!**/.git/**'
      ]

      const files = await fg(scanPatterns, {
        cwd: this.projectDir,
        absolute: true,
        dot: true
      })

      for (const file of files) {
        const fileSecrets = await this.scanFile(file)
        secrets.push(...fileSecrets)
      }

      return secrets
    } catch (error) {
      console.warn('敏感信息扫描失败:', error)
      return []
    }
  }

  /**
   * 扫描单个文件
   */
  private async scanFile(filePath: string): Promise<SecretMatch[]> {
    const secrets: SecretMatch[] = []

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex]

        for (const pattern of this.patterns) {
          const matches = line.matchAll(pattern.regex)

          for (const match of matches) {
            // 跳过注释和测试文件中的示例
            if (this.isLikelyFalsePositive(line, filePath)) {
              continue
            }

            const column = match.index || 0
            const matched = this.maskSecret(match[0])

            secrets.push({
              file: path.relative(this.projectDir, filePath),
              line: lineIndex + 1,
              column: column + 1,
              type: pattern.type,
              matched,
              pattern: pattern.name,
              severity: pattern.severity,
              suggestion: this.getSuggestion(pattern.type)
            })
          }
        }
      }

      return secrets
    } catch (error) {
      return []
    }
  }

  /**
   * 判断是否为误报
   */
  private isLikelyFalsePositive(line: string, filePath: string): boolean {
    const trimmed = line.trim()

    // 注释行
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) {
      return true
    }

    // 测试文件中的示例
    if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__')) {
      return true
    }

    // 明显的占位符
    const placeholders = [
      'xxx',
      'your-api-key',
      'your-password',
      'example',
      'placeholder',
      'dummy',
      'fake',
      'test',
      'mock'
    ]

    const lowerLine = line.toLowerCase()
    return placeholders.some(placeholder => lowerLine.includes(placeholder))
  }

  /**
   * 掩码敏感信息
   */
  private maskSecret(secret: string): string {
    if (secret.length <= 8) {
      return '*'.repeat(secret.length)
    }

    const visibleChars = 4
    const start = secret.substring(0, visibleChars)
    const end = secret.substring(secret.length - visibleChars)
    const masked = '*'.repeat(secret.length - visibleChars * 2)

    return `${start}${masked}${end}`
  }

  /**
   * 获取修复建议
   */
  private getSuggestion(type: SecretMatch['type']): string {
    const suggestions: Record<SecretMatch['type'], string> = {
      'api-key': '将 API 密钥移至环境变量或密钥管理服务',
      'password': '将密码移至环境变量或使用密钥管理服务',
      'token': '将 Token 移至环境变量或密钥管理服务',
      'certificate': '将证书移至安全存储或使用证书管理服务',
      'private-key': '立即撤销该私钥并使用密钥管理服务',
      'connection-string': '将连接字符串移至环境变量',
      'pii': '避免在代码中硬编码个人信息'
    }

    return suggestions[type] || '将敏感信息移至安全存储'
  }

  /**
   * 添加自定义模式
   */
  addPattern(pattern: {
    name: string
    type: SecretMatch['type']
    regex: RegExp
    severity: 'critical' | 'high' | 'medium' | 'low'
  }): void {
    this.patterns.push(pattern)
  }
}


