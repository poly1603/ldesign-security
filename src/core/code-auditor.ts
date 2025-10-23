import { ESLint } from 'eslint'
import type { CodeIssue } from '../types'

/**
 * 代码审计器 - 检查代码安全问题
 */
export class CodeAuditor {
  private eslint: ESLint
  
  constructor(private projectDir: string = process.cwd()) {
    this.eslint = new ESLint({
      cwd: projectDir,
      useEslintrc: true
    })
  }
  
  /**
   * 审计代码
   */
  async audit(patterns: string[] = ['src/**/*.{js,ts,jsx,tsx}']): Promise<CodeIssue[]> {
    try {
      const results = await this.eslint.lintFiles(patterns)
      const issues: CodeIssue[] = []
      
      for (const result of results) {
        for (const message of result.messages) {
          // 只关注安全相关的问题
          if (this.isSecurityRelated(message.ruleId || '')) {
            issues.push({
              file: result.filePath,
              line: message.line,
              column: message.column,
              message: message.message,
              ruleId: message.ruleId || 'unknown',
              severity: message.severity === 2 ? 'high' : 'medium'
            })
          }
        }
      }
      
      return issues
    } catch (error) {
      console.warn('代码审计失败:', error)
      return []
    }
  }
  
  /**
   * 判断是否为安全相关的规则
   */
  private isSecurityRelated(ruleId: string): boolean {
    const securityRules = [
      'no-eval',
      'no-implied-eval',
      'no-new-func',
      'no-script-url',
      'security/',
      '@typescript-eslint/no-implied-eval'
    ]
    
    return securityRules.some(rule => ruleId.includes(rule))
  }
}

