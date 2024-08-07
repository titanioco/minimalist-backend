import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.vscode', 'build', 'dist']);

interface ImportInfo {
  source: string;
  imports: string[];
}

interface FileAnalysis {
  imports: ImportInfo[];
  exports: string[];
}

function getProjectFiles(dir: string): string[] {
  const files: string[] = [];
  
  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) {
          traverse(fullPath);
        }
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function analyzeFile(filePath: string): FileAnalysis {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  
  const imports: ImportInfo[] = [];
  const exports: string[] = [];
  
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const source = node.moduleSpecifier.getText().replace(/['"]/g, '');
      const importClause = node.importClause;
      
      if (importClause) {
        if (importClause.name) {
          imports.push({ source, imports: [importClause.name.getText()] });
        }
        if (importClause.namedBindings) {
          if (ts.isNamedImports(importClause.namedBindings)) {
            const namedImports = importClause.namedBindings.elements.map(e => e.name.getText());
            imports.push({ source, imports: namedImports });
          }
        }
      }
    }
    
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        exports.push(...node.exportClause.elements.map(e => e.name.getText()));
      }
    } else if (ts.isExportAssignment(node)) {
      // Handle default exports
      if (ts.isIdentifier(node.expression)) {
        exports.push(node.expression.getText());
      }
    } else if (ts.isVariableStatement(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      // Handle export const/let/var
      node.declarationList.declarations.forEach(decl => {
        if (ts.isIdentifier(decl.name)) {
          exports.push(decl.name.getText());
        }
      });
    } else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && 
               node.name && 
               node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      // Handle export function and export class
      exports.push(node.name.getText());
    }
    
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);
  return { imports, exports };
}

function analyzeProject(rootDir: string): void {
    const files = getProjectFiles(rootDir);
    const ethersUsage: { [file: string]: { ethers: string[], 'ethers-v5': string[], content: string } } = {};
    
    for (const file of files) {
      const analysis = analyzeFile(file);
      const content = fs.readFileSync(file, 'utf-8');
      
      const ethersImports = analysis.imports.filter(imp => 
        imp.source === 'ethers' || imp.source === 'ethers-v5'
      );
      
      if (ethersImports.length > 0) {
        ethersUsage[file] = { ethers: [], 'ethers-v5': [], content };
        
        for (const imp of ethersImports) {
          ethersUsage[file][imp.source as 'ethers' | 'ethers-v5'] = imp.imports;
        }
      }
    }
    
    // Generate report
    let report = '# Ethers Usage Analysis\n\n';
    
    for (const [file, usage] of Object.entries(ethersUsage)) {
      report += `## ${path.relative(rootDir, file)}\n\n`;
      
      if (usage.ethers.length > 0) {
        report += '### ethers (v6) imports:\n';
        for (const imp of usage.ethers) {
          report += `- ${imp}\n`;
        }
        report += '\n';
      }
      
      if (usage['ethers-v5'].length > 0) {
        report += '### ethers-v5 imports:\n';
        for (const imp of usage['ethers-v5']) {
          report += `- ${imp}\n`;
        }
        report += '\n';
      }
      
      report += '### File Content:\n';
      report += '```typescript\n';
      report += usage.content;
      report += '\n```\n\n';
      
      report += '---\n\n';
    }
    
    fs.writeFileSync('ethers-usage-report.md', report);
    console.log('Ethers usage report generated: ethers-usage-report.md');
  }

// Usage
const rootDir = process.argv[2] || '.';
analyzeProject(rootDir);