import fs from 'fs-extra'
import path from 'path'

/**
 * 依赖图节点
 */
export interface DependencyNode {
  id: string
  name: string
  version: string
  vulnerabilities: number
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none'
}

/**
 * 依赖图边
 */
export interface DependencyEdge {
  from: string
  to: string
}

/**
 * 依赖关系可视化器
 */
export class DependencyVisualizer {
  constructor(private projectDir: string = process.cwd()) { }

  /**
   * 生成依赖图数据
   */
  async generateGraph(): Promise<{
    nodes: DependencyNode[]
    edges: DependencyEdge[]
  }> {
    const nodes: DependencyNode[] = []
    const edges: DependencyEdge[] = []

    try {
      const packageJsonPath = path.join(this.projectDir, 'package.json')
      const packageJson = await fs.readJSON(packageJsonPath)

      // 添加根节点
      nodes.push({
        id: packageJson.name || 'root',
        name: packageJson.name || 'root',
        version: packageJson.version || '0.0.0',
        vulnerabilities: 0,
        riskLevel: 'none'
      })

      // 添加依赖节点
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }

      for (const [name, version] of Object.entries(allDeps)) {
        nodes.push({
          id: name,
          name,
          version: version as string,
          vulnerabilities: 0,
          riskLevel: 'none'
        })

        // 添加边
        edges.push({
          from: packageJson.name || 'root',
          to: name
        })
      }

      return { nodes, edges }
    } catch (error) {
      return { nodes: [], edges: [] }
    }
  }

  /**
   * 导出为 Mermaid 格式
   */
  async exportMermaid(): Promise<string> {
    const { nodes, edges } = await this.generateGraph()

    let mermaid = 'graph TD\n'

    // 添加节点
    nodes.forEach(node => {
      const shape = node.vulnerabilities > 0 ? '{{' : '['
      const endShape = node.vulnerabilities > 0 ? '}}' : ']'
      mermaid += `  ${node.id}${shape}"${node.name}@${node.version}"${endShape}\n`
    })

    // 添加边
    edges.forEach(edge => {
      mermaid += `  ${edge.from} --> ${edge.to}\n`
    })

    return mermaid
  }

  /**
   * 导出为 DOT 格式（Graphviz）
   */
  async exportDOT(): Promise<string> {
    const { nodes, edges } = await this.generateGraph()

    let dot = 'digraph Dependencies {\n'
    dot += '  rankdir=LR;\n'
    dot += '  node [shape=box, style=rounded];\n\n'

    // 添加节点
    nodes.forEach(node => {
      const color = this.getRiskColor(node.riskLevel)
      dot += `  "${node.id}" [label="${node.name}\\n${node.version}", color="${color}"];\n`
    })

    dot += '\n'

    // 添加边
    edges.forEach(edge => {
      dot += `  "${edge.from}" -> "${edge.to}";\n`
    })

    dot += '}\n'

    return dot
  }

  /**
   * 导出为 JSON
   */
  async exportJSON(): Promise<string> {
    const graph = await this.generateGraph()
    return JSON.stringify(graph, null, 2)
  }

  /**
   * 保存图表
   */
  async save(outputPath: string, format: 'mermaid' | 'dot' | 'json' = 'mermaid'): Promise<void> {
    let content: string

    switch (format) {
      case 'mermaid':
        content = await this.exportMermaid()
        break
      case 'dot':
        content = await this.exportDOT()
        break
      case 'json':
        content = await this.exportJSON()
        break
      default:
        content = await this.exportMermaid()
    }

    await fs.writeFile(outputPath, content, 'utf-8')
  }

  /**
   * 获取风险颜色
   */
  private getRiskColor(riskLevel: string): string {
    const colors: Record<string, string> = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#17a2b8',
      none: '#28a745'
    }
    return colors[riskLevel] || '#6c757d'
  }
}


