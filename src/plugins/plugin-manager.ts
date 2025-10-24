import fs from 'fs-extra'
import path from 'path'
import type { SecurityScanResult } from '../types'
import { logger } from '../utils/logger'

/**
 * 插件接口
 */
export interface SecurityPlugin {
  name: string
  version: string

  /**
   * 插件初始化
   */
  init?(config: any): Promise<void>

  /**
   * 扫描前钩子
   */
  beforeScan?(options: any): Promise<void>

  /**
   * 扫描后钩子
   */
  afterScan?(result: SecurityScanResult): Promise<SecurityScanResult>

  /**
   * 报告生成前钩子
   */
  beforeReport?(result: SecurityScanResult): Promise<void>

  /**
   * 清理
   */
  cleanup?(): Promise<void>
}

/**
 * 插件管理器
 */
export class PluginManager {
  private plugins = new Map<string, SecurityPlugin>()
  private pluginDir: string

  constructor(private projectDir: string = process.cwd()) {
    this.pluginDir = path.join(projectDir, '.security-plugins')
  }

  /**
   * 加载插件
   */
  async loadPlugin(pluginPath: string, config?: any): Promise<void> {
    try {
      const fullPath = path.resolve(pluginPath)
      const plugin: SecurityPlugin = await import(fullPath)

      if (plugin.init) {
        await plugin.init(config)
      }

      this.plugins.set(plugin.name, plugin)
      logger.success(`Plugin loaded: ${plugin.name}@${plugin.version}`)
    } catch (error) {
      logger.error(`Failed to load plugin: ${pluginPath}`, error as Error)
    }
  }

  /**
   * 卸载插件
   */
  async unloadPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName)

    if (plugin) {
      if (plugin.cleanup) {
        await plugin.cleanup()
      }

      this.plugins.delete(pluginName)
      logger.info(`Plugin unloaded: ${pluginName}`)
    }
  }

  /**
   * 执行扫描前钩子
   */
  async runBeforeScanHooks(options: any): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.beforeScan) {
        try {
          await plugin.beforeScan(options)
        } catch (error) {
          logger.error(`Plugin ${plugin.name} beforeScan hook failed`, error as Error)
        }
      }
    }
  }

  /**
   * 执行扫描后钩子
   */
  async runAfterScanHooks(result: SecurityScanResult): Promise<SecurityScanResult> {
    let modifiedResult = result

    for (const plugin of this.plugins.values()) {
      if (plugin.afterScan) {
        try {
          modifiedResult = await plugin.afterScan(modifiedResult)
        } catch (error) {
          logger.error(`Plugin ${plugin.name} afterScan hook failed`, error as Error)
        }
      }
    }

    return modifiedResult
  }

  /**
   * 执行报告生成前钩子
   */
  async runBeforeReportHooks(result: SecurityScanResult): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.beforeReport) {
        try {
          await plugin.beforeReport(result)
        } catch (error) {
          logger.error(`Plugin ${plugin.name} beforeReport hook failed`, error as Error)
        }
      }
    }
  }

  /**
   * 获取所有插件
   */
  getPlugins(): SecurityPlugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * 获取插件数量
   */
  getPluginCount(): number {
    return this.plugins.size
  }

  /**
   * 清理所有插件
   */
  async cleanupAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.cleanup) {
        try {
          await plugin.cleanup()
        } catch (error) {
          logger.error(`Plugin ${plugin.name} cleanup failed`, error as Error)
        }
      }
    }

    this.plugins.clear()
  }
}

/**
 * 示例插件
 */
export const examplePlugin: SecurityPlugin = {
  name: 'example-plugin',
  version: '1.0.0',

  async init(config: any) {
    logger.info('Example plugin initialized', config)
  },

  async afterScan(result: SecurityScanResult) {
    // 可以修改扫描结果
    logger.info(`Example plugin processed ${result.summary.totalIssues} issues`)
    return result
  }
}


