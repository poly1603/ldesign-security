# CLI 参考手册

完整的 @ldesign/security 命令行工具参考。

## 全局选项

所有命令都支持以下选项：

- `-d, --dir <directory>` - 指定项目目录（默认：当前目录）
- `-h, --help` - 显示帮助信息
- `-V, --version` - 显示版本号

## 命令列表

### `lsec scan`

执行完整的安全扫描。

**语法**:
```bash
lsec scan [选项]
```

**选项**:
- `--skip-vulnerabilities` - 跳过漏洞扫描
- `--skip-code` - 跳过代码审计
- `--skip-secrets` - 跳过敏感信息扫描
- `--skip-injection` - 跳过注入检测
- `--skip-license` - 跳过许可证检查
- `--skip-supply-chain` - 跳过供应链分析

**示例**:
```bash
# 完整扫描
lsec scan

# 跳过代码审计
lsec scan --skip-code

# 指定目录
lsec scan --dir /path/to/project
```

### `lsec check`

快速检查依赖漏洞。

**语法**:
```bash
lsec check [选项]
```

**示例**:
```bash
lsec check
lsec check --dir /path/to/project
```

### `lsec fix`

自动修复已知漏洞。

**语法**:
```bash
lsec fix [选项]
```

**选项**:
- `--force` - 强制修复（可能包含破坏性更新）

**示例**:
```bash
# 安全修复
lsec fix

# 强制修复
lsec fix --force
```

### `lsec license`

检查许可证合规性。

**语法**:
```bash
lsec license [选项]
```

**选项**:
- `-f, --format <format>` - 报告格式（text|json|html）
- `-o, --output <file>` - 输出文件路径

**示例**:
```bash
lsec license
lsec license --format html --output license-report.html
```

### `lsec sbom`

生成软件物料清单（SBOM）。

**语法**:
```bash
lsec sbom [选项]
```

**选项**:
- `-f, --format <format>` - SBOM 格式（spdx|cyclonedx）
- `-o, --output <file>` - 输出文件路径

**示例**:
```bash
lsec sbom --format spdx
lsec sbom --format cyclonedx --output sbom.json
```

### `lsec report`

生成安全报告。

**语法**:
```bash
lsec report [选项]
```

**选项**:
- `-f, --format <formats>` - 报告格式，多个用逗号分隔
  - 支持：html, json, yaml, sarif, pdf, markdown, excel
- `-o, --output <directory>` - 输出目录

**示例**:
```bash
# 生成 HTML 报告
lsec report --format html

# 生成多种格式
lsec report --format html,json,pdf

# 指定输出目录
lsec report --format html --output ./reports
```

### `lsec policy`

管理安全策略。

**语法**:
```bash
lsec policy [选项]
```

**选项**:
- `--init` - 初始化配置文件
- `--show` - 显示当前策略
- `--interactive` - 交互式配置
- `--format <format>` - 配置文件格式（json|js）

**示例**:
```bash
# 初始化配置
lsec policy --init

# 交互式配置
lsec policy --interactive

# 显示当前策略
lsec policy --show

# 验证配置
lsec policy
```

### `lsec ci`

CI/CD 集成模式。

**语法**:
```bash
lsec ci [选项]
```

**选项**:
- `--fail-on <severity>` - 失败阈值（critical|high|medium|low）
- `--sarif` - 生成 SARIF 报告（用于 GitHub Code Scanning）

**示例**:
```bash
# 基本 CI 扫描
lsec ci

# 严格模式
lsec ci --fail-on medium

# GitHub Code Scanning
lsec ci --fail-on high --sarif
```

### `lsec monitor`

启动监控模式（定时扫描）。

**语法**:
```bash
lsec monitor [选项]
```

**选项**:
- `-c, --cron <expression>` - Cron 表达式
- `--on-start` - 启动时立即扫描

**示例**:
```bash
# 每天午夜扫描
lsec monitor --cron "0 0 * * *"

# 每小时扫描
lsec monitor --cron "0 * * * *" --on-start
```

**Cron 表达式预设**:
- `@hourly` - 每小时
- `@daily` - 每天
- `@weekly` - 每周
- `@monthly` - 每月

### `lsec history`

查看扫描历史。

**语法**:
```bash
lsec history [选项]
```

**选项**:
- `-l, --limit <number>` - 显示数量
- `--trend` - 显示趋势分析

**示例**:
```bash
# 查看最近10次扫描
lsec history

# 查看最近30次
lsec history --limit 30

# 趋势分析
lsec history --trend
```

### `lsec projects`

管理多项目。

**语法**:
```bash
lsec projects [选项]
```

**选项**:
- `--list` - 列出所有项目
- `--scan-all` - 扫描所有项目

**示例**:
```bash
# 列出项目
lsec projects --list

# 扫描所有项目
lsec projects --scan-all
```

## 退出码

- `0` - 成功（或未达到失败阈值）
- `1` - 失败（发现超过阈值的问题或执行错误）

## 配置文件优先级

1. 命令行选项
2. `.securityrc.json`
3. `.securityrc.js`
4. `security.config.js`
5. `package.json` 中的 `security` 字段
6. 默认配置

## 环境变量

- `SECURITY_LOG_LEVEL` - 日志级别（DEBUG|INFO|WARN|ERROR）
- `SECURITY_CACHE_DIR` - 缓存目录
- `SECURITY_CONFIG` - 配置文件路径

## 性能提示

1. 使用 `--skip-*` 跳过不需要的扫描
2. 配置排除规则减少扫描范围
3. 使用增量扫描加快速度
4. 启用缓存系统
5. 定期清理历史记录

## 故障排查

如遇到问题，请：

1. 检查配置文件语法
2. 查看日志输出
3. 尝试 `--verbose` 模式
4. 清除缓存 `rm -rf .security-cache`
5. 查看 [故障排查指南](./troubleshooting.md)

## 更多信息

- [配置指南](./configuration.md)
- [最佳实践](./best-practices.md)
- [FAQ](./faq.md)

