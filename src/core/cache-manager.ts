import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'

/**
 * 缓存项
 */
interface CacheItem<T> {
  key: string
  value: T
  timestamp: number
  hash: string
}

/**
 * 缓存统计
 */
interface CacheStats {
  hits: number
  misses: number
  size: number
  hitRate: number
}

/**
 * 智能缓存管理器 - LRU缓存策略，支持持久化
 */
export class CacheManager {
  private cache = new Map<string, CacheItem<any>>()
  private accessOrder: string[] = []
  private maxSize: number
  private cacheDir: string
  private stats = {
    hits: 0,
    misses: 0
  }

  constructor(
    private projectDir: string = process.cwd(),
    options: {
      maxSize?: number
      cacheDir?: string
      ttl?: number
    } = {}
  ) {
    this.maxSize = options.maxSize || 1000
    this.cacheDir = options.cacheDir || path.join(projectDir, '.security-cache')
  }

  /**
   * 获取缓存值
   */
  async get<T>(key: string): Promise<T | null> {
    // 尝试从内存获取
    if (this.cache.has(key)) {
      this.stats.hits++
      this.updateAccessOrder(key)
      return this.cache.get(key)!.value as T
    }

    // 尝试从磁盘获取
    const diskValue = await this.getFromDisk<T>(key)
    if (diskValue) {
      this.stats.hits++
      this.cache.set(key, diskValue)
      this.updateAccessOrder(key)
      return diskValue.value
    }

    this.stats.misses++
    return null
  }

  /**
   * 设置缓存值
   */
  async set<T>(key: string, value: T, metadata?: { hash?: string }): Promise<void> {
    const item: CacheItem<T> = {
      key,
      value,
      timestamp: Date.now(),
      hash: metadata?.hash || this.generateHash(JSON.stringify(value))
    }

    // 检查是否需要淘汰
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, item)
    this.updateAccessOrder(key)

    // 持久化到磁盘
    await this.saveToDisk(item)
  }

  /**
   * 根据文件内容生成缓存键
   */
  async getCacheKey(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const hash = this.generateHash(content)
      return `file:${filePath}:${hash}`
    } catch (error) {
      return `file:${filePath}:unknown`
    }
  }

  /**
   * 根据依赖生成缓存键
   */
  getDependencyCacheKey(dependencies: Record<string, string>): string {
    const sorted = Object.keys(dependencies).sort()
    const depsString = sorted.map(k => `${k}@${dependencies[k]}`).join(',')
    return `deps:${this.generateHash(depsString)}`
  }

  /**
   * 清除缓存
   */
  async clear(): Promise<void> {
    this.cache.clear()
    this.accessOrder = []
    this.stats = { hits: 0, misses: 0 }

    // 清除磁盘缓存
    if (await fs.pathExists(this.cacheDir)) {
      await fs.remove(this.cacheDir)
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    const hitRate = total > 0 ? this.stats.hits / total : 0

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100
    }
  }

  /**
   * 移除过期缓存
   */
  async pruneExpired(ttl: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now()
    let removed = 0

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > ttl) {
        this.cache.delete(key)
        this.accessOrder = this.accessOrder.filter(k => k !== key)
        removed++
      }
    }

    return removed
  }

  /**
   * 更新访问顺序（LRU）
   */
  private updateAccessOrder(key: string): void {
    // 移除旧位置
    this.accessOrder = this.accessOrder.filter(k => k !== key)
    // 添加到末尾（最近使用）
    this.accessOrder.push(key)
  }

  /**
   * 淘汰最少使用的项（LRU）
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return

    const lruKey = this.accessOrder.shift()!
    this.cache.delete(lruKey)
  }

  /**
   * 生成哈希
   */
  private generateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)
  }

  /**
   * 从磁盘读取缓存
   */
  private async getFromDisk<T>(key: string): Promise<CacheItem<T> | null> {
    try {
      const filename = this.generateHash(key)
      const filePath = path.join(this.cacheDir, `${filename}.json`)

      if (await fs.pathExists(filePath)) {
        const data = await fs.readJSON(filePath)
        return data as CacheItem<T>
      }
    } catch (error) {
      // 忽略读取错误
    }
    return null
  }

  /**
   * 保存到磁盘
   */
  private async saveToDisk<T>(item: CacheItem<T>): Promise<void> {
    try {
      await fs.ensureDir(this.cacheDir)
      const filename = this.generateHash(item.key)
      const filePath = path.join(this.cacheDir, `${filename}.json`)
      await fs.writeJSON(filePath, item)
    } catch (error) {
      // 忽略保存错误
    }
  }
}


