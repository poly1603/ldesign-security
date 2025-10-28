import { execa } from 'execa'
import { readFile, writeFile, copyFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { Vulnerability } from '../types'

/**
 * 修复结果
 */
export interface FixResult {
  success: boolean
  fixed: string[]
  failed: string[]
  skipped: string[]
  backupCreated: boolean
  backupPath?: string
  details: FixDetail[]
}

/**
 * 修复详情
 */
export interface FixDetail {
  package: string
  from: string
  to: string
  method: 'upgrade' | 'downgrade' | 'replace' | 'remove'
  success: boolean
  error?: string
}

/**
 * 智能修复器配置
 */
export interface SmartFixerOptions {
  projectDir: string
  autoBackup?: boolean
  force?: boolean
  dryRun?: boolean
  maxRetries?: number
}

/**
 * 智能修复器
 * 智能依赖升级、代码自动修复、配置优化、回滚机制
 * 
 * @example
 * ```typescript
 * const fixer = new SmartFixer({
 *   projectDir: './my-project',
 *   autoBackup: true,
 *   force: false
 * })
 * 
 * // 修复漏洞
 * const result = await fixer.fixVulnerabilities(vulnerabilities)
 * console.log(`修复了 ${result.fixed.length} 个漏洞`)
 * 
 * // 如果需要回滚
 * if (!result.success) {
 *   await fixer.rollback(result.backupPath)
 * }
 * ```
 */
export class SmartFixer {
  private projectDir: string
  private options: Required<SmartFixerOptions>
  private backupDir: string

  constructor(options: SmartFixerOptions) {
    this.projectDir = options.projectDir
    this.backupDir = join(this.projectDir, '.security-backups')
    this.options = {
      projectDir: options.projectDir,
      autoBackup: options.autoBackup ?? true,
      force: options.force ?? false,
      dryRun: options.dryRun ?? false,
      maxRetries: options.maxRetries ?? 3
    }
  }

  /**
   * 修复漏洞
   */
  async fixVulnerabilities(vulnerabilities: Vulnerability[]): Promise<FixResult> {
    const result: FixResult = {
      success: false,
      fixed: [],
      failed: [],
      skipped: [],
      backupCreated: false,
      details: []
    }

    // 创建备份
    if (this.options.autoBackup && !this.options.dryRun) {
      try {
        result.backupPath = await this.createBackup()
        result.backupCreated = true
      } catch (error) {
        throw new Error(`备份失败: ${error}`)
      }
    }

    // 按包分组漏洞
    const vulnerabilitiesByPackage = this.groupByPackage(vulnerabilities)

    for (const [packageName, vulns] of Object.entries(vulnerabilitiesByPackage)) {
      try {
        // 只处理有修复版本的漏洞
        const fixable = vulns.filter(v => v.fixAvailable && v.fixVersion)
        
        if (fixable.length === 0) {
          result.skipped.push(packageName)
          continue
        }

        // 选择最高的修复版本
        const targetVersion = this.selectBestFixVersion(fixable)
        
        if (this.options.dryRun) {
          console.log(`[Dry Run] 将会升级 ${packageName} 到 ${targetVersion}`)
          result.fixed.push(packageName)
          continue
        }

        // 尝试升级
        const upgraded = await this.upgradePackage(packageName, targetVersion)
        
        if (upgraded) {
          result.fixed.push(packageName)
          result.details.push({
            package: packageName,
            from: vulns[0].package,
            to: targetVersion,
            method: 'upgrade',
            success: true
          })
        } else {
          result.failed.push(packageName)
          result.details.push({
            package: packageName,
            from: vulns[0].package,
            to: targetVersion,
            method: 'upgrade',
            success: false,
            error: '升级失败'
          })
        }
      } catch (error) {
        result.failed.push(packageName)
        result.details.push({
          package: packageName,
          from: vulns[0].package,
          to: 'unknown',
          method: 'upgrade',
          success: false,
          error: String(error)
        })
      }
    }

    result.success = result.failed.length === 0

    return result
  }

  /**
   * 智能升级依赖
   */
  async smartUpgrade(packages?: string[]): Promise<FixResult> {
    const result: FixResult = {
      success: false,
      fixed: [],
      failed: [],
      skipped: [],
      backupCreated: false,
      details: []
    }

    // 创建备份
    if (this.options.autoBackup && !this.options.dryRun) {
      result.backupPath = await this.createBackup()
      result.backupCreated = true
    }

    try {
      const packageManager = await this.detectPackageManager()
      
      if (packages && packages.length > 0) {
        // 升级指定包
        for (const pkg of packages) {
          const upgraded = await this.upgradePackage(pkg)
          if (upgraded) {
            result.fixed.push(pkg)
          } else {
            result.failed.push(pkg)
          }
        }
      } else {
        // 升级所有过时的包
        const outdated = await this.getOutdatedPackages()
        
        for (const pkg of outdated) {
          const upgraded = await this.upgradePackage(pkg.name, pkg.latest)
          if (upgraded) {
            result.fixed.push(pkg.name)
            result.details.push({
              package: pkg.name,
              from: pkg.current,
              to: pkg.latest,
              method: 'upgrade',
              success: true
            })
          } else {
            result.failed.push(pkg.name)
          }
        }
      }

      result.success = result.failed.length === 0
    } catch (error) {
      result.success = false
    }

    return result
  }

  /**
   * 回滚到备份
   */
  async rollback(backupPath?: string): Promise<boolean> {
    if (!backupPath) {
      throw new Error('未提供备份路径')
    }

    if (!existsSync(backupPath)) {
      throw new Error(`备份文件不存在: ${backupPath}`)
    }

    try {
      // 恢复 package.json
      const packageJsonBackup = join(backupPath, 'package.json')
      if (existsSync(packageJsonBackup)) {
        await copyFile(packageJsonBackup, join(this.projectDir, 'package.json'))
      }

      // 恢复 package-lock.json / yarn.lock / pnpm-lock.yaml
      const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']
      for (const lockFile of lockFiles) {
        const lockBackup = join(backupPath, lockFile)
        if (existsSync(lockBackup)) {
          await copyFile(lockBackup, join(this.projectDir, lockFile))
        }
      }

      // 重新安装依赖
      const packageManager = await this.detectPackageManager()
      await execa(packageManager, ['install'], { cwd: this.projectDir })

      console.log('✅ 回滚成功')
      return true
    } catch (error) {
      console.error('❌ 回滚失败:', error)
      return false
    }
  }

  /**
   * 创建备份
   */
  private async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = join(this.backupDir, `backup-${timestamp}`)

    // 确保备份目录存在
    const fs = await import('fs-extra')
    await fs.ensureDir(backupPath)

    // 备份 package.json
    const packageJsonPath = join(this.projectDir, 'package.json')
    if (existsSync(packageJsonPath)) {
      await copyFile(packageJsonPath, join(backupPath, 'package.json'))
    }

    // 备份锁文件
    const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']
    for (const lockFile of lockFiles) {
      const lockPath = join(this.projectDir, lockFile)
      if (existsSync(lockPath)) {
        await copyFile(lockPath, join(backupPath, lockFile))
      }
    }

    console.log(`📦 备份已创建: ${backupPath}`)
    return backupPath
  }

  /**
   * 升级包
   */
  private async upgradePackage(packageName: string, version?: string): Promise<boolean> {
    try {
      const packageManager = await this.detectPackageManager()
      const target = version ? `${packageName}@${version}` : `${packageName}@latest`

      const args = packageManager === 'npm' 
        ? ['install', target, '--save']
        : ['add', target]

      await execa(packageManager, args, {
        cwd: this.projectDir,
        timeout: 120000 // 2 minutes
      })

      return true
    } catch (error) {
      console.error(`升级 ${packageName} 失败:`, error)
      return false
    }
  }

  /**
   * 检测包管理器
   */
  private async detectPackageManager(): Promise<'npm' | 'yarn' | 'pnpm'> {
    if (existsSync(join(this.projectDir, 'pnpm-lock.yaml'))) {
      return 'pnpm'
    }
    if (existsSync(join(this.projectDir, 'yarn.lock'))) {
      return 'yarn'
    }
    return 'npm'
  }

  /**
   * 获取过时的包
   */
  private async getOutdatedPackages(): Promise<Array<{ name: string; current: string; latest: string }>> {
    try {
      const packageManager = await this.detectPackageManager()
      
      if (packageManager === 'npm') {
        const { stdout } = await execa('npm', ['outdated', '--json'], { 
          cwd: this.projectDir,
          reject: false 
        })
        
        const outdated = JSON.parse(stdout || '{}')
        return Object.entries(outdated).map(([name, info]: [string, any]) => ({
          name,
          current: info.current,
          latest: info.latest
        }))
      } else if (packageManager === 'yarn') {
        const { stdout } = await execa('yarn', ['outdated', '--json'], { 
          cwd: this.projectDir,
          reject: false 
        })
        
        const lines = stdout.split('\n').filter(l => l.trim())
        return lines.map(line => {
          const data = JSON.parse(line)
          return {
            name: data.name,
            current: data.current,
            latest: data.latest
          }
        }).filter(Boolean)
      }
    } catch (error) {
      console.warn('获取过时包列表失败:', error)
    }

    return []
  }

  /**
   * 按包分组漏洞
   */
  private groupByPackage(vulnerabilities: Vulnerability[]): Record<string, Vulnerability[]> {
    const grouped: Record<string, Vulnerability[]> = {}

    for (const vuln of vulnerabilities) {
      if (!grouped[vuln.package]) {
        grouped[vuln.package] = []
      }
      grouped[vuln.package].push(vuln)
    }

    return grouped
  }

  /**
   * 选择最佳修复版本
   */
  private selectBestFixVersion(vulnerabilities: Vulnerability[]): string {
    // 选择最高的修复版本
    const versions = vulnerabilities
      .filter(v => v.fixVersion)
      .map(v => v.fixVersion!)
      .sort((a, b) => this.compareVersions(b, a))

    return versions[0] || 'latest'
  }

  /**
   * 比较版本号
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number)
    const bParts = b.split('.').map(Number)

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0
      const bVal = bParts[i] || 0

      if (aVal > bVal) return 1
      if (aVal < bVal) return -1
    }

    return 0
  }
}
