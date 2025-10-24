import chalk from 'chalk'

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4
}

/**
 * 日志配置
 */
export interface LoggerConfig {
  level: LogLevel
  timestamp: boolean
  colorize: boolean
  prefix?: string
}

/**
 * 简单但功能完整的日志系统
 */
export class Logger {
  private config: LoggerConfig

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level ?? LogLevel.INFO,
      timestamp: config.timestamp ?? true,
      colorize: config.colorize ?? true,
      prefix: config.prefix
    }
  }

  /**
   * 调试日志
   */
  debug(message: string, ...args: any[]): void {
    if (this.config.level <= LogLevel.DEBUG) {
      this.log('DEBUG', chalk.gray, message, args)
    }
  }

  /**
   * 信息日志
   */
  info(message: string, ...args: any[]): void {
    if (this.config.level <= LogLevel.INFO) {
      this.log('INFO', chalk.blue, message, args)
    }
  }

  /**
   * 警告日志
   */
  warn(message: string, ...args: any[]): void {
    if (this.config.level <= LogLevel.WARN) {
      this.log('WARN', chalk.yellow, message, args)
    }
  }

  /**
   * 错误日志
   */
  error(message: string, error?: Error, ...args: any[]): void {
    if (this.config.level <= LogLevel.ERROR) {
      this.log('ERROR', chalk.red, message, args)
      if (error) {
        console.error(chalk.red(error.stack || error.message))
      }
    }
  }

  /**
   * 成功日志
   */
  success(message: string, ...args: any[]): void {
    if (this.config.level <= LogLevel.INFO) {
      this.log('SUCCESS', chalk.green, message, args)
    }
  }

  /**
   * 内部日志方法
   */
  private log(
    level: string,
    color: typeof chalk.blue,
    message: string,
    args: any[]
  ): void {
    const parts: string[] = []

    // 时间戳
    if (this.config.timestamp) {
      const timestamp = new Date().toISOString()
      parts.push(chalk.gray(`[${timestamp}]`))
    }

    // 级别
    if (this.config.colorize) {
      parts.push(color(`[${level}]`))
    } else {
      parts.push(`[${level}]`)
    }

    // 前缀
    if (this.config.prefix) {
      parts.push(chalk.cyan(`[${this.config.prefix}]`))
    }

    // 消息
    parts.push(message)

    // 输出
    console.log(parts.join(' '), ...args)
  }

  /**
   * 创建子日志器
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix
    })
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.level = level
  }
}

/**
 * 默认日志器实例
 */
export const logger = new Logger()

/**
 * 创建日志器
 */
export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new Logger(config)
}


