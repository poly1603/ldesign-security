import fs from 'fs-extra'
import path from 'path'
import { SecurityScanner } from './security-scanner'
import type { SecurityScanResult } from '../types'
import { logger } from '../utils/logger'

/**
 * 项目配置
 */
export interface Project {
  id: string
  name: string
  path: string
  enabled: boolean
  config?: any
}

/**
 * 项目对比结果
 */
export interface ComparisonResult {
  projects: Array<{
    id: string
    name: string
    result: SecurityScanResult
  }>
  comparison: {
    totalIssues: number[]
    riskLevels: string[]
    worstProject: string
    bestProject: string
  }
}

/**
 * 多项目管理器
 */
export class ProjectManager {
  private configPath: string
  private projects: Project[] = []

  constructor(private workspaceDir: string = process.cwd()) {
    this.configPath = path.join(workspaceDir, '.security-projects.json')
  }

  /**
   * 加载项目配置
   */
  async loadProjects(): Promise<Project[]> {
    try {
      if (await fs.pathExists(this.configPath)) {
        const config = await fs.readJSON(this.configPath)
        this.projects = config.projects || []
      } else {
        // 自动发现项目
        this.projects = await this.discoverProjects()
      }

      return this.projects
    } catch (error) {
      logger.error('Failed to load projects', error as Error)
      return []
    }
  }

  /**
   * 自动发现项目
   */
  private async discoverProjects(): Promise<Project[]> {
    const projects: Project[] = []

    try {
      const entries = await fs.readdir(this.workspaceDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const projectPath = path.join(this.workspaceDir, entry.name)
          const packageJsonPath = path.join(projectPath, 'package.json')

          if (await fs.pathExists(packageJsonPath)) {
            const packageJson = await fs.readJSON(packageJsonPath)

            projects.push({
              id: entry.name,
              name: packageJson.name || entry.name,
              path: projectPath,
              enabled: true
            })
          }
        }
      }
    } catch (error) {
      logger.error('Project discovery failed', error as Error)
    }

    return projects
  }

  /**
   * 保存项目配置
   */
  async saveProjects(): Promise<void> {
    await fs.writeJSON(this.configPath, { projects: this.projects }, { spaces: 2 })
  }

  /**
   * 添加项目
   */
  async addProject(project: Omit<Project, 'id'>): Promise<void> {
    const id = this.generateProjectId(project.name)
    this.projects.push({ ...project, id })
    await this.saveProjects()
  }

  /**
   * 移除项目
   */
  async removeProject(id: string): Promise<void> {
    this.projects = this.projects.filter(p => p.id !== id)
    await this.saveProjects()
  }

  /**
   * 扫描所有项目
   */
  async scanAll(parallel: boolean = true): Promise<Map<string, SecurityScanResult>> {
    await this.loadProjects()
    const results = new Map<string, SecurityScanResult>()

    const enabledProjects = this.projects.filter(p => p.enabled)
    logger.info(`Scanning ${enabledProjects.length} projects...`)

    if (parallel) {
      // 并行扫描
      const scanPromises = enabledProjects.map(async (project) => {
        const projectLogger = logger.child(project.id)
        projectLogger.info(`Scanning project: ${project.name}`)

        try {
          const scanner = new SecurityScanner({ projectDir: project.path })
          const result = await scanner.scan()
          results.set(project.id, result)
          projectLogger.success(`Scan completed: ${result.summary.totalIssues} issues`)
        } catch (error) {
          projectLogger.error('Scan failed', error as Error)
        }
      })

      await Promise.all(scanPromises)
    } else {
      // 串行扫描
      for (const project of enabledProjects) {
        const projectLogger = logger.child(project.id)
        projectLogger.info(`Scanning project: ${project.name}`)

        try {
          const scanner = new SecurityScanner({ projectDir: project.path })
          const result = await scanner.scan()
          results.set(project.id, result)
          projectLogger.success(`Scan completed: ${result.summary.totalIssues} issues`)
        } catch (error) {
          projectLogger.error('Scan failed', error as Error)
        }
      }
    }

    return results
  }

  /**
   * 对比多个项目
   */
  async compareProjects(projectIds: string[]): Promise<ComparisonResult> {
    const scanResults = await this.scanAll()
    const comparison: ComparisonResult = {
      projects: [],
      comparison: {
        totalIssues: [],
        riskLevels: [],
        worstProject: '',
        bestProject: ''
      }
    }

    let maxIssues = 0
    let minIssues = Infinity
    let worstId = ''
    let bestId = ''

    for (const id of projectIds) {
      const result = scanResults.get(id)
      const project = this.projects.find(p => p.id === id)

      if (result && project) {
        comparison.projects.push({
          id,
          name: project.name,
          result
        })

        comparison.comparison.totalIssues.push(result.summary.totalIssues)
        comparison.comparison.riskLevels.push(result.riskLevel)

        if (result.summary.totalIssues > maxIssues) {
          maxIssues = result.summary.totalIssues
          worstId = id
        }

        if (result.summary.totalIssues < minIssues) {
          minIssues = result.summary.totalIssues
          bestId = id
        }
      }
    }

    comparison.comparison.worstProject = worstId
    comparison.comparison.bestProject = bestId

    return comparison
  }

  /**
   * 生成项目ID
   */
  private generateProjectId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  }

  /**
   * 生成汇总报告
   */
  async generateSummaryReport(): Promise<string> {
    const results = await this.scanAll()

    let report = '# Multi-Project Security Summary\n\n'
    report += `**Total Projects**: ${results.size}\n\n`

    report += `| Project | Risk Level | Total Issues | Critical | High | Medium | Low |\n`
    report += `|---------|------------|--------------|----------|------|--------|-----|\n`

    for (const [id, result] of results.entries()) {
      const project = this.projects.find(p => p.id === id)
      const name = project?.name || id

      report += `| ${name} | ${result.riskLevel} | ${result.summary.totalIssues} | ${result.summary.critical} | ${result.summary.high} | ${result.summary.medium} | ${result.summary.low} |\n`
    }

    return report
  }
}


