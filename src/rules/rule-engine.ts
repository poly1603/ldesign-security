import type { CodeIssue } from '../types'

/**
 * 安全规则定义
 */
export interface SecurityRule {
  id: string
  name: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  pattern: RegExp
  suggestion: string
  category: 'injection' | 'crypto' | 'auth' | 'xss' | 'general'
  enabled: boolean
}

/**
 * 规则执行结果
 */
export interface RuleResult extends CodeIssue {
  rule: SecurityRule
}

/**
 * 自定义规则引擎
 */
export class RuleEngine {
  private rules: SecurityRule[] = []

  constructor() {
    this.loadDefaultRules()
  }

  /**
   * 加载默认规则
   */
  private loadDefaultRules(): void {
    // OWASP Top 10 相关规则
    this.rules.push(
      // A01:2021 – Broken Access Control
      {
        id: 'owasp-a01-access-control',
        name: 'Broken Access Control',
        description: 'Missing or insufficient access control checks',
        severity: 'high',
        pattern: /(?:req\.user|req\.session)\.(?:role|permission)\s*===?\s*['"]admin['"]/gi,
        suggestion: 'Implement proper role-based access control',
        category: 'auth',
        enabled: true
      },
      // A02:2021 – Cryptographic Failures
      {
        id: 'owasp-a02-weak-crypto',
        name: 'Weak Cryptographic Algorithm',
        description: 'Using weak or deprecated cryptographic algorithms',
        severity: 'critical',
        pattern: /createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/gi,
        suggestion: 'Use SHA-256 or stronger algorithms',
        category: 'crypto',
        enabled: true
      },
      // A03:2021 – Injection
      {
        id: 'owasp-a03-sql-injection',
        name: 'SQL Injection',
        description: 'Potential SQL injection vulnerability',
        severity: 'critical',
        pattern: /(?:query|exec|execute)\s*\(\s*['"`].*\$\{.*\}.*['"`]\s*\)/gi,
        suggestion: 'Use parameterized queries',
        category: 'injection',
        enabled: true
      },
      // A04:2021 – Insecure Design
      {
        id: 'owasp-a04-insecure-random',
        name: 'Insecure Random Number Generation',
        description: 'Using Math.random() for security-sensitive operations',
        severity: 'high',
        pattern: /Math\.random\s*\(\s*\)/gi,
        suggestion: 'Use crypto.randomBytes() for secure random numbers',
        category: 'crypto',
        enabled: true
      },
      // A05:2021 – Security Misconfiguration
      {
        id: 'owasp-a05-debug-mode',
        name: 'Debug Mode in Production',
        description: 'Debug mode enabled in production code',
        severity: 'medium',
        pattern: /(?:debug|DEBUG)\s*[:=]\s*true/gi,
        suggestion: 'Disable debug mode in production',
        category: 'general',
        enabled: true
      },
      // A07:2021 – Identification and Authentication Failures
      {
        id: 'owasp-a07-weak-password',
        name: 'Weak Password Validation',
        description: 'Weak or missing password validation',
        severity: 'high',
        pattern: /password\.length\s*[<>=]+\s*[1-6]/gi,
        suggestion: 'Enforce strong password requirements (min 8 chars)',
        category: 'auth',
        enabled: true
      },
      // A08:2021 – Software and Data Integrity Failures
      {
        id: 'owasp-a08-unsafe-deserialization',
        name: 'Unsafe Deserialization',
        description: 'Potentially unsafe deserialization',
        severity: 'critical',
        pattern: /JSON\.parse\s*\(\s*req\./gi,
        suggestion: 'Validate and sanitize input before deserialization',
        category: 'general',
        enabled: true
      },
      // A09:2021 – Security Logging and Monitoring Failures
      {
        id: 'owasp-a09-no-logging',
        name: 'Missing Security Logging',
        description: 'Security events not logged',
        severity: 'medium',
        pattern: /(?:login|authentication|authorization).*(?!log|audit)/gi,
        suggestion: 'Add security event logging',
        category: 'general',
        enabled: true
      },
      // A10:2021 – Server-Side Request Forgery
      {
        id: 'owasp-a10-ssrf',
        name: 'Server-Side Request Forgery',
        description: 'Potential SSRF vulnerability',
        severity: 'high',
        pattern: /(?:fetch|axios|request)\s*\(\s*req\.(?:query|body|params)/gi,
        suggestion: 'Validate and whitelist URLs',
        category: 'injection',
        enabled: true
      }
    )
  }

  /**
   * 添加规则
   */
  addRule(rule: SecurityRule): void {
    this.rules.push(rule)
  }

  /**
   * 移除规则
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId)
  }

  /**
   * 启用/禁用规则
   */
  toggleRule(ruleId: string, enabled: boolean): void {
    const rule = this.rules.find(r => r.id === ruleId)
    if (rule) {
      rule.enabled = enabled
    }
  }

  /**
   * 执行规则检查
   */
  async check(code: string, filename: string): Promise<RuleResult[]> {
    const results: RuleResult[] = []
    const lines = code.split('\n')

    for (const rule of this.rules) {
      if (!rule.enabled) continue

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex]
        const matches = line.matchAll(rule.pattern)

        for (const match of matches) {
          const column = match.index || 0

          results.push({
            file: filename,
            line: lineIndex + 1,
            column: column + 1,
            message: rule.description,
            ruleId: rule.id,
            severity: rule.severity,
            type: 'security',
            suggestion: rule.suggestion,
            rule
          })
        }
      }
    }

    return results
  }

  /**
   * 获取所有规则
   */
  getRules(): SecurityRule[] {
    return this.rules
  }

  /**
   * 按类别获取规则
   */
  getRulesByCategory(category: string): SecurityRule[] {
    return this.rules.filter(r => r.category === category)
  }

  /**
   * 导出规则配置
   */
  exportRules(): string {
    return JSON.stringify(this.rules, null, 2)
  }

  /**
   * 导入规则配置
   */
  importRules(rulesJson: string): void {
    try {
      const rules = JSON.parse(rulesJson) as SecurityRule[]
      this.rules.push(...rules)
    } catch (error) {
      throw new Error('Invalid rules JSON format')
    }
  }
}


