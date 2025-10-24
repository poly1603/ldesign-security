/**
 * 自定义安全错误类型
 */
export class SecurityError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'SecurityError'
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * 扫描错误
 */
export class ScanError extends SecurityError {
  constructor(message: string, details?: any) {
    super(message, 'SCAN_ERROR', details)
    this.name = 'ScanError'
  }
}

/**
 * 验证错误
 */
export class ValidationError extends SecurityError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

/**
 * 配置错误
 */
export class ConfigError extends SecurityError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIG_ERROR', details)
    this.name = 'ConfigError'
  }
}

/**
 * 网络错误
 */
export class NetworkError extends SecurityError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', details)
    this.name = 'NetworkError'
  }
}

/**
 * 文件系统错误
 */
export class FileSystemError extends SecurityError {
  constructor(message: string, details?: any) {
    super(message, 'FILESYSTEM_ERROR', details)
    this.name = 'FileSystemError'
  }
}


