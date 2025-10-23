#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import Table from 'cli-table3'
import boxen from 'boxen'
import { SecurityScanner, VulnerabilityChecker } from '../core'

const program = new Command()

program
  .name('ldesign-security')
  .description('LDesign 安全工具')
  .version('0.1.0')

program
  .command('scan')
  .description('执行完整安全扫描')
  .option('-d, --dir <directory>', '项目目录', process.cwd())
  .action(async (options) => {
    const spinner = ora('正在执行安全扫描...').start()
    
    try {
      const scanner = new SecurityScanner({ projectDir: options.dir })
      const result = await scanner.scan()
      
      spinner.stop()
      
      // 显示扫描结果
      console.log(boxen(
        chalk.bold(`🔒 安全扫描报告\n\n`) +
        `总问题数: ${result.summary.totalIssues}\n` +
        `风险等级: ${getRiskLevelColor(result.riskLevel)(result.riskLevel.toUpperCase())}\n` +
        `扫描耗时: ${result.duration}ms`,
        { padding: 1, margin: 1, borderStyle: 'round' }
      ))
      
      // 显示漏洞
      if (result.vulnerabilities.length > 0) {
        console.log(chalk.red.bold(`\n🚨 发现 ${result.vulnerabilities.length} 个漏洞:\n`))
        
        const vulnTable = new Table({
          head: ['包名', '严重程度', '问题', '建议'],
          colWidths: [25, 12, 30, 30]
        })
        
        result.vulnerabilities.slice(0, 10).forEach(vuln => {
          vulnTable.push([
            vuln.package,
            getSeverityColor(vuln.severity)(vuln.severity),
            vuln.title,
            vuln.recommendation
          ])
        })
        
        console.log(vulnTable.toString())
        
        if (result.vulnerabilities.length > 10) {
          console.log(chalk.gray(`\n... 还有 ${result.vulnerabilities.length - 10} 个漏洞未显示`))
        }
      }
      
      // 显示代码问题
      if (result.codeIssues.length > 0) {
        console.log(chalk.yellow.bold(`\n⚠️  发现 ${result.codeIssues.length} 个代码安全问题:\n`))
        
        const codeTable = new Table({
          head: ['文件', '位置', '问题'],
          colWidths: [40, 15, 45]
        })
        
        result.codeIssues.slice(0, 10).forEach(issue => {
          codeTable.push([
            issue.file.replace(process.cwd(), '.'),
            `${issue.line}:${issue.column}`,
            issue.message
          ])
        })
        
        console.log(codeTable.toString())
        
        if (result.codeIssues.length > 10) {
          console.log(chalk.gray(`\n... 还有 ${result.codeIssues.length - 10} 个问题未显示`))
        }
      }
      
      // 显示依赖问题
      if (result.dependencyIssues.length > 0) {
        console.log(chalk.blue.bold(`\n📦 发现 ${result.dependencyIssues.length} 个依赖问题:\n`))
        
        result.dependencyIssues.forEach(issue => {
          console.log(`  ${getSeverityColor(issue.severity)('●')} ${issue.package}@${issue.version}`)
          console.log(`    ${chalk.gray(issue.issue)}`)
          console.log(`    ${chalk.green('建议:')} ${issue.recommendation}\n`)
        })
      }
      
      // 总结
      if (result.summary.totalIssues === 0) {
        console.log(chalk.green.bold('\n✅ 未发现安全问题！'))
      } else {
        console.log(chalk.yellow.bold('\n💡 建议:'))
        console.log('  1. 运行 ldesign-security fix 尝试自动修复')
        console.log('  2. 手动更新有问题的依赖')
        console.log('  3. 修改代码中的安全问题')
      }
    } catch (error) {
      spinner.fail(chalk.red('扫描失败'))
      console.error(error)
    }
  })

program
  .command('check')
  .description('仅检查依赖漏洞')
  .option('-d, --dir <directory>', '项目目录', process.cwd())
  .action(async (options) => {
    const spinner = ora('正在检查漏洞...').start()
    
    try {
      const checker = new VulnerabilityChecker(options.dir)
      const vulnerabilities = await checker.check()
      
      spinner.stop()
      
      if (vulnerabilities.length === 0) {
        console.log(chalk.green('✅ 未发现漏洞！'))
        return
      }
      
      console.log(chalk.red.bold(`\n🚨 发现 ${vulnerabilities.length} 个漏洞:\n`))
      
      vulnerabilities.forEach(vuln => {
        console.log(`${getSeverityColor(vuln.severity)('●')} ${vuln.package}`)
        console.log(`  ${chalk.bold(vuln.title)}`)
        console.log(`  ${chalk.gray(vuln.description)}`)
        console.log(`  ${chalk.green('建议:')} ${vuln.recommendation}`)
        if (vuln.url) {
          console.log(`  ${chalk.blue(vuln.url)}`)
        }
        console.log()
      })
    } catch (error) {
      spinner.fail(chalk.red('检查失败'))
      console.error(error)
    }
  })

program
  .command('fix')
  .description('尝试自动修复漏洞')
  .option('-d, --dir <directory>', '项目目录', process.cwd())
  .action(async (options) => {
    const spinner = ora('正在修复漏洞...').start()
    
    try {
      const checker = new VulnerabilityChecker(options.dir)
      const result = await checker.fix()
      
      if (result.success) {
        spinner.succeed(chalk.green(result.message))
      } else {
        spinner.fail(chalk.red(result.message))
      }
    } catch (error) {
      spinner.fail(chalk.red('修复失败'))
      console.error(error)
    }
  })

program.parse()

// 辅助函数
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

