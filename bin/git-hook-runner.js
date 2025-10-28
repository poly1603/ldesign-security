#!/usr/bin/env node

/**
 * Git Hook Runner
 * 由 @ldesign/security ContinuousMonitor 自动生成
 * 用于在 Git 钩子中运行安全扫描
 */

const { SecurityScanner } = require('../dist/core/scanner')
const { Logger } = require('../dist/utils/logger')
const path = require('path')
const { existsSync } = require('fs')

const logger = new Logger('GitHookRunner')

// 获取钩子类型和参数
const hookType = process.argv[2]
const args = process.argv.slice(3)

// 配置文件路径
const configPath = path.join(process.cwd(), '.security.config.js')
let config = {}

if (existsSync(configPath)) {
  try {
    config = require(configPath)
  } catch (error) {
    logger.warn(`Failed to load config from ${configPath}: ${error.message}`)
  }
}

// Git 钩子配置
const hookConfig = config.gitHooks || {}
const hookSettings = hookConfig[hookType] || {}

async function runHook() {
  logger.info(`Running ${hookType} security check...`)

  try {
    // 创建扫描器实例
    const scanner = new SecurityScanner()

    // 构建扫描选项
    const scanOptions = {
      projectPath: process.cwd(),
      enabledScanners: hookSettings.scanners || [
        'sensitive-info',
        'injection',
        'crypto',
        'api-security'
      ],
      // 仅扫描暂存的文件（对于 pre-commit）
      ...(hookType === 'pre-commit' && { 
        includeFiles: getStagedFiles() 
      })
    }

    // 执行扫描
    const result = await scanner.scan(scanOptions)

    // 根据配置决定是否阻止提交
    const blockOnVulnerabilities = hookSettings.blockOnVulnerabilities !== false
    const severityThreshold = hookSettings.severityThreshold || 'high'

    const severityLevels = ['low', 'medium', 'high', 'critical']
    const thresholdIndex = severityLevels.indexOf(severityThreshold)

    const criticalVulns = result.vulnerabilities.filter(v => {
      const vulnIndex = severityLevels.indexOf(v.severity)
      return vulnIndex >= thresholdIndex
    })

    if (criticalVulns.length > 0) {
      logger.error(`Found ${criticalVulns.length} vulnerabilities with severity >= ${severityThreshold}`)
      
      // 输出漏洞详情
      criticalVulns.slice(0, 5).forEach(v => {
        logger.error(`  - [${v.severity.toUpperCase()}] ${v.title}`)
        if (v.package) {
          logger.error(`    Package: ${v.package}@${v.installedVersion}`)
        }
        if (v.location) {
          logger.error(`    Location: ${v.location.file}:${v.location.line}`)
        }
      })

      if (criticalVulns.length > 5) {
        logger.error(`  ... and ${criticalVulns.length - 5} more`)
      }

      if (blockOnVulnerabilities) {
        logger.error(`\n❌ ${hookType} blocked due to security vulnerabilities`)
        logger.error(`Run "npm run security:scan" for full details`)
        logger.error(`To skip this check, use --no-verify flag (not recommended)`)
        process.exit(1)
      } else {
        logger.warn(`\n⚠️  Security vulnerabilities found, but not blocking ${hookType}`)
      }
    } else {
      logger.info(`✅ No critical security issues found`)
    }

    process.exit(0)
  } catch (error) {
    logger.error(`Hook execution failed: ${error.message}`)
    
    // 默认不阻止提交（避免因工具错误导致无法提交）
    const failOnError = hookSettings.failOnError === true
    
    if (failOnError) {
      process.exit(1)
    } else {
      logger.warn('Allowing operation to continue despite error')
      process.exit(0)
    }
  }
}

/**
 * 获取暂存的文件列表
 */
function getStagedFiles() {
  try {
    const { execSync } = require('child_process')
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf-8',
      cwd: process.cwd()
    })
    
    return output
      .split('\n')
      .filter(f => f.trim())
      .map(f => path.join(process.cwd(), f))
  } catch (error) {
    logger.warn('Failed to get staged files, scanning all files')
    return undefined
  }
}

// 运行钩子
runHook().catch(error => {
  logger.error(`Unexpected error: ${error.message}`)
  process.exit(1)
})
