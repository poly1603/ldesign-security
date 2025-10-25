import fs from 'fs-extra'
import path from 'path'
import { ValidationError } from '../errors/SecurityError'
import type { Severity, ReportFormat } from '../types'

/**
 * 输入验证工具类
 * 
 * @description
 * 提供统一的输入验证功能，确保所有用户输入和配置参数的有效性。
 * 使用 TypeScript 的类型断言（asserts）确保类型安全。
 * 
 * @example
 * ```typescript
 * // 验证项目目录
 * await Validator.validateProjectDir('./my-project')
 * 
 * // 验证严重程度
 * const severity = 'high'
 * Validator.validateSeverity(severity) // 类型断言，之后 severity 确保是 Severity 类型
 * 
 * // 验证报告格式
 * const formats = ['html', 'json']
 * formats.forEach(f => Validator.validateReportFormat(f))
 * ```
 */
export class Validator {
  /**
   * 验证项目目录是否有效
   * 
   * @description
   * 检查以下条件：
   * - 路径不为空且为字符串类型
   * - 目录实际存在
   * - 路径确实是一个目录（而不是文件）
   * - 目录中包含 package.json 文件
   * 
   * @param {string} dir - 要验证的目录路径
   * @throws {ValidationError} 当目录无效时抛出验证错误
   * 
   * @example
   * ```typescript
   * try {
   *   await Validator.validateProjectDir('./my-project')
   *   console.log('目录有效')
   * } catch (error) {
   *   console.error('无效的项目目录:', error.message)
   * }
   * ```
   */
  static async validateProjectDir(dir: string): Promise<void> {
    if (!dir || typeof dir !== 'string') {
      throw new ValidationError('Project directory must be a non-empty string')
    }

    const exists = await fs.pathExists(dir)
    if (!exists) {
      throw new ValidationError(`Project directory does not exist: ${dir}`)
    }

    const stats = await fs.stat(dir)
    if (!stats.isDirectory()) {
      throw new ValidationError(`Path is not a directory: ${dir}`)
    }

    // 检查是否有 package.json
    const packageJsonPath = path.join(dir, 'package.json')
    const hasPackageJson = await fs.pathExists(packageJsonPath)
    if (!hasPackageJson) {
      throw new ValidationError(`No package.json found in: ${dir}`)
    }
  }

  /**
   * 验证严重程度是否有效
   * 
   * @description
   * 使用 TypeScript 的断言类型（asserts），验证后可确保参数是 Severity 类型
   * 
   * @param {string} severity - 要验证的严重程度字符串
   * @throws {ValidationError} 当严重程度无效时抛出验证错误
   * 
   * @example
   * ```typescript
   * const level = 'high' // string 类型
   * Validator.validateSeverity(level) // 之后 level 确保是 Severity 类型
   * ```
   */
  static validateSeverity(severity: string): asserts severity is Severity {
    const validSeverities: Severity[] = ['critical', 'high', 'medium', 'low']
    if (!validSeverities.includes(severity as Severity)) {
      throw new ValidationError(
        `Invalid severity: ${severity}. Must be one of: ${validSeverities.join(', ')}`
      )
    }
  }

  /**
   * 验证报告格式是否有效
   * 
   * @description
   * 使用 TypeScript 的断言类型（asserts），验证后可确保参数是 ReportFormat 类型
   * 
   * @param {string} format - 要验证的报告格式字符串
   * @throws {ValidationError} 当报告格式无效时抛出验证错误
   * 
   * @example
   * ```typescript
   * const fmt = 'html' // string 类型
   * Validator.validateReportFormat(fmt) // 之后 fmt 确保是 ReportFormat 类型
   * ```
   */
  static validateReportFormat(format: string): asserts format is ReportFormat {
    const validFormats: ReportFormat[] = ['html', 'json', 'yaml', 'sarif', 'pdf', 'markdown']
    if (!validFormats.includes(format as ReportFormat)) {
      throw new ValidationError(
        `Invalid report format: ${format}. Must be one of: ${validFormats.join(', ')}`
      )
    }
  }

  /**
   * 验证 cron 表达式是否有效
   * 
   * @description
   * 执行基本的 cron 表达式格式验证。
   * 标准 cron 表达式应有 5 个部分（分 时 日 月 周），
   * 扩展格式可以有 6 个部分（添加秒）。
   * 
   * @param {string} cron - 要验证的 cron 表达式
   * @throws {ValidationError} 当 cron 表达式格式无效时抛出验证错误
   * 
   * @example
   * ```typescript
   * Validator.validateCronExpression('0 0 * * *') // 每天午夜
   * Validator.validateCronExpression('*/5 * * * *') // 每 5 分钟
   * ```
   */
  static validateCronExpression(cron: string): void {
    if (!cron || typeof cron !== 'string') {
      throw new ValidationError('Cron expression must be a non-empty string')
    }

    const parts = cron.trim().split(/\s+/)
    if (parts.length !== 5 && parts.length !== 6) {
      throw new ValidationError(
        `Invalid cron expression: ${ cron }. Must have 5 or 6 parts.`
      )
    }

    // 基本的字段验证
    const validChars = /^[0-9,\-*/]+$/
    for (const part of parts) {
      if (!validChars.test(part)) {
        throw new ValidationError(
          `Invalid cron expression part: ${ part }. Must contain only numbers, commas, hyphens, asterisks, or slashes.`
        )
      }
    }
  }

  /**
   * 验证文件路径是否有效且可访问
   * 
   * @param {string} filePath - 要验证的文件路径
   * @param {Object} options - 验证选项
   * @param {boolean} options.mustExist - 文件是否必须存在，默认为 true
   * @param {boolean} options.checkReadable - 是否检查可读性，默认为 true
   * @throws {ValidationError} 当文件路径无效时抛出验证错误
   * 
   * @example
   * ```typescript
  * // 验证文件存在且可读
   * await Validator.validateFilePath('./config.json')
  * 
   * // 验证路径格式（不要求文件存在）
   * await Validator.validateFilePath('./output.txt', { mustExist: false })
  * ```
   */
  static async validateFilePath(
    filePath: string,
    options: { mustExist?: boolean; checkReadable?: boolean } = {}
  ): Promise<void> {
    const { mustExist = true, checkReadable = true } = options

    if (!filePath || typeof filePath !== 'string') {
      throw new ValidationError('File path must be a non-empty string')
    }

    if (mustExist) {
      const exists = await fs.pathExists(filePath)
      if (!exists) {
        throw new ValidationError(`File does not exist: ${ filePath } `)
      }

      const stats = await fs.stat(filePath)
      if (!stats.isFile()) {
        throw new ValidationError(`Path is not a file: ${ filePath } `)
      }

      if (checkReadable) {
        try {
          await fs.access(filePath, fs.constants.R_OK)
        } catch {
          throw new ValidationError(`File is not readable: ${ filePath } `)
        }
      }
    }
  }

  /**
   * 验证 URL 格式是否有效
   * 
   * @param {string} url - 要验证的 URL
   * @param {Object} options - 验证选项
   * @param {string[]} options.allowedProtocols - 允许的协议列表，默认为 ['http', 'https']
   * @throws {ValidationError} 当 URL 格式无效时抛出验证错误
   * 
   * @example
   * ```typescript
  * Validator.validateUrl('https://example.com')
  * Validator.validateUrl('ftp://files.example.com', { allowedProtocols: ['ftp', 'ftps'] })
  * ```
   */
  static validateUrl(url: string, options: { allowedProtocols?: string[] } = {}): void {
    const { allowedProtocols = ['http', 'https'] } = options

    if (!url || typeof url !== 'string') {
      throw new ValidationError('URL must be a non-empty string')
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      throw new ValidationError(`Invalid URL format: ${ url } `)
    }

    const protocol = parsedUrl.protocol.replace(':', '')
    if (!allowedProtocols.includes(protocol)) {
      throw new ValidationError(
        `Invalid URL protocol: ${ protocol }. Allowed protocols: ${ allowedProtocols.join(', ') } `
      )
    }
  }

  /**
   * 验证端口号是否有效
   * 
   * @param {number} port - 要验证的端口号
   * @throws {ValidationError} 当端口号无效时抛出验证错误
   * 
   * @example
   * ```typescript
  * Validator.validatePort(8080) // 有效
  * Validator.validatePort(65535) // 有效
  * Validator.validatePort(70000) // 抛出错误
  * ```
   */
  static validatePort(port: number): void {
    if (typeof port !== 'number' || !Number.isInteger(port)) {
      throw new ValidationError('Port must be an integer')
    }

    if (port < 1 || port > 65535) {
      throw new ValidationError(`Port must be between 1 and 65535, got: ${ port } `)
    }
  }

  /**
   * 验证邮箱地址格式是否有效
   * 
   * @param {string} email - 要验证的邮箱地址
   * @throws {ValidationError} 当邮箱格式无效时抛出验证错误
   * 
   * @example
   * ```typescript
  * Validator.validateEmail('user@example.com') // 有效
  * Validator.validateEmail('invalid-email') // 抛出错误
  * ```
   */
  static validateEmail(email: string): void {
    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email must be a non-empty string')
    }

    // 基本的邮箱格式验证正则
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new ValidationError(`Invalid email format: ${ email } `)
    }
  }

  /**
   * 验证数组不为空
   * 
   * @param {T[]} arr - 要验证的数组
   * @param {string} fieldName - 字段名称（用于错误消息）
   * @throws {ValidationError} 当数组为空时抛出验证错误
   * 
   * @example
   * ```typescript
  * Validator.validateNonEmptyArray(['a', 'b'], 'items')
  * Validator.validateNonEmptyArray([], 'items') // 抛出错误
  * ```
   */
  static validateNonEmptyArray<T>(arr: T[], fieldName: string = 'array'): void {
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new ValidationError(`${ fieldName } must be a non - empty array`)
    }
  }

  /**
   * 验证对象不为空
   * 
   * @param {Record<string, any>} obj - 要验证的对象
   * @param {string} fieldName - 字段名称（用于错误消息）
   * @throws {ValidationError} 当对象为空时抛出验证错误
   * 
   * @example
   * ```typescript
  * Validator.validateNonEmptyObject({ key: 'value' }, 'config')
  * Validator.validateNonEmptyObject({}, 'config') // 抛出错误
  * ```
   */
  static validateNonEmptyObject(obj: Record<string, any>, fieldName: string = 'object'): void {
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) {
      throw new ValidationError(`${ fieldName } must be a non - empty object`)
    }
  }
}

