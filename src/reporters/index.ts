export { BaseReporter } from './base-reporter'
export { HTMLReporter } from './html-reporter'
export { JSONReporter, YAMLReporter } from './json-reporter'
export { SARIFReporter } from './sarif-reporter'
export { PDFReporter } from './pdf-reporter'
export { MarkdownReporter } from './markdown-reporter'
export { ExcelReporter } from './excel-reporter'

// 新增：对比报告生成器
export { ComparisonReporter } from './comparison-reporter'
export type { 
  ComparisonResult,
  ComparisonType,
  ComparisonSnapshot,
  ComparisonChanges,
  ComparisonSummary,
  ChangeDetail,
  ComparisonReporterOptions
} from './comparison-reporter'

