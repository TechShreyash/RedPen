import { useState } from 'react';
import './CodeViewer.css';

const PYTHON_KEYWORDS = [
  'import', 'from', 'def', 'return', 'if', 'else', 'elif', 'for', 'while',
  'try', 'except', 'raise', 'class', 'with', 'as', 'in', 'not', 'and', 'or',
  'True', 'False', 'None', 'pass', 'async', 'await', 'lambda', 'yield'
];

const tokenizePython = (line) => {
  const tokens = [];
  let remaining = line;
  let pos = 0;

  while (remaining.length > 0) {
    // Comments
    if (remaining.startsWith('#')) {
      tokens.push({ type: 'comment', value: remaining });
      break;
    }

    // Strings (triple quotes, double, single)
    const strMatch = remaining.match(/^("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|f"(?:[^"\\]|\\.)*"|f'(?:[^'\\]|\\.)*')/);
    if (strMatch) {
      tokens.push({ type: 'string', value: strMatch[0] });
      remaining = remaining.slice(strMatch[0].length);
      pos += strMatch[0].length;
      continue;
    }

    // Decorators
    const decoMatch = remaining.match(/^@[\w.]+/);
    if (decoMatch) {
      tokens.push({ type: 'decorator', value: decoMatch[0] });
      remaining = remaining.slice(decoMatch[0].length);
      pos += decoMatch[0].length;
      continue;
    }

    // Numbers
    const numMatch = remaining.match(/^\b\d+\.?\d*\b/);
    if (numMatch) {
      tokens.push({ type: 'number', value: numMatch[0] });
      remaining = remaining.slice(numMatch[0].length);
      pos += numMatch[0].length;
      continue;
    }

    // Keywords and identifiers
    const wordMatch = remaining.match(/^[a-zA-Z_]\w*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const type = PYTHON_KEYWORDS.includes(word) ? 'keyword' : 'identifier';
      tokens.push({ type, value: word });
      remaining = remaining.slice(word.length);
      pos += word.length;
      continue;
    }

    // Operators and punctuation
    const opMatch = remaining.match(/^[()[\]{},.:;=+\-*/<>!&|%^~@]+/);
    if (opMatch) {
      tokens.push({ type: 'operator', value: opMatch[0] });
      remaining = remaining.slice(opMatch[0].length);
      pos += opMatch[0].length;
      continue;
    }

    // Whitespace
    const wsMatch = remaining.match(/^\s+/);
    if (wsMatch) {
      tokens.push({ type: 'whitespace', value: wsMatch[0] });
      remaining = remaining.slice(wsMatch[0].length);
      pos += wsMatch[0].length;
      continue;
    }

    // Single character fallback
    tokens.push({ type: 'text', value: remaining[0] });
    remaining = remaining.slice(1);
    pos += 1;
  }

  return tokens;
};

const HighlightedLine = ({ code }) => {
  const tokens = tokenizePython(code);
  return (
    <>
      {tokens.map((token, i) => (
        <span key={i} className={`token-${token.type}`}>{token.value}</span>
      ))}
    </>
  );
};

const CodeViewer = ({
  code,
  startLine = 1,
  highlightLines = [],
  filename = '',
  language = 'python',
  vulnerabilities = [],
  className = ''
}) => {
  const [hoveredVuln, setHoveredVuln] = useState(null);
  const lines = code.split('\n');

  // Build a map of line numbers to vulnerability info
  const lineVulnMap = {};
  vulnerabilities.forEach(vuln => {
    const start = vuln.snippet_lines.start;
    const end = vuln.snippet_lines.end;
    for (let l = start; l <= end; l++) {
      if (!lineVulnMap[l]) lineVulnMap[l] = [];
      lineVulnMap[l].push(vuln);
    }
  });

  return (
    <div className={`code-viewer ${className}`}>
      <div className="code-viewer-header">
        <div className="code-viewer-tabs">
          <div className="code-viewer-tab code-viewer-tab--active">
            <span className="code-tab-icon">📄</span>
            {filename}
          </div>
        </div>
        <div className="code-viewer-actions">
          <span className="code-lang-badge">{language}</span>
        </div>
      </div>
      <div className="code-viewer-body">
        <div className="code-lines">
          {lines.map((line, idx) => {
            const lineNum = startLine + idx;
            const isHighlighted = highlightLines.includes(lineNum);
            const vulns = lineVulnMap[lineNum];
            const hasVuln = !!vulns;
            const isHovered = hoveredVuln && vulns?.some(v => v.check_id === hoveredVuln);

            return (
              <div
                key={idx}
                className={`code-line ${isHighlighted ? 'code-line--highlight' : ''} ${hasVuln ? 'code-line--vuln' : ''} ${isHovered ? 'code-line--vuln-hover' : ''}`}
                onMouseEnter={() => hasVuln && setHoveredVuln(vulns[0].check_id)}
                onMouseLeave={() => setHoveredVuln(null)}
              >
                <span className="code-line-number">{lineNum}</span>
                {hasVuln && <span className="code-line-marker">●</span>}
                {!hasVuln && <span className="code-line-marker-empty"></span>}
                <span className="code-line-content">
                  <HighlightedLine code={line} />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CodeViewer;
