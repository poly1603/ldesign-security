import fs from 'fs-extra'
import path from 'path'
import type { DependencyIssue } from '../types'

/**
 * 依赖扫描器 - 扫描依赖安全问题
 */
export class DependencyScanner {
  constructor(private projectDir: string = process.cwd()) {}
  
  /**
   * 扫描依赖
   */
  async scan(): Promise<DependencyIssue[]> {
    const issues: DependencyIssue[] = []
    
    try {
      const packageJsonPath = path.join(this.projectDir, 'package.json')
      const packageJson = await fs.readJSON(packageJsonPath)
      
      // 检查过时的包
      const outdatedIssues = await this.checkOutdatedPackages(packageJson)
      issues.push(...outdatedIssues)
      
      // 检查不安全的协议
      const protocolIssues = this.checkUnsafeProtocols(packageJson)
      issues.push(...protocolIssues)
      
      return issues
    } catch (error) {
      console.warn('依赖扫描失败:', error)
      return []
    }
  }
  
  /**
   * 检查过时的包
   */
  private async checkOutdatedPackages(packageJson: any): Promise<DependencyIssue[]> {
    const issues: DependencyIssue[] = []
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    }
    
    // 检查已知的不安全版本
    const unsafeVersions: Record<string, string[]> = {
      'lodash': ['< 4.17.21'],
      'axios': ['< 0.21.1'],
      'node-fetch': ['< 2.6.7']
    }
    
    for (const [pkg, unsafeVers] of Object.entries(unsafeVersions)) {
      if (allDeps[pkg]) {
        issues.push({
          package: pkg,
          version: allDeps[pkg],
          issue: `可能存在安全风险的版本`,
          severity: 'medium',
          recommendation: `建议更新到最新版本`
        })
      }
    }
    
    return issues
  }
  
  /**
   * 检查不安全的协议
   */
  private checkUnsafeProtocols(packageJson: any): DependencyIssue[] {
    const issues: DependencyIssue[] = []
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    }
    
    for (const [pkg, version] of Object.entries(allDeps)) {
      if (typeof version === 'string' && version.startsWith('git://')) {
        issues.push({
          package: pkg,
          version,
          issue: '使用不安全的 git:// 协议',
          severity: 'high',
          recommendation: '改用 https:// 或 git+https:// 协议'
        })
      }
    }
    
    return issues
  }
}

