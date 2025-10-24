import fs from 'fs-extra'
import path from 'path'
import fg from 'fast-glob'
import type { InjectionIssue } from '../types'

/**
 * 注入攻击检测器 - 检测 SQL 注入、XSS、命令注入等
 */
export class InjectionDetector {
  private patterns: Array<{
    type: InjectionIssue['type']
    pattern: RegExp
    severity: 'critical' | 'high' | 'medium' | 'low'
    description: string
    suggestion: string
  }> = [
      // SQL 注入
      {
        type: 'sql',
        pattern: /(?:query|execute|exec)\s*\(\s*['"`].*\$\{.*\}.*['"`]\s*\)/gi,
        severity: 'critical',
        description: 'SQL 查询使用字符串拼接，可能导致 SQL 注入',
        suggestion: '使用参数化查询或 ORM 框架'
      },
      {
        type: 'sql',
        pattern: /(?:query|execute|exec)\s*\(\s*.*\+.*\)/gi,
        severity: 'critical',
        description: 'SQL 查询使用字符串拼接，可能导致 SQL 注入',
        suggestion: '使用参数化查询或 ORM 框架'
      },
      {
        type: 'sql',
        pattern: /['"]SELECT\s+.*FROM\s+.*WHERE\s+.*['"].*\+/gi,
        severity: 'critical',
        description: 'SQL 语句使用字符串拼接，存在注入风险',
        suggestion: '使用参数化查询或预编译语句'
      },
      // XSS
      {
        type: 'xss',
        pattern: /innerHTML\s*=(?!\s*['"`]\s*['"`])/gi,
        severity: 'high',
        description: '直接设置 innerHTML 可能导致 XSS 攻击',
        suggestion: '使用 textContent 或框架提供的安全方法'
      },
      {
        type: 'xss',
        pattern: /outerHTML\s*=/gi,
        severity: 'high',
        description: '直接设置 outerHTML 可能导致 XSS 攻击',
        suggestion: '使用框架提供的安全方法'
      },
      {
        type: 'xss',
        pattern: /document\.write\s*\(/gi,
        severity: 'high',
        description: 'document.write 可能导致 XSS 攻击',
        suggestion: '使用现代 DOM 操作方法'
      },
      {
        type: 'xss',
        pattern: /dangerouslySetInnerHTML/gi,
        severity: 'high',
        description: 'dangerouslySetInnerHTML 可能导致 XSS 攻击',
        suggestion: '确保内容已经过 HTML 编码或使用 DOMPurify'
      },
      {
        type: 'xss',
        pattern: /v-html\s*=/gi,
        severity: 'high',
        description: 'v-html 指令可能导致 XSS 攻击',
        suggestion: '确保内容已经过 HTML 编码或使用 v-text'
      },
      // 命令注入
      {
        type: 'command',
        pattern: /exec\s*\(\s*['"`].*\$\{.*\}.*['"`]/gi,
        severity: 'critical',
        description: '使用模板字符串执行命令，可能导致命令注入',
        suggestion: '使用 execFile 并传递参数数组，避免 shell 解析'
      },
      {
        type: 'command',
        pattern: /spawn\s*\(\s*['"`]sh['"`]|spawn\s*\(\s*['"`]bash['"`]/gi,
        severity: 'critical',
        description: '直接调用 shell 可能导致命令注入',
        suggestion: '使用 spawn 的数组参数形式，避免 shell 解析'
      },
      {
        type: 'command',
        pattern: /child_process\.exec\s*\(/gi,
        severity: 'high',
        description: 'child_process.exec 可能导致命令注入',
        suggestion: '使用 execFile 或 spawn，并验证所有输入'
      },
      {
        type: 'command',
        pattern: /shell:\s*true/gi,
        severity: 'high',
        description: '启用 shell 选项可能导致命令注入',
        suggestion: '避免使用 shell 选项，或严格验证所有输入'
      },
      // SSRF
      {
        type: 'ssrf',
        pattern: /(?:fetch|axios|request|http\.get|https\.get)\s*\(\s*.*\$\{.*\}/gi,
        severity: 'high',
        description: 'HTTP 请求使用用户输入的 URL，可能导致 SSRF 攻击',
        suggestion: '验证和白名单 URL，禁止访问内网地址'
      },
      {
        type: 'ssrf',
        pattern: /(?:fetch|axios|request)\s*\(\s*req\.(?:query|body|params)/gi,
        severity: 'high',
        description: '直接使用用户输入作为 URL，可能导致 SSRF 攻击',
        suggestion: '验证 URL 格式并使用白名单'
      },
      // 路径遍历
      {
        type: 'path-traversal',
        pattern: /(?:readFile|writeFile|readdir|stat)\s*\(\s*.*(?:req\.query|req\.body|req\.params)/gi,
        severity: 'critical',
        description: '文件操作使用用户输入的路径，可能导致路径遍历攻击',
        suggestion: '验证和规范化路径，限制访问范围'
      },
      {
        type: 'path-traversal',
        pattern: /path\.join\s*\(\s*.*req\./gi,
        severity: 'high',
        description: '路径拼接使用用户输入，可能导致路径遍历',
        suggestion: '使用 path.resolve 和 path.normalize，并验证结果路径'
      }
    ]

  constructor(private projectDir: string = process.cwd()) { }

  /**
   * 检测注入攻击
   */
  async detect(patterns?: string[]): Promise<InjectionIssue[]> {
    const issues: InjectionIssue[] = []

    try {
      const scanPatterns = patterns || [
        '**/*.{js,ts,jsx,tsx,vue}',
        '!**/node_modules/**',
        '!**/dist/**',
        '!**/build/**',
        '!**/.git/**',
        '!**/*.test.{js,ts,jsx,tsx}',
        '!**/*.spec.{js,ts,jsx,tsx}'
      ]

      const files = await fg(scanPatterns, {
        cwd: this.projectDir,
        absolute: true
      })

      for (const file of files) {
        const fileIssues = await this.detectInFile(file)
        issues.push(...fileIssues)
      }

      return issues
    } catch (error) {
      console.warn('注入攻击检测失败:', error)
      return []
    }
  }

  /**
   * 检测文件中的注入问题
   */
  private async detectInFile(filePath: string): Promise<InjectionIssue[]> {
    const issues: InjectionIssue[] = []

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex]

        // 跳过注释
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
          continue
        }

        for (const pattern of this.patterns) {
          const matches = line.matchAll(pattern.pattern)

          for (const match of matches) {
            const column = match.index || 0

            issues.push({
              file: path.relative(this.projectDir, filePath),
              line: lineIndex + 1,
              column: column + 1,
              type: pattern.type,
              code: line.trim(),
              severity: pattern.severity,
              description: pattern.description,
              suggestion: pattern.suggestion
            })
          }
        }
      }

      return issues
    } catch (error) {
      return []
    }
  }

  /**
   * 添加自定义检测模式
   */
  addPattern(pattern: {
    type: InjectionIssue['type']
    pattern: RegExp
    severity: 'critical' | 'high' | 'medium' | 'low'
    description: string
    suggestion: string
  }): void {
    this.patterns.push(pattern)
  }

  /**
   * 检测特定类型的注入
   */
  async detectByType(type: InjectionIssue['type'], patterns?: string[]): Promise<InjectionIssue[]> {
    const allIssues = await this.detect(patterns)
    return allIssues.filter(issue => issue.type === type)
  }
}


