import type { SecurityPolicy } from '../types'
import { logger } from '../utils/logger'

/**
 * 交互式配置向导（简化版本）
 * 完整版本应使用 inquirer 库
 */
export async function runInteractiveWizard(): Promise<SecurityPolicy> {
  logger.info('Starting interactive configuration wizard...')
  logger.info('(Full interactive mode requires inquirer package)')

  // 生成默认配置
  const policy: SecurityPolicy = {
    scan: {
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
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
        'ISC'
      ],
      blacklist: [],
      allowUnknown: false
    },
    notifications: {
      enabled: false
    },
    reports: {
      format: ['html', 'json'],
      output: './security-reports',
      includeCharts: true,
      includeDependencyGraph: false
    }
  }

  logger.success('Generated default configuration')
  logger.info('You can customize this configuration in .securityrc.json')

  return policy
}

/**
 * 配置向导步骤
 */
export interface WizardStep {
  name: string
  message: string
  type: 'input' | 'list' | 'confirm' | 'checkbox'
  choices?: string[]
  default?: any
  validate?: (value: any) => boolean | string
}

/**
 * 向导步骤定义
 */
export const wizardSteps: WizardStep[] = [
  {
    name: 'scanSeverity',
    message: 'Minimum severity level to report?',
    type: 'list',
    choices: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  {
    name: 'failOnSeverity',
    message: 'Fail build on which severity?',
    type: 'list',
    choices: ['low', 'medium', 'high', 'critical'],
    default: 'high'
  },
  {
    name: 'reportFormats',
    message: 'Select report formats to generate:',
    type: 'checkbox',
    choices: ['html', 'json', 'yaml', 'markdown', 'sarif', 'pdf'],
    default: ['html', 'json']
  },
  {
    name: 'enableNotifications',
    message: 'Enable notifications?',
    type: 'confirm',
    default: false
  }
]


