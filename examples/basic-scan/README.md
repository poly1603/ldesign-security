# 基础扫描示例

这个示例展示了如何使用 @ldesign/security 进行基础的安全扫描。

## 使用方法

```bash
# 安装依赖
pnpm install

# 执行完整扫描
pnpm scan

# 仅检查漏洞
pnpm check

# 自动修复漏洞
pnpm fix

# 生成报告
pnpm report
```

## API 使用

```typescript
import { SecurityScanner } from '@ldesign/security'

const scanner = new SecurityScanner({ projectDir: './' })
const result = await scanner.scan()

console.log(`风险等级: ${result.riskLevel}`)
console.log(`总问题数: ${result.summary.totalIssues}`)
```

## 配置

创建 `.securityrc.json`:

```json
{
  "scan": {
    "exclude": ["**/node_modules/**", "**/dist/**"],
    "failOn": "high"
  },
  "reports": {
    "format": ["html"],
    "output": "./security-reports"
  }
}
```


