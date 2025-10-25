import fs from 'fs-extra'

/**
 * 性能指标数据接口
 * 
 * @interface PerformanceMetrics
 * @property {string} operation - 操作名称
 * @property {number} duration - 持续时间（毫秒）
 * @property {string} timestamp - 时间戳 (ISO 8601 格式)
 * @property {Record<string, any>} metadata - 可选的元数据
 */
export interface PerformanceMetrics {
  operation: string
  duration: number
  timestamp: string
  metadata?: Record<string, any>
}

/**
 * 性能报告接口
 * 
 * @interface PerformanceReport
 * @property {number} total - 总耗时（毫秒）
 * @property {PerformanceMetrics[]} operations - 操作列表
 * @property {Record<string, OperationSummary>} summary - 操作汇总统计
 */
export interface PerformanceReport {
  total: number
  operations: PerformanceMetrics[]
  summary: Record<string, OperationSummary>
}

/**
 * 操作汇总统计接口
 * 
 * @interface OperationSummary
 * @property {number} count - 执行次数
 * @property {number} avgDuration - 平均耗时（毫秒）
 * @property {number} totalDuration - 总耗时（毫秒）
 * @property {number} minDuration - 最小耗时（毫秒）
 * @property {number} maxDuration - 最大耗时（毫秒）
 */
export interface OperationSummary {
  count: number
  avgDuration: number
  totalDuration: number
  minDuration: number
  maxDuration: number
}

/**
 * 性能监控器
 * 
 * @description
 * 提供精确的性能监控功能，用于跟踪和分析各个操作的执行时间。
 * 支持嵌套操作的计时、性能报告生成和数据导出。
 * 
 * @example
 * ```typescript
 * const monitor = new PerformanceMonitor()
 * 
 * // 开始计时
 * monitor.start('database_query')
 * await db.query('SELECT * FROM users')
 * monitor.end('database_query', { rows: 100 })
 * 
 * // 获取报告
 * const report = monitor.getReport()
 * console.log(`总耗时: ${report.total}ms`)
 * console.log(`平均查询时间: ${report.summary.database_query.avgDuration}ms`)
 * 
 * // 导出到文件
 * await monitor.export('./performance.json')
 * ```
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private timers = new Map<string, number>()

  /**
   * 开始计时一个操作
   * 
   * @description
   * 为指定操作开始计时。如果该操作已经在计时中，会覆盖之前的计时器。
   * 
   * @param {string} operation - 操作名称，用于标识计时器
   * 
   * @example
   * ```typescript
   * monitor.start('file_scan')
   * // ... 执行文件扫描
   * monitor.end('file_scan')
   * ```
   */
  start(operation: string): void {
    this.timers.set(operation, Date.now())
  }

  /**
   * 结束计时并记录指标
   * 
   * @description
   * 结束指定操作的计时，计算持续时间并记录到指标列表中。
   * 
   * @param {string} operation - 操作名称，必须与 start() 中的名称匹配
   * @param {Record<string, any>} metadata - 可选的元数据，用于记录额外信息
   * @returns {number} 操作持续时间（毫秒）
   * @throws {Error} 当操作没有对应的开始计时器时抛出错误
   * 
   * @example
   * ```typescript
   * monitor.start('api_call')
   * const result = await fetch('/api/data')
   * const duration = monitor.end('api_call', { status: result.status })
   * console.log(`API 调用耗时: ${duration}ms`)
   * ```
   */
  end(operation: string, metadata?: Record<string, any>): number {
    const startTime = this.timers.get(operation)
    if (!startTime) {
      throw new Error(`No timer found for operation: ${operation}`)
    }

    const duration = Date.now() - startTime
    this.timers.delete(operation)

    this.metrics.push({
      operation,
      duration,
      timestamp: new Date().toISOString(),
      metadata
    })

    return duration
  }

  /**
   * 测量一个异步函数的执行时间
   * 
   * @description
   * 包装一个异步函数，自动测量其执行时间并记录指标。
   * 这是一个便捷方法，避免手动调用 start() 和 end()。
   * 
   * @template T - 函数返回值的类型
   * @param {string} operation - 操作名称
   * @param {() => Promise<T>} fn - 要测量的异步函数
   * @param {Record<string, any>} metadata - 可选的元数据
   * @returns {Promise<T>} 函数的返回值
   * 
   * @example
   * ```typescript
   * const result = await monitor.measure('fetch_users', async () => {
   *   return await db.users.findMany()
   * }, { limit: 100 })
   * ```
   */
  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.start(operation)
    try {
      const result = await fn()
      this.end(operation, metadata)
      return result
    } catch (error) {
      // 即使出错也要记录时间
      this.end(operation, { ...metadata, error: true })
      throw error
    }
  }

  /**
   * 测量一个同步函数的执行时间
   * 
   * @description
   * 包装一个同步函数，自动测量其执行时间并记录指标。
   * 
   * @template T - 函数返回值的类型
   * @param {string} operation - 操作名称
   * @param {() => T} fn - 要测量的同步函数
   * @param {Record<string, any>} metadata - 可选的元数据
   * @returns {T} 函数的返回值
   * 
   * @example
   * ```typescript
   * const result = monitor.measureSync('parse_json', () => {
   *   return JSON.parse(data)
   * })
   * ```
   */
  measureSync<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    this.start(operation)
    try {
      const result = fn()
      this.end(operation, metadata)
      return result
    } catch (error) {
      this.end(operation, { ...metadata, error: true })
      throw error
    }
  }

  /**
   * 获取性能报告
   * 
   * @description
   * 生成包含所有记录指标的详细报告，包括：
   * - 总耗时
   * - 所有操作的详细列表
   * - 每个操作的统计汇总（次数、平均/最小/最大耗时）
   * 
   * @returns {PerformanceReport} 性能报告对象
   * 
   * @example
   * ```typescript
   * const report = monitor.getReport()
   * console.log(`总耗时: ${report.total}ms`)
   * 
   * for (const [op, stats] of Object.entries(report.summary)) {
   *   console.log(`${op}: 执行${stats.count}次, 平均${stats.avgDuration}ms`)
   * }
   * ```
   */
  getReport(): PerformanceReport {
    const summary: Record<string, OperationSummary> = {}

    for (const metric of this.metrics) {
      if (!summary[metric.operation]) {
        summary[metric.operation] = {
          count: 0,
          avgDuration: 0,
          totalDuration: 0,
          minDuration: Infinity,
          maxDuration: 0
        }
      }

      const s = summary[metric.operation]
      s.count++
      s.totalDuration += metric.duration
      s.avgDuration = s.totalDuration / s.count
      s.minDuration = Math.min(s.minDuration, metric.duration)
      s.maxDuration = Math.max(s.maxDuration, metric.duration)
    }

    return {
      total: this.metrics.reduce((sum, m) => sum + m.duration, 0),
      operations: this.metrics,
      summary
    }
  }

  /**
   * 获取特定操作的指标
   * 
   * @description
   * 返回指定操作名称的所有指标记录。
   * 
   * @param {string} operation - 操作名称
   * @returns {PerformanceMetrics[]} 该操作的所有指标记录
   * 
   * @example
   * ```typescript
   * const scanMetrics = monitor.getMetrics('file_scan')
   * console.log(`文件扫描执行了 ${scanMetrics.length} 次`)
   * ```
   */
  getMetrics(operation: string): PerformanceMetrics[] {
    return this.metrics.filter(m => m.operation === operation)
  }

  /**
   * 获取最慢的操作
   * 
   * @description
   * 返回耗时最长的 N 个操作。
   * 
   * @param {number} limit - 返回的操作数量，默认为 10
   * @returns {PerformanceMetrics[]} 按耗时降序排列的操作列表
   * 
   * @example
   * ```typescript
   * const slowest = monitor.getSlowestOperations(5)
   * slowest.forEach(op => {
   *   console.log(`${op.operation}: ${op.duration}ms`)
   * })
   * ```
   */
  getSlowestOperations(limit: number = 10): PerformanceMetrics[] {
    return [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
  }

  /**
   * 清除所有指标
   * 
   * @description
   * 清除所有已记录的指标和正在运行的计时器。
   * 用于重置监控器状态或释放内存。
   * 
   * @example
   * ```typescript
   * monitor.clear()
   * // 监控器重置为初始状态
   * ```
   */
  clear(): void {
    this.metrics = []
    this.timers.clear()
  }

  /**
   * 导出性能数据到文件
   * 
   * @description
   * 将性能报告以 JSON 格式导出到指定文件。
   * 导出的数据包含完整的性能报告，可用于后续分析或存档。
   * 
   * @param {string} outputPath - 输出文件路径
   * @returns {Promise<void>}
   * 
   * @example
   * ```typescript
   * await monitor.export('./reports/performance-2024-01-01.json')
   * console.log('性能报告已导出')
   * ```
   */
  async export(outputPath: string): Promise<void> {
    const report = this.getReport()
    await fs.writeJSON(outputPath, report, { spaces: 2 })
  }

  /**
   * 从文件导入性能数据
   * 
   * @description
   * 从 JSON 文件导入之前导出的性能数据。
   * 导入的数据会添加到当前的指标列表中。
   * 
   * @param {string} inputPath - 输入文件路径
   * @returns {Promise<void>}
   * 
   * @example
   * ```typescript
   * await monitor.import('./reports/previous-run.json')
   * // 可以合并多次运行的数据进行比较
   * ```
   */
  async import(inputPath: string): Promise<void> {
    const data = await fs.readJSON(inputPath)
    if (data.operations && Array.isArray(data.operations)) {
      this.metrics.push(...data.operations)
    }
  }

  /**
   * 获取当前正在运行的计时器列表
   * 
   * @description
   * 返回所有正在运行但尚未结束的计时器名称。
   * 用于调试或检查是否有忘记结束的计时器。
   * 
   * @returns {string[]} 正在运行的操作名称列表
   * 
   * @example
   * ```typescript
   * const running = monitor.getRunningTimers()
   * if (running.length > 0) {
   *   console.warn('有未完成的计时器:', running)
   * }
   * ```
   */
  getRunningTimers(): string[] {
    return Array.from(this.timers.keys())
  }

  /**
   * 生成人类可读的性能摘要
   * 
   * @description
   * 生成格式化的文本摘要，便于在控制台输出或日志中查看。
   * 
   * @returns {string} 格式化的性能摘要文本
   * 
   * @example
   * ```typescript
   * console.log(monitor.getSummaryText())
   * // 输出：
   * // === Performance Summary ===
   * // Total Duration: 5432ms
   * // Operations: 15
   * // 
   * // file_scan: 3 times, avg 234ms
   * // vulnerability_check: 1 time, avg 1500ms
   * // ...
   * ```
   */
  getSummaryText(): string {
    const report = this.getReport()
    const lines: string[] = []

    lines.push('=== Performance Summary ===')
    lines.push(`Total Duration: ${report.total}ms`)
    lines.push(`Operations: ${this.metrics.length}`)
    lines.push('')

    for (const [operation, stats] of Object.entries(report.summary)) {
      const times = stats.count === 1 ? 'time' : 'times'
      lines.push(
        `${operation}: ${stats.count} ${times}, ` +
        `avg ${Math.round(stats.avgDuration)}ms, ` +
        `min ${Math.round(stats.minDuration)}ms, ` +
        `max ${Math.round(stats.maxDuration)}ms`
      )
    }

    return lines.join('\n')
  }
}

/**
 * 创建性能监控器实例
 * 
 * @description
 * 工厂函数，用于创建新的性能监控器实例。
 * 
 * @returns {PerformanceMonitor} 新的性能监控器实例
 * 
 * @example
 * ```typescript
 * const monitor = createPerformanceMonitor()
 * ```
 */
export function createPerformanceMonitor(): PerformanceMonitor {
  return new PerformanceMonitor()
}

