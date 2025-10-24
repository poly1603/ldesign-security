#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import Table from 'cli-table3'
import boxen from 'boxen'
import fs from 'fs-extra'
import path from 'path'
import {
  SecurityScanner,
  VulnerabilityChecker,
  LicenseChecker,
  SBOMGenerator,
  PolicyManager,
  Notifier,
  Scheduler,
  ProjectManager,
  IncrementalScanner
} from '../core'
import {
  HTMLReporter,
  JSONReporter,
  YAMLReporter,
  SARIFReporter,
  PDFReporter,
  MarkdownReporter,
  ExcelReporter
} from '../reporters'
import { ScanHistory } from '../storage/scan-history'
import { DependencyVisualizer } from '../visualizers/dependency-graph'
import { runInteractiveWizard } from './interactive-wizard'

const program = new Command()

program
  .name('ldesign-security')
  .description('LDesign 安全工具 - 全面的项目安全扫描和防护')
  .version('1.0.0')

// ==================== SCAN 命令 ====================
program
  .command('scan')
  .description('执行完整安全扫描')
  .option('-d, --dir <directory>', '项目目录', process.cwd())
  .option('--skip-vulnerabilities', '跳过漏洞扫描')
  .option('--skip-code', '跳过代码审计')
  .option('--skip-secrets', '跳过敏感信息扫描')
  .option('--skip-injection', '跳过注入检测')
  .option('--skip-license', '跳过许可证检查')
  .option('--skip-supply-chain', '跳过供应链分析')
  .action(async (options) => {
    const spinner = ora('正在执行安全扫描...').start()

    try {
      const scanner = new SecurityScanner({
        projectDir: options.dir,
        skipVulnerabilities: options.skipVulnerabilities,
        skipCodeAudit: options.skipCode,
        skipSecrets: options.skipSecrets,
        skipInjection: options.skipInjection,
        skipLicense: options.skipLicense,
        skipSupplyChain: options.skipSupplyChain
      })

      const result = await scanner.scan()
      spinner.stop()

      displayScanResult(result)
    } catch (error) {
      spinner.fail(chalk.red('扫描失败'))
      console.error(error)
      process.exit(1)
    }
  })

// ==================== CHECK 命令 ====================
program
  .command('check')
  .description('快速检查依赖漏洞')
  .option('-d, --dir <directory>', '项目目录', process.cwd())
  .action(async (options) => {
    const spinner = ora('正在检查漏洞...').start()

    try {
      const checker = new VulnerabilityChecker(options.dir)
      const vulnerabilities = await checker.check()

      spinner.stop()

      if (vulnerabilities.length === 0) {
        console.log(chalk.green.bold('\n✅ 未发现漏洞！\n'))
        return
      }

      console.log(chalk.red.bold(`\n🚨 发现 ${vulnerabilities.length} 个漏洞:\n`))

      const table = new Table({
        head: ['包名', '严重程度', '问题', 'CVE', '来源'],
        colWidths: [25, 12, 35, 20, 10]
      })

      vulnerabilities.forEach(vuln => {
        table.push([
          vuln.package,
          getSeverityColor(vuln.severity)(vuln.severity),
          vuln.title,
          vuln.cve || '-',
          vuln.source || 'npm'
        ])
      })

      console.log(table.toString())
      console.log(chalk.gray(`\n运行 ${chalk.white('lsec fix')} 尝试自动修复\n`))
    } catch (error) {
      spinner.fail(chalk.red('检查失败'))
      console.error(error)
      process.exit(1)
    }
  })

// ==================== FIX 命令 ====================
program
  .command('fix')
  .description('自动修复漏洞')
  .option('-d, --dir <directory>', '项目目录', process.cwd())
  .option('--force', '强制修复（可能导致破坏性更新）')
  .action(async (options) => {
    const spinner = ora('正在修复漏洞...').start()

    try {
      const checker = new VulnerabilityChecker(options.dir)
      const result = options.force
        ? await checker.fixForce()
        : await checker.fix()

      if (result.success) {
        spinner.succeed(chalk.green(`${result.message} (修复了 ${result.fixed} 个漏洞)`))
      } else {
        spinner.fail(chalk.red(result.message))
        process.exit(1)
      }
    } catch (error) {
      spinner.fail(chalk.red('修复失败'))
      console.error(error)
      process.exit(1)
    }
  })

// ==================== LICENSE 命令 ====================
program
  .command('license')
  .description('检查许可证合规性')
  .option('-d, --dir <directory>', '项目目录', process.cwd())
  .option('-f, --format <format>', '报告格式 (text|json|html)', 'text')
  .option('-o, --output <file>', '输出文件路径')
  .action(async (options) => {
    const spinner = ora('正在检查许可证...').start()

    try {
      const checker = new LicenseChecker(options.dir)
      const report = await checker.generateReport(options.format)

      spinner.stop()

      if (options.output) {
        await fs.writeFile(options.output, report, 'utf-8')
        console.log(chalk.green(`\n✅ 许可证报告已保存到: ${options.output}\n`))
      } else {
        console.log('\n' + report)
      }
    } catch (error) {
      spinner.fail(chalk.red('许可证检查失败'))
      console.error(error)
      process.exit(1)
    }
  })

// ==================== SBOM 命令 ====================
program
  .command('sbom')
  .description('生成软件物料清单 (SBOM)')
  .option('-d, --dir <directory>', '项目目录', process.cwd())
  .option('-f, --format <format>', '格式 (spdx|cyclonedx)', 'spdx')
  .option('-o, --output <file>', '输出文件路径')
  .action(async (options) => {
    const spinner = ora('正在生成 SBOM...').start()

    try {
      const generator = new SBOMGenerator(options.dir)
      const format = options.format.toLowerCase()

      let content: string
      if (format === 'spdx') {
        content = await generator.exportSPDX()
      } else if (format === 'cyclonedx') {
        content = await generator.exportCycloneDX()
      } else {
        throw new Error(`不支持的格式: ${format}`)
      }

      const outputPath = options.output || `sbom-${format}.json`
      await fs.writeFile(outputPath, content, 'utf-8')

      spinner.succeed(chalk.green(`SBOM 已生成: ${outputPath}`))
    } catch (error) {
      spinner.fail(chalk.red('SBOM 生成失败'))
      console.error(error)
      process.exit(1)
    }
  })

// ==================== REPORT 命令 ====================
program
  .command('report')
  .description('生成安全报告')
  .option('-d, --dir <directory>', '项目目录', process.cwd())
  .option('-f, --format <formats>', '报告格式 (html|json|yaml|sarif|pdf|markdown|excel)，多个格式用逗号分隔', 'html,json')
  .option('-o, --output <directory>', '输出目录', './security-reports')
  .action(async (options) => {
    const spinner = ora('正在生成报告...').start()

    try {
      // 先执行扫描
      const scanner = new SecurityScanner({ projectDir: options.dir })
      const result = await scanner.scan()

      // 保存到历史
      const history = new ScanHistory(options.dir)
      await history.save(result)

      // 确保输出目录存在
      await fs.ensureDir(options.output)

      // 生成指定格式的报告
      const formats = options.format.split(',').map((f: string) => f.trim())
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)

      for (const format of formats) {
        let reporter: any
        let filename: string

        switch (format) {
          case 'html':
            reporter = new HTMLReporter(result)
            filename = `security-report-${timestamp}.html`
            break
          case 'json':
            reporter = new JSONReporter(result)
            filename = `security-report-${timestamp}.json`
            break
          case 'yaml':
            reporter = new YAMLReporter(result)
            filename = `security-report-${timestamp}.yaml`
            break
          case 'sarif':
            reporter = new SARIFReporter(result)
            filename = `security-report-${timestamp}.sarif`
            break
          case 'pdf':
            reporter = new PDFReporter(result)
            filename = `security-report-${timestamp}.pdf`
            break
          case 'markdown':
          case 'md':
            reporter = new MarkdownReporter(result)
            filename = `security-report-${timestamp}.md`
            break
          case 'excel':
          case 'csv':
            reporter = new ExcelReporter(result)
            filename = `security-report-${timestamp}.csv`
            break
          default:
            console.warn(chalk.yellow(`未知格式: ${format}，跳过`))
            continue
        }

        const outputPath = path.join(options.output, filename)
        await reporter.save(outputPath)
        console.log(chalk.green(`✓ ${format.toUpperCase()} 报告: ${outputPath}`))
      }

      spinner.succeed(chalk.green('报告生成完成'))
    } catch (error) {
      spinner.fail(chalk.red('报告生成失败'))
      console.error(error)
      process.exit(1)
    }
  })

// ==================== POLICY 命令 ====================
program
  .command('policy')
  .description('管理安全策略')
  .option('-d, --dir <directory>', '项目目录', process.cwd())
  .option('--init', '初始化配置文件')
  .option('--show', '显示当前策略')
  .option('--interactive', '交互式配置')
  .option('--format <format>', '配置文件格式 (json|js)', 'json')
  .action(async (options) => {
    try {
      const manager = new PolicyManager(options.dir)

      if (options.interactive) {
        const spinner = ora('启动交互式配置向导...').start()
        const policy = await runInteractiveWizard()
        spinner.stop()
        await manager.save(policy, options.format)
        console.log(chalk.green(`\n✅ 配置已保存: .securityrc.${options.format}\n`))
        return
      }

      if (options.init) {
        const spinner = ora('正在初始化配置文件...').start()
        await manager.init(options.format)
        spinner.succeed(chalk.green(`配置文件已创建: .securityrc.${options.format}`))
        return
      }

      if (options.show) {
        const policy = await manager.getPolicy()
        console.log(chalk.bold('\n当前安全策略:\n'))
        console.log(JSON.stringify(policy, null, 2))
        console.log()
        return
      }

      // 默认：验证配置
      const policy = await manager.load()
      const validation = manager.validate(policy)

      if (validation.valid) {
        console.log(chalk.green('✅ 策略配置有效'))
      } else {
        console.log(chalk.red('❌ 策略配置无效:'))
        validation.errors.forEach(err => console.log(`  - ${err}`))
        process.exit(1)
      }
    } catch (error) {
      console.error(chalk.red('策略管理失败:'), error)
      process.exit(1)
    }
  })

// ==================== MONITOR 命令 ====================
program
  .command('monitor')
  .description('启动监控模式（定时扫描）')
  .option('-d, --dir <directory>', '项目目录', process.cwd())
  .option('-c, --cron <expression>', 'Cron表达式', '0 0 * * *')
  .option('--on-start', '启动时立即扫描')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n📡 启动监控模式\n'))

    const scheduler = new Scheduler(options.dir, {
      enabled: true,
      cron: options.cron,
      onStart: options.onStart
    })

    scheduler.start()

    console.log(chalk.green(`✓ 调度器已启动`))
    console.log(chalk.gray(`  Cron表达式: ${options.cron}`))
    console.log(chalk.gray(`  按 Ctrl+C 停止监控\n`))

    // 保持进程运行
    process.on('SIGINT', () => {
      scheduler.stop()
      process.exit(0)
    })
  })

// ==================== HISTORY 命令 ====================
program
  .command('history')
  .description('查看扫描历史')
  .option('-d, --dir <directory>', '项目目录', process.cwd())
  .option('-l, --limit <number>', '显示数量', '10')
  .option('--trend', '显示趋势分析')
  .action(async (options) => {
    try {
      const history = new ScanHistory(options.dir)

      if (options.trend) {
        const spinner = ora('分析趋势...').start()
        const trend = await history.analyzeTrend(30)
        spinner.stop()

        console.log(chalk.bold('\n📈 趋势分析（最近30天）:\n'))
        console.log(`  趋势: ${trend.trend === 'improving' ? chalk.green('改善') : trend.trend === 'worsening' ? chalk.red('恶化') : chalk.yellow('稳定')}`)
        console.log(`  平均问题数: ${trend.summary.avgIssues}`)
        console.log(`  最大问题数: ${trend.summary.maxIssues}`)
        console.log(`  最小问题数: ${trend.summary.minIssues}`)
        console.log(`  变化率: ${trend.summary.changeRate}%`)
        console.log()
      } else {
        const records = await history.query({ limit: parseInt(options.limit) })

        console.log(chalk.bold(`\n📚 扫描历史（最近 ${records.length} 条）:\n`))

        const table = new Table({
          head: ['时间', '风险等级', '总问题', 'Critical', 'High', 'Medium', 'Low'],
          colWidths: [22, 12, 10, 10, 10, 10, 10]
        })

        records.forEach(record => {
          table.push([
            new Date(record.timestamp).toLocaleString('zh-CN'),
            getRiskLevelColor(record.riskLevel)(record.riskLevel),
            record.summary.totalIssues,
            record.summary.critical,
            record.summary.high,
            record.summary.medium,
            record.summary.low
          ])
        })

        console.log(table.toString())
        console.log()
      }
    } catch (error) {
      console.error(chalk.red('查询历史失败:'), error)
      process.exit(1)
    }
  })

// ==================== PROJECTS 命令 ====================
program
  .command('projects')
  .description('管理多项目')
  .option('-d, --dir <directory>', '工作区目录', process.cwd())
  .option('--scan-all', '扫描所有项目')
  .option('--list', '列出所有项目')
  .action(async (options) => {
    try {
      const manager = new ProjectManager(options.dir)

      if (options.list) {
        const projects = await manager.loadProjects()
        console.log(chalk.bold('\n📂 项目列表:\n'))

        projects.forEach(project => {
          console.log(`  ${project.enabled ? '✓' : '✗'} ${project.name}`)
          console.log(`    ID: ${project.id}`)
          console.log(`    路径: ${project.path}`)
          console.log()
        })
        return
      }

      if (options.scanAll) {
        const spinner = ora('扫描所有项目...').start()
        const results = await manager.scanAll(true)
        spinner.stop()

        console.log(chalk.bold('\n📊 多项目扫描结果:\n'))

        for (const [id, result] of results) {
          const project = (await manager.loadProjects()).find(p => p.id === id)
          console.log(`\n${chalk.bold(project?.name || id)}:`)
          console.log(`  风险: ${getRiskLevelColor(result.riskLevel)(result.riskLevel)}`)
          console.log(`  问题: ${result.summary.totalIssues}`)
        }
        console.log()
      }
    } catch (error) {
      console.error(chalk.red('项目管理失败:'), error)
      process.exit(1)
    }
  })

// ==================== CI 命令 ====================
program
  .command('ci')
  .description('CI/CD 集成模式')
  .option('-d, --dir <directory>', '项目目录', process.cwd())
  .option('--fail-on <severity>', '失败阈值 (critical|high|medium|low)', 'high')
  .option('--sarif', '生成 SARIF 报告')
  .action(async (options) => {
    const spinner = ora('正在执行 CI 扫描...').start()

    try {
      const scanner = new SecurityScanner({ projectDir: options.dir })
      const result = await scanner.scan()

      spinner.stop()

      // 简化的 CI 输出
      console.log(chalk.bold('\n📊 扫描结果:'))
      console.log(`  总问题数: ${result.summary.totalIssues}`)
      console.log(`  风险等级: ${result.riskLevel.toUpperCase()}`)
      console.log(`  Critical: ${result.summary.critical}`)
      console.log(`  High: ${result.summary.high}`)
      console.log(`  Medium: ${result.summary.medium}`)
      console.log(`  Low: ${result.summary.low}`)
      console.log()

      // 生成 SARIF（用于 GitHub Code Scanning）
      if (options.sarif) {
        const sarifReporter = new SARIFReporter(result)
        await sarifReporter.save('security-results.sarif')
        console.log(chalk.green('✓ SARIF 报告已生成: security-results.sarif'))
      }

      // 根据阈值决定是否失败
      const failOn = options.failOn.toLowerCase()
      let shouldFail = false

      switch (failOn) {
        case 'critical':
          shouldFail = result.summary.critical > 0
          break
        case 'high':
          shouldFail = result.summary.critical > 0 || result.summary.high > 0
          break
        case 'medium':
          shouldFail = result.summary.critical > 0 || result.summary.high > 0 || result.summary.medium > 0
          break
        case 'low':
          shouldFail = result.summary.totalIssues > 0
          break
      }

      if (shouldFail) {
        console.log(chalk.red(`\n❌ 安全检查失败: 发现 ${failOn} 或更高级别的安全问题\n`))
        process.exit(1)
      } else {
        console.log(chalk.green('\n✅ 安全检查通过\n'))
      }
    } catch (error) {
      spinner.fail(chalk.red('CI 扫描失败'))
      console.error(error)
      process.exit(1)
    }
  })

program.parse()

// ==================== 辅助函数 ====================

function displayScanResult(result: any) {
  // 显示扫描报告
  console.log(boxen(
    chalk.bold(`🔒 安全扫描报告\n\n`) +
    `总问题数: ${result.summary.totalIssues}\n` +
    `风险等级: ${getRiskLevelColor(result.riskLevel)(result.riskLevel.toUpperCase())}\n` +
    `扫描耗时: ${result.duration}ms`,
    { padding: 1, margin: 1, borderStyle: 'round' }
  ))

  // 显示各类问题
  if (result.vulnerabilities.length > 0) {
    console.log(chalk.red.bold(`\n🚨 漏洞 (${result.vulnerabilities.length}):\n`))
    displayVulnerabilities(result.vulnerabilities.slice(0, 5))
    if (result.vulnerabilities.length > 5) {
      console.log(chalk.gray(`\n... 还有 ${result.vulnerabilities.length - 5} 个漏洞`))
    }
  }

  if (result.secrets && result.secrets.length > 0) {
    console.log(chalk.red.bold(`\n🔑 敏感信息泄露 (${result.secrets.length}):\n`))
    result.secrets.slice(0, 3).forEach((secret: any) => {
      console.log(`  ${getSeverityColor(secret.severity)('●')} ${secret.pattern}`)
      console.log(`    文件: ${secret.file}:${secret.line}`)
      console.log(`    类型: ${secret.type}`)
      console.log()
    })
  }

  if (result.injectionIssues && result.injectionIssues.length > 0) {
    console.log(chalk.red.bold(`\n💉 注入漏洞 (${result.injectionIssues.length}):\n`))
    result.injectionIssues.slice(0, 3).forEach((injection: any) => {
      console.log(`  ${getSeverityColor(injection.severity)('●')} ${injection.type.toUpperCase()} 注入`)
      console.log(`    文件: ${injection.file}:${injection.line}`)
      console.log(`    描述: ${injection.description}`)
      console.log()
    })
  }

  if (result.codeIssues.length > 0) {
    console.log(chalk.yellow.bold(`\n⚠️  代码问题 (${result.codeIssues.length}):\n`))
    console.log(chalk.gray(`  显示前 3 个问题，运行 'lsec report' 查看完整报告`))
  }

  if (result.licenseIssues && result.licenseIssues.length > 0) {
    console.log(chalk.blue.bold(`\n📄 许可证问题 (${result.licenseIssues.length}):\n`))
    console.log(chalk.gray(`  运行 'lsec license' 查看详细信息`))
  }

  if (result.supplyChainIssues && result.supplyChainIssues.length > 0) {
    console.log(chalk.magenta.bold(`\n🔗 供应链问题 (${result.supplyChainIssues.length}):\n`))
    result.supplyChainIssues.slice(0, 3).forEach((issue: any) => {
      console.log(`  ${getSeverityColor(issue.severity)('●')} ${issue.package}`)
      console.log(`    类型: ${issue.type}`)
      console.log(`    描述: ${issue.description}`)
      console.log()
    })
  }

  // 总结
  if (result.summary.totalIssues === 0) {
    console.log(chalk.green.bold('\n✅ 未发现安全问题！恭喜！\n'))
  } else {
    console.log(chalk.yellow.bold('\n💡 建议:'))
    console.log(`  1. 运行 ${chalk.white('lsec fix')} 尝试自动修复漏洞`)
    console.log(`  2. 运行 ${chalk.white('lsec report --format html')} 生成详细报告`)
    console.log(`  3. 运行 ${chalk.white('lsec license')} 检查许可证合规性`)
    console.log()
  }
}

function displayVulnerabilities(vulnerabilities: any[]) {
  const table = new Table({
    head: ['包名', '严重程度', '问题', 'CVE'],
    colWidths: [25, 12, 40, 20]
  })

  vulnerabilities.forEach(vuln => {
    table.push([
      vuln.package,
      getSeverityColor(vuln.severity)(vuln.severity),
      vuln.title.slice(0, 37) + (vuln.title.length > 37 ? '...' : ''),
      vuln.cve || '-'
    ])
  })

  console.log(table.toString())
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical':
      return chalk.bgRed.white.bold
    case 'high':
      return chalk.red.bold
    case 'medium':
      return chalk.yellow.bold
    case 'low':
      return chalk.blue
    default:
      return chalk.gray
  }
}

function getRiskLevelColor(level: string) {
  switch (level) {
    case 'critical':
      return chalk.bgRed.white.bold
    case 'high':
      return chalk.red.bold
    case 'medium':
      return chalk.yellow.bold
    case 'low':
      return chalk.blue
    case 'none':
      return chalk.green.bold
    default:
      return chalk.gray
  }
}

