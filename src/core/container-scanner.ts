import { readFile } from 'fs/promises'
import { glob } from 'fast-glob'
import { existsSync } from 'fs'
import { join } from 'path'
import type { Severity } from '../types'

/**
 * 容器安全问题类型
 */
export interface ContainerIssue {
  file: string
  line: number
  type: 'dockerfile' | 'docker-compose' | 'kubernetes' | 'image'
  severity: Severity
  category: string
  message: string
  recommendation: string
  cwe?: string
  reference?: string
}

/**
 * 容器扫描结果
 */
export interface ContainerScanResult {
  dockerfileIssues: ContainerIssue[]
  composeIssues: ContainerIssue[]
  kubernetesIssues: ContainerIssue[]
  imageIssues: ContainerIssue[]
  summary: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
  }
  timestamp: string
}

/**
 * 容器扫描器配置
 */
export interface ContainerScannerOptions {
  projectDir: string
  scanDockerfiles?: boolean
  scanComposeFiles?: boolean
  scanKubernetesFiles?: boolean
  scanImages?: boolean
  exclude?: string[]
}

/**
 * 容器安全扫描器
 * 扫描 Dockerfile、docker-compose、Kubernetes 配置等容器相关文件
 * 
 * @example
 * ```typescript
 * const scanner = new ContainerScanner({
 *   projectDir: '.',
 *   scanDockerfiles: true,
 *   scanComposeFiles: true
 * })
 * 
 * const result = await scanner.scan()
 * console.log(`发现 ${result.summary.total} 个容器安全问题`)
 * ```
 */
export class ContainerScanner {
  private projectDir: string
  private options: Required<Omit<ContainerScannerOptions, 'projectDir'>>

  // Dockerfile 不安全实践
  private readonly DOCKERFILE_CHECKS = [
    {
      pattern: /FROM\s+[^:]+$/im,
      severity: 'high' as Severity,
      category: 'Image Version',
      message: '基础镜像未指定版本标签',
      recommendation: '始终使用特定版本标签，避免使用 latest',
      cwe: 'CWE-494'
    },
    {
      pattern: /FROM\s+.*:latest/i,
      severity: 'medium' as Severity,
      category: 'Image Version',
      message: '使用了 latest 标签',
      recommendation: '使用具体的版本号以确保构建可重现性',
      cwe: 'CWE-494'
    },
    {
      pattern: /USER\s+root/i,
      severity: 'high' as Severity,
      category: 'Privilege',
      message: '容器以 root 用户运行',
      recommendation: '创建非 root 用户运行应用',
      cwe: 'CWE-250'
    },
    {
      pattern: /ADD\s+http/i,
      severity: 'medium' as Severity,
      category: 'Network',
      message: '使用 ADD 从 HTTP 下载文件',
      recommendation: '使用 RUN curl/wget 或 COPY，ADD 会自动解压缩',
      cwe: 'CWE-494'
    },
    {
      pattern: /COPY\s+.*\s+\//,
      severity: 'low' as Severity,
      category: 'File System',
      message: '复制文件到根目录',
      recommendation: '复制到 /app 或其他专用目录',
      cwe: 'CWE-668'
    },
    {
      pattern: /apt-get\s+(?!.*--no-install-recommends)/i,
      severity: 'low' as Severity,
      category: 'Size',
      message: 'apt-get 未使用 --no-install-recommends',
      recommendation: '使用 --no-install-recommends 减小镜像大小',
      cwe: 'CWE-1333'
    },
    {
      pattern: /EXPOSE\s+22/i,
      severity: 'critical' as Severity,
      category: 'Network',
      message: '暴露 SSH 端口 (22)',
      recommendation: '不要在容器中运行 SSH，使用 docker exec',
      cwe: 'CWE-1188'
    },
    {
      pattern: /EXPOSE\s+3306/i,
      severity: 'high' as Severity,
      category: 'Network',
      message: '暴露数据库端口 (3306)',
      recommendation: '数据库不应直接暴露，使用网络隔离',
      cwe: 'CWE-1188'
    }
  ]

  // 密钥和敏感信息模式
  private readonly SECRET_PATTERNS = [
    {
      pattern: /(?:password|passwd|pwd|secret|token|api[_-]?key)\s*[=:]\s*['"]?[^\s'"]+/gi,
      severity: 'critical' as Severity,
      message: '可能包含硬编码的密钥或密码',
      recommendation: '使用 Docker secrets 或环境变量'
    },
    {
      pattern: /ENV\s+.*(?:PASSWORD|SECRET|TOKEN|API_KEY)\s*=\s*[^\s]+/gi,
      severity: 'critical' as Severity,
      message: '环境变量中包含敏感信息',
      recommendation: '在运行时通过 docker run -e 或 secrets 传递'
    }
  ]

  constructor(options: ContainerScannerOptions) {
    this.projectDir = options.projectDir
    this.options = {
      scanDockerfiles: options.scanDockerfiles ?? true,
      scanComposeFiles: options.scanComposeFiles ?? true,
      scanKubernetesFiles: options.scanKubernetesFiles ?? true,
      scanImages: options.scanImages ?? false,
      exclude: options.exclude || ['**/node_modules/**', '**/dist/**', '**/.git/**']
    }
  }

  /**
   * 执行完整的容器安全扫描
   */
  async scan(): Promise<ContainerScanResult> {
    const dockerfileIssues: ContainerIssue[] = []
    const composeIssues: ContainerIssue[] = []
    const kubernetesIssues: ContainerIssue[] = []
    const imageIssues: ContainerIssue[] = []

    if (this.options.scanDockerfiles) {
      dockerfileIssues.push(...await this.scanDockerfiles())
    }

    if (this.options.scanComposeFiles) {
      composeIssues.push(...await this.scanComposeFiles())
    }

    if (this.options.scanKubernetesFiles) {
      kubernetesIssues.push(...await this.scanKubernetesFiles())
    }

    const allIssues = [...dockerfileIssues, ...composeIssues, ...kubernetesIssues, ...imageIssues]

    return {
      dockerfileIssues,
      composeIssues,
      kubernetesIssues,
      imageIssues,
      summary: this.generateSummary(allIssues),
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 扫描 Dockerfile
   */
  private async scanDockerfiles(): Promise<ContainerIssue[]> {
    const issues: ContainerIssue[] = []
    const dockerfiles = await this.findDockerfiles()

    for (const file of dockerfiles) {
      try {
        const content = await readFile(file, 'utf-8')
        const lines = content.split('\n')

        // 检查基本的 Dockerfile 最佳实践
        lines.forEach((line, index) => {
          const trimmed = line.trim()
          
          // 跳过空行和注释
          if (!trimmed || trimmed.startsWith('#')) return

          // 应用所有检查规则
          for (const check of this.DOCKERFILE_CHECKS) {
            if (check.pattern.test(line)) {
              issues.push({
                file,
                line: index + 1,
                type: 'dockerfile',
                severity: check.severity,
                category: check.category,
                message: check.message,
                recommendation: check.recommendation,
                cwe: check.cwe
              })
            }
          }

          // 检查密钥泄露
          for (const secretCheck of this.SECRET_PATTERNS) {
            if (secretCheck.pattern.test(line)) {
              issues.push({
                file,
                line: index + 1,
                type: 'dockerfile',
                severity: secretCheck.severity,
                category: 'Secrets',
                message: secretCheck.message,
                recommendation: secretCheck.recommendation,
                cwe: 'CWE-798'
              })
            }
          }
        })

        // 全文检查
        issues.push(...this.checkDockerfileStructure(file, content, lines))
      } catch (error) {
        continue
      }
    }

    return issues
  }

  /**
   * 检查 Dockerfile 结构
   */
  private checkDockerfileStructure(file: string, content: string, lines: string[]): ContainerIssue[] {
    const issues: ContainerIssue[] = []

    // 检查是否使用多阶段构建
    const fromCount = (content.match(/^FROM\s+/gim) || []).length
    const hasMultiStage = fromCount > 1

    if (!hasMultiStage && content.length > 500) {
      issues.push({
        file,
        line: 1,
        type: 'dockerfile',
        severity: 'low',
        category: 'Build Optimization',
        message: '未使用多阶段构建',
        recommendation: '考虑使用多阶段构建减小最终镜像大小'
      })
    }

    // 检查是否有 USER 指令
    const hasUser = /^USER\s+(?!root)/im.test(content)
    if (!hasUser) {
      issues.push({
        file,
        line: lines.length,
        type: 'dockerfile',
        severity: 'high',
        category: 'Privilege',
        message: '未指定非 root 用户',
        recommendation: '添加 USER 指令指定非 root 用户运行',
        cwe: 'CWE-250'
      })
    }

    // 检查是否有 HEALTHCHECK
    const hasHealthcheck = /^HEALTHCHECK\s+/im.test(content)
    if (!hasHealthcheck) {
      issues.push({
        file,
        line: lines.length,
        type: 'dockerfile',
        severity: 'low',
        category: 'Monitoring',
        message: '未定义健康检查',
        recommendation: '添加 HEALTHCHECK 指令以监控容器健康状态'
      })
    }

    // 检查缓存破坏层
    const hasAptUpdate = /apt-get\s+update/i.test(content)
    const hasAptInstall = /apt-get\s+install/i.test(content)
    if (hasAptUpdate && hasAptInstall) {
      const updateLines = lines.map((l, i) => ({ line: l, index: i })).filter(l => /apt-get\s+update/i.test(l.line))
      const installLines = lines.map((l, i) => ({ line: l, index: i })).filter(l => /apt-get\s+install/i.test(l.line))
      
      updateLines.forEach(update => {
        const nextInstall = installLines.find(install => install.index > update.index)
        if (!nextInstall || nextInstall.index - update.index > 1) {
          issues.push({
            file,
            line: update.index + 1,
            type: 'dockerfile',
            severity: 'low',
            category: 'Caching',
            message: 'apt-get update 和 install 应在同一 RUN 指令中',
            recommendation: '合并到同一 RUN 指令以避免缓存问题'
          })
        }
      })
    }

    return issues
  }

  /**
   * 扫描 docker-compose 文件
   */
  private async scanComposeFiles(): Promise<ContainerIssue[]> {
    const issues: ContainerIssue[] = []
    const composeFiles = await this.findComposeFiles()

    for (const file of composeFiles) {
      try {
        const content = await readFile(file, 'utf-8')
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          // 检查特权模式
          if (/privileged:\s*true/i.test(line)) {
            issues.push({
              file,
              line: index + 1,
              type: 'docker-compose',
              severity: 'critical',
              category: 'Privilege',
              message: '使用了特权模式 (privileged: true)',
              recommendation: '避免使用特权模式，使用 capabilities 细粒度控制',
              cwe: 'CWE-250'
            })
          }

          // 检查网络模式 host
          if (/network_mode:\s*["']?host/i.test(line)) {
            issues.push({
              file,
              line: index + 1,
              type: 'docker-compose',
              severity: 'high',
              category: 'Network',
              message: '使用了 host 网络模式',
              recommendation: '使用桥接网络以提供网络隔离',
              cwe: 'CWE-668'
            })
          }

          // 检查端口绑定到 0.0.0.0
          if (/ports:\s*-\s*["']?0\.0\.0\.0:/i.test(line)) {
            issues.push({
              file,
              line: index + 1,
              type: 'docker-compose',
              severity: 'medium',
              category: 'Network',
              message: '端口绑定到所有接口 (0.0.0.0)',
              recommendation: '绑定到 127.0.0.1 或特定 IP',
              cwe: 'CWE-1188'
            })
          }

          // 检查明文密码
          if (/(?:password|secret):\s*["']?[^"\s]+/i.test(line) && !/\$\{/.test(line)) {
            issues.push({
              file,
              line: index + 1,
              type: 'docker-compose',
              severity: 'critical',
              category: 'Secrets',
              message: '包含明文密码或密钥',
              recommendation: '使用环境变量或 Docker secrets',
              cwe: 'CWE-798'
            })
          }

          // 检查 restart: always
          if (/restart:\s*always/i.test(line)) {
            issues.push({
              file,
              line: index + 1,
              type: 'docker-compose',
              severity: 'low',
              category: 'Availability',
              message: '使用 restart: always 可能导致问题容器不断重启',
              recommendation: '考虑使用 unless-stopped 或 on-failure'
            })
          }
        })
      } catch (error) {
        continue
      }
    }

    return issues
  }

  /**
   * 扫描 Kubernetes 配置文件
   */
  private async scanKubernetesFiles(): Promise<ContainerIssue[]> {
    const issues: ContainerIssue[] = []
    const k8sFiles = await this.findKubernetesFiles()

    for (const file of k8sFiles) {
      try {
        const content = await readFile(file, 'utf-8')
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          // 检查特权容器
          if (/privileged:\s*true/i.test(line)) {
            issues.push({
              file,
              line: index + 1,
              type: 'kubernetes',
              severity: 'critical',
              category: 'Privilege',
              message: 'Pod 以特权模式运行',
              recommendation: '移除 privileged: true 或使用 SecurityContext',
              cwe: 'CWE-250'
            })
          }

          // 检查 hostNetwork
          if (/hostNetwork:\s*true/i.test(line)) {
            issues.push({
              file,
              line: index + 1,
              type: 'kubernetes',
              severity: 'high',
              category: 'Network',
              message: '使用主机网络 (hostNetwork: true)',
              recommendation: '使用 Pod 网络提供隔离',
              cwe: 'CWE-668'
            })
          }

          // 检查 runAsRoot
          if (/runAsUser:\s*0/i.test(line)) {
            issues.push({
              file,
              line: index + 1,
              type: 'kubernetes',
              severity: 'high',
              category: 'Privilege',
              message: 'Pod 以 root 用户运行',
              recommendation: '使用非 root 用户运行',
              cwe: 'CWE-250'
            })
          }

          // 检查资源限制
          if (/kind:\s*(?:Deployment|StatefulSet|DaemonSet)/i.test(line)) {
            const nextLines = lines.slice(index, index + 50).join('\n')
            if (!/resources:/i.test(nextLines)) {
              issues.push({
                file,
                line: index + 1,
                type: 'kubernetes',
                severity: 'medium',
                category: 'Resources',
                message: '未定义资源限制',
                recommendation: '设置 resources.limits 和 resources.requests'
              })
            }
          }
        })
      } catch (error) {
        continue
      }
    }

    return issues
  }

  /**
   * 查找 Dockerfile
   */
  private async findDockerfiles(): Promise<string[]> {
    return await glob(['**/Dockerfile', '**/Dockerfile.*', '**/*.dockerfile'], {
      cwd: this.projectDir,
      ignore: this.options.exclude,
      absolute: true
    })
  }

  /**
   * 查找 docker-compose 文件
   */
  private async findComposeFiles(): Promise<string[]> {
    return await glob(['**/docker-compose*.yml', '**/docker-compose*.yaml'], {
      cwd: this.projectDir,
      ignore: this.options.exclude,
      absolute: true
    })
  }

  /**
   * 查找 Kubernetes 配置文件
   */
  private async findKubernetesFiles(): Promise<string[]> {
    return await glob(['**/k8s/**/*.{yml,yaml}', '**/kubernetes/**/*.{yml,yaml}', '**/*-deployment.{yml,yaml}'], {
      cwd: this.projectDir,
      ignore: this.options.exclude,
      absolute: true
    })
  }

  /**
   * 生成摘要
   */
  private generateSummary(issues: ContainerIssue[]): {
    total: number
    critical: number
    high: number
    medium: number
    low: number
  } {
    return {
      total: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    }
  }

  /**
   * 生成报告
   */
  generateReport(result: ContainerScanResult): string {
    const { summary } = result
    let report = `容器安全扫描报告\n${'='.repeat(50)}\n\n`
    
    report += `总问题数: ${summary.total}\n`
    report += `  - 严重: ${summary.critical}\n`
    report += `  - 高危: ${summary.high}\n`
    report += `  - 中危: ${summary.medium}\n`
    report += `  - 低危: ${summary.low}\n\n`

    if (result.dockerfileIssues.length > 0) {
      report += `\nDockerfile 问题 (${result.dockerfileIssues.length}):\n`
      report += '-'.repeat(50) + '\n'
      result.dockerfileIssues.forEach(issue => {
        report += `[${issue.severity.toUpperCase()}] ${issue.file}:${issue.line}\n`
        report += `  ${issue.message}\n`
        report += `  建议: ${issue.recommendation}\n\n`
      })
    }

    if (result.composeIssues.length > 0) {
      report += `\nDocker Compose 问题 (${result.composeIssues.length}):\n`
      report += '-'.repeat(50) + '\n'
      result.composeIssues.forEach(issue => {
        report += `[${issue.severity.toUpperCase()}] ${issue.file}:${issue.line}\n`
        report += `  ${issue.message}\n`
        report += `  建议: ${issue.recommendation}\n\n`
      })
    }

    if (result.kubernetesIssues.length > 0) {
      report += `\nKubernetes 问题 (${result.kubernetesIssues.length}):\n`
      report += '-'.repeat(50) + '\n'
      result.kubernetesIssues.forEach(issue => {
        report += `[${issue.severity.toUpperCase()}] ${issue.file}:${issue.line}\n`
        report += `  ${issue.message}\n`
        report += `  建议: ${issue.recommendation}\n\n`
      })
    }

    return report
  }
}
