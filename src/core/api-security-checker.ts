import { readFile } from 'fs/promises'
import { glob } from 'fast-glob'
import type { CodeIssue, Severity } from '../types'

/**
 * API 安全问题类型
 */
export interface APISecurityIssue extends CodeIssue {
  type: 'exposed-endpoint' | 'missing-auth' | 'cors-config' | 'rate-limiting' | 'input-validation' | 'error-exposure'
  endpoint?: string
  method?: string
  recommendation: string
  cwe?: string
}

/**
 * API 安全检测器配置
 */
export interface APISecurityCheckerOptions {
  projectDir: string
  exclude?: string[]
  checkExposedEndpoints?: boolean
  checkAuthentication?: boolean
  checkCORS?: boolean
  checkRateLimiting?: boolean
  checkInputValidation?: boolean
}

/**
 * API 安全检测器
 * 检测 API 端点暴露、认证授权问题、CORS 配置、Rate Limiting 等
 * 
 * @example
 * ```typescript
 * const checker = new APISecurityChecker({
 *   projectDir: './my-api',
 *   checkAuthentication: true,
 *   checkCORS: true
 * })
 * 
 * const issues = await checker.check()
 * console.log(`发现 ${issues.length} 个 API 安全问题`)
 * ```
 */
export class APISecurityChecker {
  private projectDir: string
  private exclude: string[]
  private options: Required<Omit<APISecurityCheckerOptions, 'projectDir' | 'exclude'>>

  // 常见的路由框架和 HTTP 方法模式
  private readonly ROUTE_PATTERNS = [
    // Express.js
    /(?:app|router)\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    // Koa.js
    /router\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    // Fastify
    /fastify\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    // NestJS decorators
    /@(Get|Post|Put|Patch|Delete|All)\s*\(\s*['"`]?([^'"`\)]*?)['"`]?\s*\)/gi,
    // Next.js API routes (通过文件名检测)
  ]

  // 敏感端点关键词
  private readonly SENSITIVE_ENDPOINTS = [
    'admin', 'dashboard', 'console', 'debug',
    'config', 'settings', 'env', 'environment',
    'secret', 'key', 'token', 'password',
    'internal', 'private', 'test', 'dev'
  ]

  // 认证中间件模式
  private readonly AUTH_MIDDLEWARE_PATTERNS = [
    /authenticate/i,
    /authorize/i,
    /isAuth/i,
    /requireAuth/i,
    /checkAuth/i,
    /verifyToken/i,
    /passport\.authenticate/i,
    /jwt\.verify/i,
    /@UseGuards/i,
    /@Auth/i
  ]

  // CORS 不安全配置
  private readonly INSECURE_CORS_PATTERNS = [
    { pattern: /cors\s*\(\s*\{[^}]*origin\s*:\s*['"`]\*['"`]/gi, desc: '允许所有来源的跨域请求' },
    { pattern: /Access-Control-Allow-Origin\s*[:=]\s*['"`]\*['"`]/gi, desc: 'CORS 允许任意来源' },
    { pattern: /credentials\s*:\s*true[^}]*origin\s*:\s*['"`]\*['"`]/gi, desc: '允许所有来源并开启凭证' }
  ]

  constructor(options: APISecurityCheckerOptions) {
    this.projectDir = options.projectDir
    this.exclude = options.exclude || [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/*.test.*',
      '**/*.spec.*'
    ]
    this.options = {
      checkExposedEndpoints: options.checkExposedEndpoints ?? true,
      checkAuthentication: options.checkAuthentication ?? true,
      checkCORS: options.checkCORS ?? true,
      checkRateLimiting: options.checkRateLimiting ?? true,
      checkInputValidation: options.checkInputValidation ?? true
    }
  }

  /**
   * 执行完整的 API 安全检查
   */
  async check(): Promise<APISecurityIssue[]> {
    const issues: APISecurityIssue[] = []
    const files = await this.getFilesToScan()

    for (const file of files) {
      try {
        const content = await readFile(file, 'utf-8')
        const lines = content.split('\n')

        if (this.options.checkExposedEndpoints) {
          issues.push(...await this.checkExposedEndpoints(file, lines, content))
        }

        if (this.options.checkAuthentication) {
          issues.push(...this.checkMissingAuthentication(file, lines, content))
        }

        if (this.options.checkCORS) {
          issues.push(...this.checkCORSConfiguration(file, lines))
        }

        if (this.options.checkRateLimiting) {
          issues.push(...this.checkRateLimiting(file, lines, content))
        }

        if (this.options.checkInputValidation) {
          issues.push(...this.checkInputValidation(file, lines))
        }

        // 检测错误信息暴露
        issues.push(...this.checkErrorExposure(file, lines))
      } catch (error) {
        continue
      }
    }

    return issues
  }

  /**
   * 检测暴露的敏感端点
   */
  private async checkExposedEndpoints(file: string, lines: string[], content: string): Promise<APISecurityIssue[]> {
    const issues: APISecurityIssue[] = []
    const routes = this.extractRoutes(content)

    routes.forEach(route => {
      // 检查是否为敏感端点
      const isSensitive = this.SENSITIVE_ENDPOINTS.some(keyword => 
        route.path.toLowerCase().includes(keyword)
      )

      if (isSensitive) {
        const lineIndex = lines.findIndex(line => line.includes(route.path))
        issues.push({
          file,
          line: lineIndex + 1,
          column: 1,
          message: `检测到敏感 API 端点: ${route.method.toUpperCase()} ${route.path}`,
          ruleId: 'api-exposed-endpoint',
          severity: 'high',
          type: 'exposed-endpoint',
          endpoint: route.path,
          method: route.method,
          recommendation: '确保敏感端点有适当的访问控制和认证机制',
          cwe: 'CWE-306'
        })
      }

      // 检测无限制的通配符路由
      if (route.path.includes('*') || route.path.includes(':') && route.path.split(':').length > 3) {
        const lineIndex = lines.findIndex(line => line.includes(route.path))
        issues.push({
          file,
          line: lineIndex + 1,
          column: 1,
          message: `过于宽泛的路由定义: ${route.method.toUpperCase()} ${route.path}`,
          ruleId: 'api-broad-route',
          severity: 'medium',
          type: 'exposed-endpoint',
          endpoint: route.path,
          method: route.method,
          recommendation: '使用更具体的路由模式，避免意外暴露端点',
          cwe: 'CWE-862'
        })
      }
    })

    return issues
  }

  /**
   * 检测缺失的认证机制
   */
  private checkMissingAuthentication(file: string, lines: string[], content: string): APISecurityIssue[] {
    const issues: APISecurityIssue[] = []
    const routes = this.extractRoutes(content)

    routes.forEach(route => {
      // 检查路由定义附近是否有认证中间件
      const routeLineIndex = lines.findIndex(line => line.includes(route.path))
      if (routeLineIndex === -1) return

      // 检查前后5行是否有认证相关代码
      const contextLines = lines.slice(
        Math.max(0, routeLineIndex - 5),
        Math.min(lines.length, routeLineIndex + 5)
      ).join('\n')

      const hasAuth = this.AUTH_MIDDLEWARE_PATTERNS.some(pattern => pattern.test(contextLines))

      // 对于写操作（POST, PUT, PATCH, DELETE）应该有认证
      if (!hasAuth && ['post', 'put', 'patch', 'delete'].includes(route.method.toLowerCase())) {
        issues.push({
          file,
          line: routeLineIndex + 1,
          column: 1,
          message: `API 端点缺少认证保护: ${route.method.toUpperCase()} ${route.path}`,
          ruleId: 'api-missing-auth',
          severity: 'critical',
          type: 'missing-auth',
          endpoint: route.path,
          method: route.method,
          recommendation: '为所有写操作端点添加认证中间件（如 JWT、OAuth、Session）',
          cwe: 'CWE-306'
        })
      }
    })

    return issues
  }

  /**
   * 检测 CORS 配置问题
   */
  private checkCORSConfiguration(file: string, lines: string[]): APISecurityIssue[] {
    const issues: APISecurityIssue[] = []

    lines.forEach((line, index) => {
      for (const { pattern, desc } of this.INSECURE_CORS_PATTERNS) {
        const match = pattern.exec(line)
        if (match) {
          issues.push({
            file,
            line: index + 1,
            column: match.index + 1,
            message: `不安全的 CORS 配置: ${desc}`,
            ruleId: 'api-insecure-cors',
            severity: 'high',
            type: 'cors-config',
            recommendation: '限制 CORS 只允许可信的域名，避免使用通配符 "*"',
            cwe: 'CWE-942'
          })
        }
      }
    })

    return issues
  }

  /**
   * 检测缺失的速率限制
   */
  private checkRateLimiting(file: string, lines: string[], content: string): APISecurityIssue[] {
    const issues: APISecurityIssue[] = []

    // 检查是否导入了速率限制库
    const hasRateLimitImport = /(?:express-rate-limit|rate-limiter|ratelimit|throttle)/i.test(content)

    if (!hasRateLimitImport) {
      const routes = this.extractRoutes(content)
      
      // 如果有公开的 POST/PUT/DELETE 端点但没有速率限制
      const hasWriteRoutes = routes.some(r => ['post', 'put', 'delete'].includes(r.method.toLowerCase()))
      
      if (hasWriteRoutes) {
        issues.push({
          file,
          line: 1,
          column: 1,
          message: '该文件定义了写操作端点但未检测到速率限制',
          ruleId: 'api-missing-rate-limit',
          severity: 'medium',
          type: 'rate-limiting',
          recommendation: '添加速率限制以防止 API 滥用和 DoS 攻击（推荐库: express-rate-limit）',
          cwe: 'CWE-770'
        })
      }
    }

    return issues
  }

  /**
   * 检测输入验证问题
   */
  private checkInputValidation(file: string, lines: string[]): APISecurityIssue[] {
    const issues: APISecurityIssue[] = []

    lines.forEach((line, index) => {
      // 检测直接使用请求参数而没有验证
      const dangerousPatterns = [
        /req\.body\.\w+\s*(?!\s*&&\s*|\s*\|\|\s*|\s*\?\s*|\.match|\.test|typeof)/gi,
        /req\.params\.\w+\s*(?!\s*&&\s*|\s*\|\|\s*|\s*\?\s*|\.match|\.test|typeof)/gi,
        /req\.query\.\w+\s*(?!\s*&&\s*|\s*\|\|\s*|\s*\?\s*|\.match|\.test|typeof)/gi
      ]

      // 检查是否在赋值或数据库操作中直接使用
      const isDangerous = dangerousPatterns.some(pattern => {
        const match = pattern.exec(line)
        if (match) {
          // 检查是否在危险上下文中（赋值、查询等）
          return line.includes('=') || 
                 line.includes('find') || 
                 line.includes('insert') || 
                 line.includes('update') ||
                 line.includes('delete')
        }
        return false
      })

      if (isDangerous) {
        issues.push({
          file,
          line: index + 1,
          column: 1,
          message: '直接使用未验证的请求参数',
          ruleId: 'api-missing-validation',
          severity: 'high',
          type: 'input-validation',
          recommendation: '使用输入验证库（如 joi、yup、zod）验证所有用户输入',
          cwe: 'CWE-20'
        })
      }
    })

    return issues
  }

  /**
   * 检测错误信息暴露
   */
  private checkErrorExposure(file: string, lines: string[]): APISecurityIssue[] {
    const issues: APISecurityIssue[] = []

    lines.forEach((line, index) => {
      // 检测可能暴露敏感信息的错误处理
      if (line.includes('catch') || line.includes('.catch(')) {
        const nextLines = lines.slice(index, Math.min(lines.length, index + 10)).join('\n')
        
        // 检查是否直接返回错误对象或堆栈
        if (/res\.(?:send|json)\s*\(\s*(?:err|error)(?:\.stack)?/i.test(nextLines)) {
          issues.push({
            file,
            line: index + 1,
            column: 1,
            message: '错误处理可能暴露敏感信息',
            ruleId: 'api-error-exposure',
            severity: 'medium',
            type: 'error-exposure',
            recommendation: '在生产环境中不要返回详细的错误堆栈，使用通用错误消息',
            cwe: 'CWE-209'
          })
        }
      }
    })

    return issues
  }

  /**
   * 提取路由信息
   */
  private extractRoutes(content: string): Array<{ method: string; path: string }> {
    const routes: Array<{ method: string; path: string }> = []

    for (const pattern of this.ROUTE_PATTERNS) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        routes.push({
          method: match[1].toLowerCase(),
          path: match[2] || match[1] // 处理不同的捕获组
        })
      }
    }

    return routes
  }

  /**
   * 获取需要扫描的文件列表
   */
  private async getFilesToScan(): Promise<string[]> {
    const patterns = [
      '**/*.ts',
      '**/*.js',
      '**/*.tsx',
      '**/*.jsx',
      '**/*.mjs',
      '**/*.cjs',
      '**/pages/api/**/*', // Next.js API routes
      '**/app/api/**/*'    // Next.js 13+ app directory
    ]

    return await glob(patterns, {
      cwd: this.projectDir,
      ignore: this.exclude,
      absolute: true
    })
  }

  /**
   * 生成 API 安全摘要报告
   */
  generateSummary(issues: APISecurityIssue[]): {
    total: number
    byType: Record<APISecurityIssue['type'], number>
    bySeverity: Record<Severity, number>
    criticalEndpoints: string[]
    recommendations: string[]
  } {
    const byType: Record<APISecurityIssue['type'], number> = {
      'exposed-endpoint': 0,
      'missing-auth': 0,
      'cors-config': 0,
      'rate-limiting': 0,
      'input-validation': 0,
      'error-exposure': 0
    }

    const bySeverity: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }

    const criticalEndpoints = new Set<string>()
    const recommendations = new Set<string>()

    issues.forEach(issue => {
      byType[issue.type]++
      bySeverity[issue.severity]++
      
      if (issue.severity === 'critical' && issue.endpoint) {
        criticalEndpoints.add(`${issue.method?.toUpperCase()} ${issue.endpoint}`)
      }
      
      recommendations.add(issue.recommendation)
    })

    return {
      total: issues.length,
      byType,
      bySeverity,
      criticalEndpoints: Array.from(criticalEndpoints),
      recommendations: Array.from(recommendations)
    }
  }
}
