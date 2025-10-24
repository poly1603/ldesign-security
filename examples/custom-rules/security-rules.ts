import type { SecurityRule } from '../../src/rules/rule-engine'

/**
 * 自定义安全规则示例
 */
export const customRules: SecurityRule[] = [
  {
    id: 'custom-hardcoded-url',
    name: 'Hardcoded Production URL',
    description: 'Production URL hardcoded in source code',
    severity: 'medium',
    pattern: /https?:\/\/(?:api|app)\.production\.com/gi,
    suggestion: 'Use environment variables for URLs',
    category: 'general',
    enabled: true
  },
  {
    id: 'custom-console-log',
    name: 'Console.log in Production',
    description: 'Console.log statements should not be in production code',
    severity: 'low',
    pattern: /console\.log\s*\(/gi,
    suggestion: 'Remove console.log or use proper logging',
    category: 'general',
    enabled: true
  },
  {
    id: 'custom-todo-comment',
    name: 'TODO Comments',
    description: 'TODO comments found in code',
    severity: 'low',
    pattern: /\/\/\s*TODO:/gi,
    suggestion: 'Create an issue or fix the TODO',
    category: 'general',
    enabled: false
  },
  {
    id: 'custom-unsafe-regex',
    name: 'Potentially Unsafe Regex',
    description: 'Regex pattern may cause ReDoS',
    severity: 'high',
    pattern: /new RegExp\s*\(\s*.*\+.*\)/gi,
    suggestion: 'Review regex for potential ReDoS vulnerability',
    category: 'general',
    enabled: true
  }
]

/**
 * 使用自定义规则
 */
export async function useCustomRules() {
  const { RuleEngine } = await import('../../src/rules/rule-engine')
  const engine = new RuleEngine()

  // 添加自定义规则
  customRules.forEach(rule => {
    engine.addRule(rule)
  })

  return engine
}

