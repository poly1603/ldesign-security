/**
 * 并行执行工具类
 * 
 * @description
 * 提供高效的并行任务执行功能，支持并发限制、批处理等策略。
 * 用于优化大量异步操作的性能，避免资源耗尽。
 * 
 * @example
 * ```typescript
 * // 并发限制的批量处理
 * const tasks = files.map(file => () => processFile(file))
 * const results = await ParallelExecutor.allWithLimit(tasks, 5)
 * 
 * // 批量处理
 * const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
 * const results = await ParallelExecutor.batch(items, 3, async batch => {
 *   return batch.map(n => n * 2)
 * })
 * ```
 */
export class ParallelExecutor {
  /**
   * 并发限制的 Promise.all
   * 
   * @description
   * 执行一组异步任务，但限制同时运行的任务数量。
   * 这可以避免在处理大量任务时耗尽系统资源（如文件描述符、内存等）。
   * 
   * @template T - 任务返回值的类型
   * @param {Array<() => Promise<T>>} tasks - 任务创建函数数组
   * @param {number} limit - 最大并发数，默认为 5
   * @returns {Promise<T[]>} 所有任务的结果数组，顺序与输入顺序一致
   * 
   * @example
   * ```typescript
   * // 处理 100 个文件，但最多同时处理 10 个
   * const fileTasks = files.map(file => () => fs.readFile(file))
   * const contents = await ParallelExecutor.allWithLimit(fileTasks, 10)
   * ```
   */
  static async allWithLimit<T>(
    tasks: Array<() => Promise<T>>,
    limit: number = 5
  ): Promise<T[]> {
    const results: T[] = new Array(tasks.length)
    const executing: Array<Promise<void>> = []
    let index = 0

    for (let i = 0; i < tasks.length; i++) {
      const taskIndex = i
      const task = tasks[i]

      const promise = (async () => {
        results[taskIndex] = await task()
      })()

      executing.push(promise)

      // 当达到并发限制时，等待最快完成的任务
      if (executing.length >= limit) {
        await Promise.race(executing)
        // 移除已完成的 promise
        const completedIndex = executing.findIndex(
          p => p === Promise.resolve(p)
        )
        if (completedIndex !== -1) {
          executing.splice(completedIndex, 1)
        }
      }

      promise.finally(() => {
        const idx = executing.indexOf(promise)
        if (idx !== -1) {
          executing.splice(idx, 1)
        }
      })
    }

    // 等待所有剩余任务完成
    await Promise.all(executing)
    return results
  }

  /**
   * 分批执行任务
   * 
   * @description
   * 将数据分成多个批次，依次处理每个批次。
   * 适用于需要顺序处理或限制资源使用的场景。
   * 
   * @template T - 输入项的类型
   * @template R - 返回结果的类型
   * @param {T[]} items - 要处理的数据项数组
   * @param {number} batchSize - 每批处理的数据项数量
   * @param {(batch: T[]) => Promise<R[]>} processor - 批处理函数
   * @returns {Promise<R[]>} 所有批次的结果合并后的数组
   * 
   * @example
   * ```typescript
   * // 每次处理 50 条数据库记录
   * const records = await ParallelExecutor.batch(
   *   ids,
   *   50,
   *   async (batch) => await db.users.findMany({ where: { id: { in: batch } } })
   * )
   * ```
   */
  static async batch<T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<R[]> {
    const results: R[] = []

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const batchResults = await processor(batch)
      results.push(...batchResults)
    }

    return results
  }

  /**
   * 并行批处理
   * 
   * @description
   * 将数据分成多个批次，并行处理这些批次（但限制并发数）。
   * 结合了批处理和并发限制的优点。
   * 
   * @template T - 输入项的类型
   * @template R - 返回结果的类型
   * @param {T[]} items - 要处理的数据项数组
   * @param {number} batchSize - 每批处理的数据项数量
   * @param {number} concurrency - 最大并发批次数
   * @param {(batch: T[]) => Promise<R[]>} processor - 批处理函数
   * @returns {Promise<R[]>} 所有批次的结果合并后的数组
   * 
   * @example
   * ```typescript
   * // 将 1000 个文件分成 10 个批次，每批 100 个，同时处理 3 个批次
   * const results = await ParallelExecutor.batchParallel(
   *   files,
   *   100,
   *   3,
   *   async (batch) => Promise.all(batch.map(f => processFile(f)))
   * )
   * ```
   */
  static async batchParallel<T, R>(
    items: T[],
    batchSize: number,
    concurrency: number,
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<R[]> {
    // 创建批次
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }

    // 并发处理批次
    const batchTasks = batches.map(batch => () => processor(batch))
    const batchResults = await this.allWithLimit(batchTasks, concurrency)

    // 合并结果
    return batchResults.flat()
  }

  /**
   * 带重试的任务执行
   * 
   * @description
   * 执行一个任务，失败时自动重试指定次数。
   * 支持指数退避策略。
   * 
   * @template T - 任务返回值的类型
   * @param {() => Promise<T>} task - 要执行的任务
   * @param {Object} options - 重试选项
   * @param {number} options.maxRetries - 最大重试次数，默认为 3
   * @param {number} options.initialDelay - 初始延迟时间（毫秒），默认为 1000
   * @param {number} options.backoffMultiplier - 退避倍数，默认为 2
   * @param {(error: Error) => boolean} options.shouldRetry - 判断是否应该重试的函数
   * @returns {Promise<T>} 任务结果
   * @throws {Error} 所有重试都失败后抛出最后一个错误
   * 
   * @example
   * ```typescript
   * const data = await ParallelExecutor.retry(
   *   () => fetchDataFromAPI(),
   *   {
   *     maxRetries: 5,
   *     initialDelay: 2000,
   *     shouldRetry: (error) => error.message.includes('timeout')
   *   }
   * )
   * ```
   */
  static async retry<T>(
    task: () => Promise<T>,
    options: {
      maxRetries?: number
      initialDelay?: number
      backoffMultiplier?: number
      shouldRetry?: (error: Error) => boolean
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      backoffMultiplier = 2,
      shouldRetry = () => true
    } = options

    let lastError: Error | undefined
    let delay = initialDelay

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await task()
      } catch (error) {
        lastError = error as Error

        // 检查是否应该重试
        if (!shouldRetry(lastError) || attempt === maxRetries) {
          throw lastError
        }

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= backoffMultiplier
      }
    }

    throw lastError
  }

  /**
   * 映射数组并并发执行
   * 
   * @description
   * 类似于 Array.map()，但异步执行并限制并发数。
   * 
   * @template T - 输入项的类型
   * @template R - 返回结果的类型
   * @param {T[]} items - 要处理的数据项数组
   * @param {(item: T, index: number) => Promise<R>} fn - 映射函数
   * @param {number} concurrency - 最大并发数，默认为 5
   * @returns {Promise<R[]>} 映射后的结果数组
   * 
   * @example
   * ```typescript
   * const urls = ['url1', 'url2', 'url3', ...]
   * const contents = await ParallelExecutor.map(
   *   urls,
   *   async (url) => await fetch(url).then(r => r.text()),
   *   10
   * )
   * ```
   */
  static async map<T, R>(
    items: T[],
    fn: (item: T, index: number) => Promise<R>,
    concurrency: number = 5
  ): Promise<R[]> {
    const tasks = items.map((item, index) => () => fn(item, index))
    return this.allWithLimit(tasks, concurrency)
  }

  /**
   * 过滤数组并并发执行
   * 
   * @description
   * 类似于 Array.filter()，但异步执行并限制并发数。
   * 
   * @template T - 数据项的类型
   * @param {T[]} items - 要过滤的数据项数组
   * @param {(item: T, index: number) => Promise<boolean>} predicate - 过滤谓词函数
   * @param {number} concurrency - 最大并发数，默认为 5
   * @returns {Promise<T[]>} 过滤后的数组
   * 
   * @example
   * ```typescript
   * const files = ['file1.txt', 'file2.txt', ...]
   * const existingFiles = await ParallelExecutor.filter(
   *   files,
   *   async (file) => await fs.pathExists(file),
   *   10
   * )
   * ```
   */
  static async filter<T>(
    items: T[],
    predicate: (item: T, index: number) => Promise<boolean>,
    concurrency: number = 5
  ): Promise<T[]> {
    const results = await this.map(items, predicate, concurrency)
    return items.filter((_, index) => results[index])
  }

  /**
   * 归约数组并并发执行
   * 
   * @description
   * 执行类似 Array.reduce() 的操作，但允许异步归约函数。
   * 注意：归约操作本质上是串行的，此方法按顺序执行。
   * 
   * @template T - 输入项的类型
   * @template R - 累加器的类型
   * @param {T[]} items - 要归约的数据项数组
   * @param {(accumulator: R, item: T, index: number) => Promise<R>} fn - 归约函数
   * @param {R} initialValue - 初始累加器值
   * @returns {Promise<R>} 最终归约结果
   * 
   * @example
   * ```typescript
   * const total = await ParallelExecutor.reduce(
   *   files,
   *   async (sum, file) => {
   *     const content = await fs.readFile(file, 'utf-8')
   *     return sum + content.length
   *   },
   *   0
   * )
   * ```
   */
  static async reduce<T, R>(
    items: T[],
    fn: (accumulator: R, item: T, index: number) => Promise<R>,
    initialValue: R
  ): Promise<R> {
    let accumulator = initialValue
    for (let i = 0; i < items.length; i++) {
      accumulator = await fn(accumulator, items[i], i)
    }
    return accumulator
  }

  /**
   * 竞态执行 - 返回最快完成的结果
   * 
   * @description
   * 执行多个任务，返回第一个成功完成的结果。
   * 其他任务会被忽略（但不会被取消）。
   * 
   * @template T - 任务返回值的类型
   * @param {Array<() => Promise<T>>} tasks - 任务创建函数数组
   * @returns {Promise<T>} 最快完成的任务结果
   * @throws {Error} 如果所有任务都失败，抛出聚合错误
   * 
   * @example
   * ```typescript
   * // 从多个镜像源下载，使用最快的那个
   * const data = await ParallelExecutor.race([
   *   () => fetch('https://mirror1.com/file'),
   *   () => fetch('https://mirror2.com/file'),
   *   () => fetch('https://mirror3.com/file')
   * ])
   * ```
   */
  static async race<T>(tasks: Array<() => Promise<T>>): Promise<T> {
    return Promise.race(tasks.map(task => task()))
  }

  /**
   * 限时执行任务
   * 
   * @description
   * 执行一个任务，如果超过指定时间未完成则抛出超时错误。
   * 
   * @template T - 任务返回值的类型
   * @param {() => Promise<T>} task - 要执行的任务
   * @param {number} timeout - 超时时间（毫秒）
   * @param {string} timeoutMessage - 超时错误消息
   * @returns {Promise<T>} 任务结果
   * @throws {Error} 超时时抛出错误
   * 
   * @example
   * ```typescript
   * try {
   *   const result = await ParallelExecutor.timeout(
   *     () => fetchDataFromSlowAPI(),
   *     5000,
   *     'API 请求超时'
   *   )
   * } catch (error) {
   *   console.error('请求超时:', error.message)
   * }
   * ```
   */
  static async timeout<T>(
    task: () => Promise<T>,
    timeout: number,
    timeoutMessage: string = 'Operation timed out'
  ): Promise<T> {
    return Promise.race([
      task(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(timeoutMessage)), timeout)
      )
    ])
  }

  /**
   * 延迟执行
   * 
   * @description
   * 创建一个延迟指定时间的 Promise。
   * 
   * @param {number} ms - 延迟时间（毫秒）
   * @returns {Promise<void>}
   * 
   * @example
   * ```typescript
   * console.log('开始')
   * await ParallelExecutor.delay(2000)
   * console.log('2秒后')
   * ```
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

