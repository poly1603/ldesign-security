import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'path'
import type { SecurityScanResult } from '../types'
import { SecurityScanner } from './security-scanner'

/**
 * 增量扫描器 - 只扫描变更的文件
 */
export class IncrementalScanner {
  constructor(private projectDir: string = process.cwd()) { }

  /**
   * 获取变更的文件
   */
  async getChangedFiles(since?: Date): Promise<string[]> {
    try {
      // 尝试使用 Git
      const gitFiles = await this.getGitChangedFiles(since)
      if (gitFiles.length > 0) {
        return gitFiles
      }

      // 回退到时间戳对比
      if (since) {
        return await this.getFilesByTimestamp(since)
      }

      // 默认返回所有文件
      return []
    } catch (error) {
      console.warn('无法获取变更文件，将执行完整扫描')
      return []
    }
  }

  /**
   * 使用 Git 获取变更文件
   */
  private async getGitChangedFiles(since?: Date): Promise<string[]> {
    try {
      // 检查是否是 Git 仓库
      await execa('git', ['rev-parse', '--git-dir'], {
        cwd: this.projectDir
      })

      let args: string[]

      if (since) {
        // 获取指定时间以来的变更
        const sinceStr = since.toISOString()
        args = ['diff', '--name-only', `--since=${sinceStr}`, 'HEAD']
      } else {
        // 获取未提交的变更
        args = ['diff', '--name-only', 'HEAD']
      }

      const { stdout } = await execa('git', args, {
        cwd: this.projectDir,
        reject: false
      })

      if (!stdout.trim()) {
        // 如果没有未提交的变更，获取最近一次提交的变更
        const { stdout: latestDiff } = await execa('git', ['diff', '--name-only', 'HEAD~1', 'HEAD'], {
          cwd: this.projectDir,
          reject: false
        })
        return latestDiff.split('\n').filter(Boolean)
      }

      return stdout.split('\n').filter(Boolean)
    } catch (error) {
      return []
    }
  }

  /**
   * 根据时间戳获取文件
   */
  private async getFilesByTimestamp(since: Date): Promise<string[]> {
    const changedFiles: string[] = []
    const sinceTime = since.getTime()

    const scanDirs = ['src', 'lib', 'app']

    for (const dir of scanDirs) {
      const dirPath = path.join(this.projectDir, dir)

      if (await fs.pathExists(dirPath)) {
        const files = await this.walkDirectory(dirPath)

        for (const file of files) {
          try {
            const stats = await fs.stat(file)
            if (stats.mtimeMs > sinceTime) {
              changedFiles.push(path.relative(this.projectDir, file))
            }
          } catch {
            // 忽略无法访问的文件
          }
        }
      }
    }

    return changedFiles
  }

  /**
   * 递归遍历目录
   */
  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = []

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            const subFiles = await this.walkDirectory(fullPath)
            files.push(...subFiles)
          }
        } else if (entry.isFile()) {
          files.push(fullPath)
        }
      }
    } catch (error) {
      // 忽略无法访问的目录
    }

    return files
  }

  /**
   * 执行增量扫描
   */
  async scanIncremental(options: {
    since?: Date
    baseline?: SecurityScanResult
  } = {}): Promise<SecurityScanResult> {
    const changedFiles = await this.getChangedFiles(options.since)

    if (changedFiles.length === 0) {
      console.log('未检测到变更文件，跳过扫描')
      return this.createEmptyResult()
    }

    console.log(`检测到 ${changedFiles.length} 个变更文件，执行增量扫描...`)

    // 使用 SecurityScanner 扫描变更文件
    const scanner = new SecurityScanner({
      projectDir: this.projectDir
    })

    const result = await scanner.scan()

    // 如果有基线，进行对比
    if (options.baseline) {
      return this.compareWithBaseline(result, options.baseline)
    }

    return result
  }

  /**
   * 与基线对比
   */
  private compareWithBaseline(
    current: SecurityScanResult,
    baseline: SecurityScanResult
  ): SecurityScanResult {
    // 标记新增的问题
    const result = { ...current }

    // 这里可以添加更复杂的对比逻辑
    // 比如标记新增/修复的问题

    return result
  }

  /**
   * 创建空结果
   */
  private createEmptyResult(): SecurityScanResult {
    return {
      vulnerabilities: [],
      codeIssues: [],
      dependencyIssues: [],
      riskLevel: 'none',
      duration: 0,
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    }
  }

  /**
   * 保存基线
   */
  async saveBaseline(result: SecurityScanResult): Promise<void> {
    const baselinePath = path.join(this.projectDir, '.security-baseline.json')
    await fs.writeJSON(baselinePath, result, { spaces: 2 })
  }

  /**
   * 加载基线
   */
  async loadBaseline(): Promise<SecurityScanResult | null> {
    try {
      const baselinePath = path.join(this.projectDir, '.security-baseline.json')
      if (await fs.pathExists(baselinePath)) {
        return await fs.readJSON(baselinePath)
      }
    } catch (error) {
      // 忽略
    }
    return null
  }
}


