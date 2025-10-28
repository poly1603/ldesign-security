import { readFile } from 'fs/promises'
import { glob } from 'fast-glob'
import path from 'path'
import type { CodeIssue, Severity } from '../types'

/**
 * 加密问题类型
 */
export interface CryptoIssue extends CodeIssue {
  type: 'weak-algorithm' | 'hardcoded-key' | 'insecure-random' | 'ssl-config' | 'deprecated-crypto'
  recommendation: string
  cwe?: string // Common Weakness Enumeration
}

/**
 * 加密安全分析器配置
 */
export interface CryptoAnalyzerOptions {
  projectDir: string
  exclude?: string[]
  checkWeakAlgorithms?: boolean
  checkHardcodedKeys?: boolean
  checkInsecureRandom?: boolean
  checkSSLConfig?: boolean
}

/**
 * 加密安全分析器
 * 检测弱加密算法、硬编码密钥、不安全随机数、SSL/TLS 配置问题
 * 
 * @example
 * ```typescript
 * const analyzer = new CryptoAnalyzer({
 *   projectDir: './my-project',
 *   checkWeakAlgorithms: true,
 *   checkHardcodedKeys: true
 * })
 * 
 * const issues = await analyzer.analyze()
 * console.log(`发现 ${issues.length} 个加密安全问题`)
 * ```
 */
export class CryptoAnalyzer {
  private projectDir: string
  private exclude: string[]
  private options: Required<Omit<CryptoAnalyzerOptions, 'projectDir' | 'exclude'>>

  // 弱加密算法列表
  private readonly WEAK_ALGORITHMS = [
    'md5', 'md4', 'md2',
    'sha1', 'sha-1',
    'des', 'rc4', 'rc2',
    'blowfish'
  ]

  // 已废弃的加密算法
  private readonly DEPRECATED_ALGORITHMS = [
    'crypto.createCipher', // 已废弃，应使用 createCipheriv
    'crypto.createDecipher' // 已废弃，应使用 createDecipheriv
  ]

  // 不安全的随机数生成
  private readonly INSECURE_RANDOM = [
    'Math.random',
    'Math.floor(Math.random',
    'Math.ceil(Math.random',
    'Math.round(Math.random'
  ]

  // SSL/TLS 不安全配置
  private readonly INSECURE_SSL_PATTERNS = [
    { pattern: /rejectUnauthorized\s*:\s*false/gi, desc: 'SSL 证书验证被禁用' },
    { pattern: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?/gi, desc: 'TLS 证书验证被全局禁用' },
    { pattern: /secureProtocol\s*:\s*['"]SSLv[23]/gi, desc: '使用了不安全的 SSL 协议版本' },
    { pattern: /minVersion\s*:\s*['"]TLSv1['"]/gi, desc: 'TLS 最低版本过低' }
  ]

  constructor(options: CryptoAnalyzerOptions) {
    this.projectDir = options.projectDir
    this.exclude = options.exclude || [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**'
    ]
    this.options = {
      checkWeakAlgorithms: options.checkWeakAlgorithms ?? true,
      checkHardcodedKeys: options.checkHardcodedKeys ?? true,
      checkInsecureRandom: options.checkInsecureRandom ?? true,
      checkSSLConfig: options.checkSSLConfig ?? true
    }
  }

  /**
   * 执行完整的加密安全分析
   */
  async analyze(): Promise<CryptoIssue[]> {
    const issues: CryptoIssue[] = []

    // 获取所有需要扫描的文件
    const files = await this.getFilesToScan()

    for (const file of files) {
      try {
        const content = await readFile(file, 'utf-8')
        const lines = content.split('\n')

        if (this.options.checkWeakAlgorithms) {
          issues.push(...this.detectWeakAlgorithms(file, lines))
        }

        if (this.options.checkHardcodedKeys) {
          issues.push(...this.detectHardcodedKeys(file, lines))
        }

        if (this.options.checkInsecureRandom) {
          issues.push(...this.detectInsecureRandom(file, lines))
        }

        if (this.options.checkSSLConfig) {
          issues.push(...this.detectInsecureSSL(file, lines))
        }

        // 检测已废弃的加密 API
        issues.push(...this.detectDeprecatedCrypto(file, lines))
      } catch (error) {
        // 跳过无法读取的文件
        continue
      }
    }

    return issues
  }

  /**
   * 检测弱加密算法
   */
  private detectWeakAlgorithms(file: string, lines: string[]): CryptoIssue[] {
    const issues: CryptoIssue[] = []

    lines.forEach((line, index) => {
      // 检测 crypto.createHash/createHmac 使用弱算法
      const hashMatch = line.match(/crypto\.create(?:Hash|Hmac)\s*\(\s*['"](\w+)['"]/i)
      if (hashMatch) {
        const algorithm = hashMatch[1].toLowerCase()
        if (this.WEAK_ALGORITHMS.includes(algorithm)) {
          issues.push({
            file,
            line: index + 1,
            column: line.indexOf(hashMatch[0]) + 1,
            message: `使用了弱加密算法: ${algorithm}`,
            ruleId: 'crypto-weak-algorithm',
            severity: 'high',
            type: 'weak-algorithm',
            recommendation: algorithm.startsWith('md') || algorithm === 'sha1' 
              ? '建议使用 SHA-256 或更强的算法'
              : '建议使用 AES-256 或 ChaCha20',
            cwe: 'CWE-327'
          })
        }
      }

      // 检测其他库的弱加密使用
      for (const algo of this.WEAK_ALGORITHMS) {
        const regex = new RegExp(`['"\`]${algo}['"\`]`, 'gi')
        if (regex.test(line) && (line.includes('algorithm') || line.includes('hash') || line.includes('cipher'))) {
          issues.push({
            file,
            line: index + 1,
            column: line.search(regex) + 1,
            message: `检测到弱加密算法: ${algo}`,
            ruleId: 'crypto-weak-algorithm',
            severity: 'high',
            type: 'weak-algorithm',
            recommendation: '建议使用现代、安全的加密算法（如 SHA-256, AES-256）',
            cwe: 'CWE-327'
          })
          break
        }
      }
    })

    return issues
  }

  /**
   * 检测硬编码的加密密钥
   */
  private detectHardcodedKeys(file: string, lines: string[]): CryptoIssue[] {
    const issues: CryptoIssue[] = []

    // 常见的密钥变量名模式
    const keyPatterns = [
      /(?:encryption|crypto|cipher)[\w_]*key\s*[=:]\s*['"`]([^'"`]{16,})['"`]/gi,
      /(?:aes|rsa|secret)[\w_]*key\s*[=:]\s*['"`]([^'"`]{16,})['"`]/gi,
      /key\s*[=:]\s*['"`]([a-fA-F0-9]{32,})['"`]/gi, // 十六进制密钥
      /(?:private|public)Key\s*[=:]\s*['"`]([^'"`]{100,})['"`]/gi, // RSA 密钥
      /iv\s*[=:]\s*['"`]([a-fA-F0-9]{16,})['"`]/gi // 初始化向量
    ]

    lines.forEach((line, index) => {
      // 跳过注释
      if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*')) {
        return
      }

      for (const pattern of keyPatterns) {
        const matches = Array.from(line.matchAll(pattern))
        for (const match of matches) {
          // 排除明显的示例和占位符
          const value = match[1]
          if (this.isLikelyPlaceholder(value)) {
            continue
          }

          issues.push({
            file,
            line: index + 1,
            column: match.index! + 1,
            message: '检测到硬编码的加密密钥',
            ruleId: 'crypto-hardcoded-key',
            severity: 'critical',
            type: 'hardcoded-key',
            recommendation: '密钥应存储在环境变量或安全的密钥管理系统中（如 AWS KMS、HashiCorp Vault）',
            cwe: 'CWE-798'
          })
        }
      }
    })

    return issues
  }

  /**
   * 检测不安全的随机数生成
   */
  private detectInsecureRandom(file: string, lines: string[]): CryptoIssue[] {
    const issues: CryptoIssue[] = []

    lines.forEach((line, index) => {
      // 检查是否在加密相关的上下文中使用 Math.random
      const lowerLine = line.toLowerCase()
      const isCryptoContext = 
        lowerLine.includes('token') ||
        lowerLine.includes('key') ||
        lowerLine.includes('password') ||
        lowerLine.includes('salt') ||
        lowerLine.includes('nonce') ||
        lowerLine.includes('secret') ||
        lowerLine.includes('session')

      for (const pattern of this.INSECURE_RANDOM) {
        if (line.includes(pattern) && isCryptoContext) {
          issues.push({
            file,
            line: index + 1,
            column: line.indexOf(pattern) + 1,
            message: '在安全敏感场景中使用了不安全的随机数生成',
            ruleId: 'crypto-insecure-random',
            severity: 'high',
            type: 'insecure-random',
            recommendation: '使用 crypto.randomBytes() 或 crypto.getRandomValues() 生成加密安全的随机数',
            cwe: 'CWE-338'
          })
          break
        }
      }
    })

    return issues
  }

  /**
   * 检测不安全的 SSL/TLS 配置
   */
  private detectInsecureSSL(file: string, lines: string[]): CryptoIssue[] {
    const issues: CryptoIssue[] = []

    lines.forEach((line, index) => {
      for (const { pattern, desc } of this.INSECURE_SSL_PATTERNS) {
        const match = pattern.exec(line)
        if (match) {
          issues.push({
            file,
            line: index + 1,
            column: match.index + 1,
            message: `不安全的 SSL/TLS 配置: ${desc}`,
            ruleId: 'crypto-insecure-ssl',
            severity: 'critical',
            type: 'ssl-config',
            recommendation: '启用证书验证，使用 TLS 1.2 或更高版本',
            cwe: 'CWE-295'
          })
        }
      })
    })

    return issues
  }

  /**
   * 检测已废弃的加密 API
   */
  private detectDeprecatedCrypto(file: string, lines: string[]): CryptoIssue[] {
    const issues: CryptoIssue[] = []

    lines.forEach((line, index) => {
      for (const api of this.DEPRECATED_ALGORITHMS) {
        if (line.includes(api)) {
          issues.push({
            file,
            line: index + 1,
            column: line.indexOf(api) + 1,
            message: `使用了已废弃的加密 API: ${api}`,
            ruleId: 'crypto-deprecated-api',
            severity: 'medium',
            type: 'deprecated-crypto',
            recommendation: api.includes('Cipher') 
              ? '使用 crypto.createCipheriv() 和 crypto.createDecipheriv() 替代'
              : '查阅 Node.js 文档使用推荐的替代方案',
            cwe: 'CWE-327'
          })
        }
      }
    })

    return issues
  }

  /**
   * 判断是否为占位符或示例值
   */
  private isLikelyPlaceholder(value: string): boolean {
    const placeholders = [
      'your-key-here',
      'your_key_here',
      'example',
      'test',
      'dummy',
      'placeholder',
      'replace-me',
      '123456',
      'xxxxxx',
      'secret'
    ]

    const lowerValue = value.toLowerCase()
    return placeholders.some(p => lowerValue.includes(p)) || value.length < 8
  }

  /**
   * 获取需要扫描的文件列表
   */
  private async getFilesToScan(): Promise<string[]> {
    const patterns = [
      '**/*.ts',
      '**/*.js',
      '**/*.tsx',
      '**/*.jsx',
      '**/*.mjs',
      '**/*.cjs'
    ]

    return await glob(patterns, {
      cwd: this.projectDir,
      ignore: this.exclude,
      absolute: true
    })
  }

  /**
   * 生成加密安全摘要报告
   */
  generateSummary(issues: CryptoIssue[]): {
    total: number
    byType: Record<CryptoIssue['type'], number>
    bySeverity: Record<Severity, number>
    recommendations: string[]
  } {
    const byType: Record<CryptoIssue['type'], number> = {
      'weak-algorithm': 0,
      'hardcoded-key': 0,
      'insecure-random': 0,
      'ssl-config': 0,
      'deprecated-crypto': 0
    }

    const bySeverity: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }

    const recommendations = new Set<string>()

    issues.forEach(issue => {
      byType[issue.type]++
      bySeverity[issue.severity]++
      recommendations.add(issue.recommendation)
    })

    return {
      total: issues.length,
      byType,
      bySeverity,
      recommendations: Array.from(recommendations)
    }
  }
}
