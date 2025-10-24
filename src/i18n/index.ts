/**
 * 国际化消息
 */
export const messages = {
  'zh-CN': {
    scan: {
      starting: '正在执行安全扫描...',
      completed: '扫描完成',
      failed: '扫描失败',
      noIssues: '未发现安全问题！',
      foundIssues: '发现 {count} 个安全问题'
    },
    report: {
      generating: '正在生成报告...',
      generated: '报告已生成',
      riskLevel: '风险等级',
      totalIssues: '总问题数',
      duration: '扫描耗时'
    },
    fix: {
      starting: '正在修复漏洞...',
      completed: '修复完成',
      fixed: '修复了 {count} 个漏洞'
    },
    errors: {
      invalidConfig: '配置文件无效',
      scanFailed: '扫描失败',
      fileNotFound: '文件未找到'
    }
  },
  'en-US': {
    scan: {
      starting: 'Starting security scan...',
      completed: 'Scan completed',
      failed: 'Scan failed',
      noIssues: 'No security issues found!',
      foundIssues: 'Found {count} security issue(s)'
    },
    report: {
      generating: 'Generating report...',
      generated: 'Report generated',
      riskLevel: 'Risk Level',
      totalIssues: 'Total Issues',
      duration: 'Scan Duration'
    },
    fix: {
      starting: 'Fixing vulnerabilities...',
      completed: 'Fix completed',
      fixed: 'Fixed {count} vulnerabilities'
    },
    errors: {
      invalidConfig: 'Invalid configuration',
      scanFailed: 'Scan failed',
      fileNotFound: 'File not found'
    }
  },
  'ja-JP': {
    scan: {
      starting: 'セキュリティスキャンを開始しています...',
      completed: 'スキャン完了',
      failed: 'スキャン失敗',
      noIssues: 'セキュリティ問題は見つかりませんでした！',
      foundIssues: '{count} 件のセキュリティ問題が見つかりました'
    },
    report: {
      generating: 'レポートを生成しています...',
      generated: 'レポートが生成されました',
      riskLevel: 'リスクレベル',
      totalIssues: '総問題数',
      duration: 'スキャン時間'
    },
    fix: {
      starting: '脆弱性を修正しています...',
      completed: '修正完了',
      fixed: '{count} 件の脆弱性を修正しました'
    },
    errors: {
      invalidConfig: '無効な設定',
      scanFailed: 'スキャンに失敗しました',
      fileNotFound: 'ファイルが見つかりません'
    }
  }
}

export type Locale = 'zh-CN' | 'en-US' | 'ja-JP'
export type MessageKey = string

let currentLocale: Locale = 'zh-CN'

/**
 * 设置当前语言
 */
export function setLocale(locale: Locale): void {
  currentLocale = locale
}

/**
 * 获取当前语言
 */
export function getLocale(): Locale {
  return currentLocale
}

/**
 * 翻译函数
 */
export function t(key: string, params?: Record<string, any>, locale?: Locale): string {
  const lang = locale || currentLocale
  const keys = key.split('.')

  let message: any = messages[lang]

  for (const k of keys) {
    if (message && typeof message === 'object') {
      message = message[k]
    } else {
      return key // 未找到翻译，返回key
    }
  }

  if (typeof message !== 'string') {
    return key
  }

  // 替换参数
  if (params) {
    return message.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey]?.toString() || match
    })
  }

  return message
}

/**
 * 批量翻译
 */
export function tAll(keys: string[], locale?: Locale): string[] {
  return keys.map(key => t(key, undefined, locale))
}


