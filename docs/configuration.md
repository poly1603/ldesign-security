# 配置指南

本文档详细介绍 @ldesign/security 的所有配置选项。

## 配置文件

@ldesign/security 支持多种配置文件格式：

### `.securityrc.json` (推荐)

```json
{
  "scan": {
    "exclude": ["**/node_modules/**"],
    "severity": "medium",
    "failOn": "high"
  },
  "license": {
    "whitelist": ["MIT", "Apache-2.0"],
    "blacklist": ["GPL-3.0"]
  },
  "notifications": {
    "enabled": true
  },
  "reports": {
    "format": ["html", "json"],
    "output": "./security-reports"
  }
}
```

### `security.config.js`

```javascript
module.exports = {
  scan: {
    exclude: ['**/node_modules/**', '**/dist/**'],
    severity: 'medium',
    failOn: 'high'
  },
  license: {
    whitelist: ['MIT', 'Apache-2.0'],
    blacklist: []
  }
}
```

### `package.json`

```json
{
  "name": "my-project",
  "security": {
    "scan": {
      "failOn": "high"
    }
  }
}
```

## 配置选项详解

### scan

扫描配置。

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `exclude` | `string[]` | `['**/node_modules/**']` | 排除的文件模式 |
| `include` | `string[]` | `undefined` | 包含的文件模式 |
| `severity` | `string` | `'medium'` | 最低报告级别 |
| `failOn` | `string` | `'high'` | 失败阈值 |

**示例**:
```json
{
  "scan": {
    "exclude": [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/*.test.ts",
      "**/*.spec.ts"
    ],
    "severity": "low",
    "failOn": "high"
  }
}
```

### license

许可证配置。

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `whitelist` | `string[]` | `['MIT', 'Apache-2.0', ...]` | 允许的许可证 |
| `blacklist` | `string[]` | `[]` | 禁止的许可证 |
| `allowUnknown` | `boolean` | `false` | 是否允许未知许可证 |

**示例**:
```json
{
  "license": {
    "whitelist": [
      "MIT",
      "Apache-2.0",
      "BSD-2-Clause",
      "BSD-3-Clause",
      "ISC"
    ],
    "blacklist": [
      "GPL-3.0",
      "AGPL-3.0"
    ],
    "allowUnknown": false
  }
}
```

### notifications

通知配置。

#### webhook

```json
{
  "notifications": {
    "enabled": true,
    "webhook": {
      "url": "https://example.com/webhook",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer token"
      },
      "severityFilter": ["critical", "high"]
    }
  }
}
```

#### slack

```json
{
  "notifications": {
    "enabled": true,
    "slack": {
      "webhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
      "channel": "#security-alerts",
      "username": "Security Bot",
      "severityFilter": ["critical", "high"]
    }
  }
}
```

#### dingtalk (钉钉)

```json
{
  "notifications": {
    "enabled": true,
    "dingtalk": {
      "webhookUrl": "https://oapi.dingtalk.com/robot/send?access_token=XXX",
      "secret": "SEC...",
      "severityFilter": ["critical", "high"]
    }
  }
}
```

#### wecom (企业微信)

```json
{
  "notifications": {
    "enabled": true,
    "wecom": {
      "webhookUrl": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=XXX",
      "severityFilter": ["critical", "high"]
    }
  }
}
```

### schedule

定时扫描配置。

```json
{
  "schedule": "0 0 * * *"
}
```

**Cron 表达式格式**: `分 时 日 月 周`

**常用表达式**:
- `0 0 * * *` - 每天午夜
- `0 */6 * * *` - 每6小时
- `0 0 * * 0` - 每周日
- `0 0 1 * *` - 每月1号

### reports

报告配置。

```json
{
  "reports": {
    "format": ["html", "json", "sarif"],
    "output": "./security-reports",
    "title": "My Project Security Report",
    "includeCharts": true,
    "includeDependencyGraph": true
  }
}
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `format` | `string[]` | `['json', 'html']` | 报告格式 |
| `output` | `string` | `'./security-reports'` | 输出目录 |
| `title` | `string` | `undefined` | 报告标题 |
| `includeCharts` | `boolean` | `true` | 包含图表 |
| `includeDependencyGraph` | `boolean` | `false` | 包含依赖图 |

## 完整配置示例

```json
{
  "scan": {
    "exclude": [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
      "**/coverage/**",
      "**/*.test.{js,ts,jsx,tsx}",
      "**/*.spec.{js,ts,jsx,tsx}"
    ],
    "include": [
      "src/**",
      "lib/**",
      "app/**"
    ],
    "severity": "medium",
    "failOn": "high"
  },
  "license": {
    "whitelist": [
      "MIT",
      "Apache-2.0",
      "BSD-2-Clause",
      "BSD-3-Clause",
      "ISC",
      "0BSD",
      "Unlicense"
    ],
    "blacklist": [
      "GPL-3.0",
      "AGPL-3.0"
    ],
    "allowUnknown": false
  },
  "notifications": {
    "enabled": true,
    "webhook": {
      "url": "https://hooks.example.com/security",
      "severityFilter": ["critical", "high"]
    },
    "slack": {
      "webhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
      "channel": "#security-alerts",
      "severityFilter": ["critical", "high"]
    }
  },
  "schedule": "0 0 * * *",
  "reports": {
    "format": ["html", "json", "sarif"],
    "output": "./security-reports",
    "includeCharts": true,
    "includeDependencyGraph": true
  }
}
```

## 配置验证

验证配置文件：

```bash
lsec policy
```

## 生成示例配置

```bash
lsec policy --init
```

## 更多

- [CLI 参考](./cli-reference.md)
- [最佳实践](./best-practices.md)

