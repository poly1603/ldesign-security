# 自定义规则示例

这个示例展示了如何创建和使用自定义安全规则。

## 使用方法

### 1. 定义自定义规则

参考 `security-rules.ts` 文件，定义你的规则：

```typescript
import type { SecurityRule } from '@ldesign/security'

export const myRule: SecurityRule = {
  id: 'my-custom-rule',
  name: 'My Custom Security Rule',
  description: 'Description of what this rule checks',
  severity: 'high',
  pattern: /some-pattern/gi,
  suggestion: 'How to fix this issue',
  category: 'general',
  enabled: true
}
```

### 2. 在代码中使用

```typescript
import { RuleEngine } from '@ldesign/security'
import { customRules } from './security-rules'

const engine = new RuleEngine()

// 添加自定义规则
customRules.forEach(rule => {
  engine.addRule(rule)
})

// 检查代码
const code = `console.log('test')`
const results = await engine.check(code, 'test.ts')

console.log(`发现 ${results.length} 个问题`)
```

### 3. 导出和导入规则

```typescript
// 导出规则
const rulesJson = engine.exportRules()
fs.writeFileSync('my-rules.json', rulesJson)

// 导入规则
const rulesData = fs.readFileSync('my-rules.json', 'utf-8')
engine.importRules(rulesData)
```

## 规则类别

- `injection` - 注入攻击
- `crypto` - 加密相关
- `auth` - 认证授权
- `xss` - 跨站脚本
- `general` - 通用安全

## 严重程度

- `critical` - 严重
- `high` - 高
- `medium` - 中
- `low` - 低

## 最佳实践

1. **使用精确的正则表达式** - 避免过多误报
2. **提供清晰的建议** - 帮助开发者修复问题
3. **合理设置严重程度** - 根据实际风险评估
4. **启用/禁用规则** - 根据项目需求调整
5. **分类规则** - 便于管理和查找

## 示例规则

### 检测硬编码 URL

```typescript
{
  id: 'hardcoded-url',
  pattern: /https?:\/\/api\.mycompany\.com/gi,
  severity: 'medium',
  suggestion: 'Use environment variables'
}
```

### 检测调试代码

```typescript
{
  id: 'debug-code',
  pattern: /debugger;/gi,
  severity: 'low',
  suggestion: 'Remove debugger statements'
}
```

### 检测不安全的比较

```typescript
{
  id: 'unsafe-comparison',
  pattern: /==(?!=)/g,
  severity: 'low',
  suggestion: 'Use === for strict equality'
}
```

