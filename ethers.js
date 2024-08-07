"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var ts = require("typescript");
var EXCLUDED_DIRS = new Set(['node_modules', '.git', '.vscode', 'build', 'dist']);
function getProjectFiles(dir) {
    var files = [];
    function traverse(currentDir) {
        var entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
            var entry = entries_1[_i];
            var fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                if (!EXCLUDED_DIRS.has(entry.name)) {
                    traverse(fullPath);
                }
            }
            else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
                files.push(fullPath);
            }
        }
    }
    traverse(dir);
    return files;
}
function analyzeFile(filePath) {
    var content = fs.readFileSync(filePath, 'utf-8');
    var sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
    var imports = [];
    var exports = [];
    function visit(node) {
        var _a, _b;
        if (ts.isImportDeclaration(node)) {
            var source = node.moduleSpecifier.getText().replace(/['"]/g, '');
            var importClause = node.importClause;
            if (importClause) {
                if (importClause.name) {
                    imports.push({ source: source, imports: [importClause.name.getText()] });
                }
                if (importClause.namedBindings) {
                    if (ts.isNamedImports(importClause.namedBindings)) {
                        var namedImports = importClause.namedBindings.elements.map(function (e) { return e.name.getText(); });
                        imports.push({ source: source, imports: namedImports });
                    }
                }
            }
        }
        if (ts.isExportDeclaration(node)) {
            if (node.exportClause && ts.isNamedExports(node.exportClause)) {
                exports.push.apply(exports, node.exportClause.elements.map(function (e) { return e.name.getText(); }));
            }
        }
        else if (ts.isExportAssignment(node)) {
            // Handle default exports
            if (ts.isIdentifier(node.expression)) {
                exports.push(node.expression.getText());
            }
        }
        else if (ts.isVariableStatement(node) && ((_a = node.modifiers) === null || _a === void 0 ? void 0 : _a.some(function (m) { return m.kind === ts.SyntaxKind.ExportKeyword; }))) {
            // Handle export const/let/var
            node.declarationList.declarations.forEach(function (decl) {
                if (ts.isIdentifier(decl.name)) {
                    exports.push(decl.name.getText());
                }
            });
        }
        else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
            node.name &&
            ((_b = node.modifiers) === null || _b === void 0 ? void 0 : _b.some(function (m) { return m.kind === ts.SyntaxKind.ExportKeyword; }))) {
            // Handle export function and export class
            exports.push(node.name.getText());
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return { imports: imports, exports: exports };
}
function analyzeProject(rootDir) {
    var files = getProjectFiles(rootDir);
    var ethersUsage = {};
    for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
        var file = files_1[_i];
        var analysis = analyzeFile(file);
        var content = fs.readFileSync(file, 'utf-8');
        var ethersImports = analysis.imports.filter(function (imp) {
            return imp.source === 'ethers' || imp.source === 'ethers-v5';
        });
        if (ethersImports.length > 0) {
            ethersUsage[file] = { ethers: [], 'ethers-v5': [], content: content };
            for (var _a = 0, ethersImports_1 = ethersImports; _a < ethersImports_1.length; _a++) {
                var imp = ethersImports_1[_a];
                ethersUsage[file][imp.source] = imp.imports;
            }
        }
    }
    // Generate report
    var report = '# Ethers Usage Analysis\n\n';
    for (var _b = 0, _c = Object.entries(ethersUsage); _b < _c.length; _b++) {
        var _d = _c[_b], file = _d[0], usage = _d[1];
        report += "## ".concat(path.relative(rootDir, file), "\n\n");
        if (usage.ethers.length > 0) {
            report += '### ethers (v6) imports:\n';
            for (var _e = 0, _f = usage.ethers; _e < _f.length; _e++) {
                var imp = _f[_e];
                report += "- ".concat(imp, "\n");
            }
            report += '\n';
        }
        if (usage['ethers-v5'].length > 0) {
            report += '### ethers-v5 imports:\n';
            for (var _g = 0, _h = usage['ethers-v5']; _g < _h.length; _g++) {
                var imp = _h[_g];
                report += "- ".concat(imp, "\n");
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
var rootDir = process.argv[2] || '.';
analyzeProject(rootDir);
