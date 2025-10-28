# CLI 命令

@ldesign/security 提供了强大且易用的命令行工具 `lsec`。

## 命令概览

| 命令 | 说明 | 常用场景 |
|------|------|---------|
| [scan](#scan) | 执行完整安全扫描 | 全面检查项目安全状况 |
| [check](#check) | 快速检查依赖漏洞 | 快速验证依赖安全性 |
| [fix](#fix) | 自动修复漏洞 | 修复已知的安全问题 |
| [watch](#watch) | 启动持续监控 | 开发时实时监控 |
| [dashboard](#dashboard) | 交互式仪表板 | 可视化安全态势 |
| [compare](#compare) | 对比扫描结果 | 对比不同版本的安全状况 |
| [compliance](#compliance) | 合规性检查 | 验证合规标准 |
| [report](#report) | 生成安全报告 | 生成详细报告文档 |
| [license](#license) | 许可证检查 | 检查许可证合规性 |
| [sbom](#sbom) | 生成 SBOM | 软件物料清单 |
| [policy](#policy) | 管理安全策略 | 配置安全策略 |
| [monitor](#monitor) | 定时监控 | 后台定时扫描 |
| [history](#history) | 扫描历史 | 查看历史记录和趋势 |
| [projects](#projects) | 多项目管理 | 管理多个项目 |
| [ci](#ci) | CI/CD 模式 | 集成到 CI/CD |

## 全局选项

所有命令都支持以下全局选项：

```bash
-v, --version       # 显示版本号
-h, --help          # 显示帮助信息
--no-color          # 禁用颜色输出
--quiet             # 静默模式
--verbose           # 详细输出
--config <file>     # 指定配置文件
```

## scan

执行完整的安全扫描，包括所有检测模块。

### 语法

```bash
lsec scan [options]
```

### 选项

```bash
-d, --dir <directory>     # 项目目录 (默认: 当前目录)
--skip-vulnerabilities    # 跳过漏洞扫描
--skip-code               # 跳过代码审计
--skip-secrets            # 跳过敏感信息扫描
--skip-injection          # 跳过注入检测
--skip-license            # 跳过许可证检查
--skip-supply-chain       # 跳过供应链分析
```

### 示例

```bash
# 扫描当前项目
lsec scan

# 扫描指定目录
lsec scan -d /path/to/project

# 仅扫描依赖漏洞
lsec scan --skip-code --skip-secrets --skip-injection
```

## check

快速检查项目中的依赖漏洞，比 `scan` 命令更快。

### 语法

```bash
lsec check [options]
```

### 选项

```bash
-d, --dir <directory>     # 项目目录
```

### 示例

```bash
# 快速检查
lsec check

# 在 pre-commit hook 中使用
lsec check || exit 1
```

## fix

自动修复检测到的安全问题。

### 语法

```bash
lsec fix [options]
```

### 选项

```bash
-d, --dir <directory>     # 项目目录
--force                   # 强制修复（可能破坏兼容性）
--dry-run                 # 预览修复但不实际应用
--auto-commit             # 自动提交修复
```

### 示例

```bash
# 交互式修复
lsec fix

# 强制修复所有问题
lsec fix --force

# 预览修复
lsec fix --dry-run
```

## watch

启动持续监控模式，实时监听文件变化并自动扫描。

### 语法

```bash
lsec watch [options]
```

### 选项

```bash
-d, --dir <directory>     # 项目目录
--no-hooks                # 不安装 Git hooks
--no-watch                # 不启用文件监听
--interval <ms>           # 扫描间隔（毫秒，默认 300000）
```

### 示例

```bash
# 启动监控
lsec watch

# 仅 Git hooks，不监听文件
lsec watch --no-watch

# 设置扫描间隔为 10 分钟
lsec watch --interval 600000
```

## dashboard

启动交互式 Web 仪表板。

### 语法

```bash
lsec dashboard [options]
```

### 选项

```bash
-d, --dir <directory>     # 项目目录
-p, --port <port>         # 端口号（默认: 3000）
--host <host>             # 主机地址（默认: localhost）
```

### 示例

```bash
# 启动仪表板
lsec dashboard

# 使用自定义端口
lsec dashboard -p 8080

# 允许远程访问
lsec dashboard --host 0.0.0.0
```

## compare

对比两次扫描结果或不同版本的安全状况。

### 语法

```bash
lsec compare [options]
```

### 选项

```bash
--base <version>          # 基准版本/分支/标签
--target <version>        # 目标版本/分支/标签（默认: HEAD）
-o, --output <file>       # 输出文件路径
```

### 示例

```bash
# 对比当前和主分支
lsec compare --base main

# 对比两个版本
lsec compare --base v1.0.0 --target v2.0.0

# 保存对比报告
lsec compare --base main --output comparison.html
```

## compliance

检查项目的安全合规性。

### 语法

```bash
lsec compliance [options]
```

### 选项

```bash
-d, --dir <directory>     # 项目目录
-s, --standard <standard> # 合规标准 (owasp|cis|pci|gdpr|soc2)
-o, --output <file>       # 输出文件路径
```

### 示例

```bash
# 检查 OWASP Top 10 合规性
lsec compliance --standard owasp

# 检查 PCI DSS 合规性
lsec compliance --standard pci

# 生成合规报告
lsec compliance --standard gdpr --output compliance.pdf
```

## report

生成详细的安全报告。

### 语法

```bash
lsec report [options]
```

### 选项

```bash
-d, --dir <directory>     # 项目目录
-f, --format <formats>    # 报告格式（多个用逗号分隔）
-o, --output <directory>  # 输出目录（默认: ./security-reports）
```

### 支持的格式

- `html` - 交互式 HTML 报告
- `pdf` - PDF 文档
- `json` - JSON 数据
- `yaml` - YAML 格式
- `sarif` - SARIF 格式
- `markdown` - Markdown 文档
- `excel` - Excel 表格

### 示例

```bash
# 生成 HTML 报告
lsec report --format html

# 生成多种格式
lsec report --format html,json,pdf

# 指定输出目录
lsec report --format html --output ./reports
```

## ci

CI/CD 集成模式，针对持续集成环境优化。

### 语法

```bash
lsec ci [options]
```

### 选项

```bash
-d, --dir <directory>     # 项目目录
--fail-on <severity>      # 失败阈值（critical|high|medium|low）
--sarif                   # 生成 SARIF 报告
```

### 示例

```bash
# CI 模式运行
lsec ci --fail-on high

# 生成 SARIF 用于 GitHub Code Scanning
lsec ci --sarif

# 仅在发现严重漏洞时失败
lsec ci --fail-on critical
```

### 退出码

- `0` - 未发现问题或严重度低于阈值
- `1` - 发现达到或超过阈值的问题
- `2` - 扫描失败或配置错误

## 完整示例工作流

### 日常开发

```bash
# 1. 启动监控
lsec watch

# 2. 提交前检查
git add .
lsec check
git commit -m "feat: new feature"

# 3. 推送前生成报告
lsec report --format html
git push
```

### CI/CD 集成

```bash
# 在 CI 中运行
lsec ci --fail-on high --sarif

# 生成报告供后续分析
lsec report --format json,html
```

### 定期审计

```bash
# 1. 完整扫描
lsec scan

# 2. 生成详细报告
lsec report --format html,pdf

# 3. 检查合规性
lsec compliance --standard owasp --output owasp-report.pdf
lsec compliance --standard pci --output pci-report.pdf

# 4. 查看趋势
lsec history --trend
```

### 应急响应

```bash
# 1. 快速检查
lsec check

# 2. 启动仪表板实时监控
lsec dashboard

# 3. 尝试自动修复
lsec fix

# 4. 生成修复报告
lsec compare --base HEAD~1 --target HEAD
```

## 下一步

- 查看各个命令的详细文档
- 了解[配置选项](../config/options)
- 探索[集成方式](../integrations/overview)
- 查看[最佳实践](../guide/best-practices)
