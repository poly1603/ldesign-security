import fs from 'fs-extra'
import path from 'path'
import { execa } from 'execa'
import type { SupplyChainIssue } from '../types'

/**
 * 供应链分析器 - 检测 typosquatting、恶意包等供应链攻击
 */
export class SupplyChainAnalyzer {
  // 流行包名列表（用于检测 typosquatting）
  private static POPULAR_PACKAGES = [
    'react', 'vue', 'angular', 'lodash', 'axios', 'express', 'webpack',
    'typescript', 'eslint', 'prettier', 'babel', 'jest', 'mocha', 'chai',
    'moment', 'dayjs', 'redux', 'mobx', 'rxjs', 'socket.io', 'nodemon'
  ]

  constructor(private projectDir: string = process.cwd()) { }

  /**
   * 分析供应链安全
   */
  async analyze(): Promise<SupplyChainIssue[]> {
    const issues: SupplyChainIssue[] = []

    try {
      const [
        typosquattingIssues,
        maintainerIssues,
        popularityIssues,
        integrityIssues
      ] = await Promise.all([
        this.detectTyposquatting(),
        this.checkMaintainers(),
        this.checkPopularity(),
        this.verifyIntegrity()
      ])

      issues.push(
        ...typosquattingIssues,
        ...maintainerIssues,
        ...popularityIssues,
        ...integrityIssues
      )

      return issues
    } catch (error) {
      console.warn('供应链分析失败:', error)
      return []
    }
  }

  /**
   * 检测 typosquatting 攻击
   */
  private async detectTyposquatting(): Promise<SupplyChainIssue[]> {
    const issues: SupplyChainIssue[] = []

    try {
      const packageJson = await this.getPackageJson()
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }

      for (const pkgName of Object.keys(allDeps)) {
        // 检查是否与流行包名相似
        for (const popularPkg of SupplyChainAnalyzer.POPULAR_PACKAGES) {
          const similarity = this.calculateSimilarity(pkgName, popularPkg)

          // 相似度高但不完全相同，可能是 typosquatting
          if (similarity > 0.7 && similarity < 1.0) {
            issues.push({
              package: pkgName,
              version: allDeps[pkgName],
              type: 'typosquatting',
              severity: 'high',
              description: `包名与流行包 "${popularPkg}" 非常相似，可能是 typosquatting 攻击`,
              evidence: [
                `包名: ${pkgName}`,
                `相似包: ${popularPkg}`,
                `相似度: ${(similarity * 100).toFixed(1)}%`
              ],
              recommendation: `确认是否误安装了 "${popularPkg}"，如果是请卸载 "${pkgName}" 并安装正确的包`,
              score: similarity
            })
          }
        }

        // 检查常见的拼写错误模式
        const typoPattern = this.detectTypoPattern(pkgName)
        if (typoPattern) {
          issues.push({
            package: pkgName,
            version: allDeps[pkgName],
            type: 'typosquatting',
            severity: 'high',
            description: typoPattern.description,
            evidence: typoPattern.evidence,
            recommendation: typoPattern.recommendation,
            score: typoPattern.confidence
          })
        }
      }

      return issues
    } catch (error) {
      return []
    }
  }

  /**
   * 计算字符串相似度（Levenshtein 距离）
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length
    const len2 = str2.length
    const matrix: number[][] = []

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        )
      }
    }

    const distance = matrix[len1][len2]
    const maxLen = Math.max(len1, len2)
    return 1 - distance / maxLen
  }

  /**
   * 检测拼写错误模式
   */
  private detectTypoPattern(pkgName: string): {
    description: string
    evidence: string[]
    recommendation: string
    confidence: number
  } | null {
    // 常见的拼写错误模式
    const patterns = [
      { wrong: 'requset', correct: 'request', confidence: 0.95 },
      { wrong: 'reacr', correct: 'react', confidence: 0.95 },
      { wrong: 'vuejs', correct: 'vue', confidence: 0.8 },
      { wrong: 'lodsh', correct: 'lodash', confidence: 0.9 },
      { wrong: 'expresss', correct: 'express', confidence: 0.9 },
      { wrong: 'webpackk', correct: 'webpack', confidence: 0.9 }
    ]

    for (const pattern of patterns) {
      if (pkgName.toLowerCase().includes(pattern.wrong)) {
        return {
          description: `包名包含常见拼写错误 "${pattern.wrong}"，正确拼写应为 "${pattern.correct}"`,
          evidence: [
            `包名: ${pkgName}`,
            `可疑部分: ${pattern.wrong}`,
            `可能想要: ${pattern.correct}`
          ],
          recommendation: `检查是否想安装 "${pattern.correct}" 而非 "${pkgName}"`,
          confidence: pattern.confidence
        }
      }
    }

    return null
  }

  /**
   * 检查维护者信息
   */
  private async checkMaintainers(): Promise<SupplyChainIssue[]> {
    const issues: SupplyChainIssue[] = []

    try {
      const packageJson = await this.getPackageJson()
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }

      for (const [pkgName, version] of Object.entries(allDeps)) {
        try {
          // 获取包的 npm 信息
          const info = await this.getNpmPackageInfo(pkgName)

          if (info) {
            // 检查是否有维护者
            if (!info.maintainers || info.maintainers.length === 0) {
              issues.push({
                package: pkgName,
                version: version as string,
                type: 'maintainer',
                severity: 'medium',
                description: '包没有维护者信息',
                evidence: ['维护者列表为空'],
                recommendation: '谨慎使用无维护者的包，考虑寻找替代方案'
              })
            }

            // 检查包是否被废弃
            if (info.deprecated) {
              issues.push({
                package: pkgName,
                version: version as string,
                type: 'maintainer',
                severity: 'high',
                description: '包已被废弃',
                evidence: [`废弃信息: ${info.deprecated}`],
                recommendation: '尽快迁移到推荐的替代包'
              })
            }
          }
        } catch {
          // 忽略单个包的检查失败
        }
      }

      return issues
    } catch (error) {
      return []
    }
  }

  /**
   * 检查包的流行度和可信度
   */
  private async checkPopularity(): Promise<SupplyChainIssue[]> {
    const issues: SupplyChainIssue[] = []

    try {
      const packageJson = await this.getPackageJson()
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }

      for (const [pkgName, version] of Object.entries(allDeps)) {
        try {
          const info = await this.getNpmPackageInfo(pkgName)

          if (info) {
            // 检查下载量（如果可用）
            const weeklyDownloads = info.downloads?.weekly || 0

            // 新包但下载量很少
            const createdDate = new Date(info.time?.created || 0)
            const daysSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)

            if (daysSinceCreation < 30 && weeklyDownloads < 100) {
              issues.push({
                package: pkgName,
                version: version as string,
                type: 'popularity',
                severity: 'medium',
                description: '包发布时间较短且下载量较少',
                evidence: [
                  `创建时间: ${createdDate.toLocaleDateString()}`,
                  `每周下载: ${weeklyDownloads}`,
                  `天数: ${Math.floor(daysSinceCreation)} 天`
                ],
                recommendation: '新包可能存在未知风险，建议等待社区验证或选择更成熟的替代方案'
              })
            }

            // 没有仓库信息
            if (!info.repository) {
              issues.push({
                package: pkgName,
                version: version as string,
                type: 'popularity',
                severity: 'low',
                description: '包没有源代码仓库信息',
                evidence: ['repository 字段缺失'],
                recommendation: '无法审查源代码，建议谨慎使用'
              })
            }
          }
        } catch {
          // 忽略单个包的检查失败
        }
      }

      return issues
    } catch (error) {
      return []
    }
  }

  /**
   * 验证包的完整性
   */
  private async verifyIntegrity(): Promise<SupplyChainIssue[]> {
    const issues: SupplyChainIssue[] = []

    try {
      // 检查 package-lock.json 是否存在
      const lockFilePath = path.join(this.projectDir, 'package-lock.json')
      const hasLockFile = await fs.pathExists(lockFilePath)

      if (!hasLockFile) {
        issues.push({
          package: 'project',
          version: '0.0.0',
          type: 'integrity',
          severity: 'high',
          description: '项目缺少 package-lock.json 文件',
          evidence: ['未找到 package-lock.json'],
          recommendation: '运行 npm install 生成 lock 文件以确保依赖版本一致性'
        })
      } else {
        // 验证 lock 文件完整性
        try {
          const lockFile = await fs.readJSON(lockFilePath)

          if (!lockFile.lockfileVersion) {
            issues.push({
              package: 'project',
              version: '0.0.0',
              type: 'integrity',
              severity: 'medium',
              description: 'package-lock.json 格式可能不正确',
              evidence: ['缺少 lockfileVersion 字段'],
              recommendation: '重新生成 lock 文件'
            })
          }
        } catch {
          issues.push({
            package: 'project',
            version: '0.0.0',
            type: 'integrity',
            severity: 'high',
            description: 'package-lock.json 文件损坏',
            evidence: ['无法解析 JSON'],
            recommendation: '删除并重新生成 lock 文件'
          })
        }
      }

      return issues
    } catch (error) {
      return []
    }
  }

  /**
   * 获取 NPM 包信息
   */
  private async getNpmPackageInfo(packageName: string): Promise<any> {
    try {
      const { stdout } = await execa('npm', ['view', packageName, '--json'], {
        cwd: this.projectDir,
        reject: false
      })

      return JSON.parse(stdout)
    } catch (error) {
      return null
    }
  }

  /**
   * 获取 package.json
   */
  private async getPackageJson(): Promise<any> {
    const packageJsonPath = path.join(this.projectDir, 'package.json')
    return await fs.readJSON(packageJsonPath)
  }

  /**
   * 生成供应链风险评分
   */
  calculateRiskScore(issues: SupplyChainIssue[]): number {
    let score = 0

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score += 10
          break
        case 'high':
          score += 7
          break
        case 'medium':
          score += 4
          break
        case 'low':
          score += 1
          break
      }
    }

    // 归一化到 0-100
    return Math.min(100, score)
  }
}


