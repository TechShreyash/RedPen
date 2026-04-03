import { useEffect, useRef } from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
// Load language support
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-sql';
import './CodeSnippet.css';

const EXT_LANG_MAP = {
  py: 'python',
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  java: 'java',
  go: 'go',
  rb: 'ruby',
  php: 'php',
  c: 'c',
  cpp: 'cpp',
  cs: 'csharp',
  sh: 'bash',
  bash: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  json: 'json',
  sql: 'sql',
};

function detectLanguage(filePath) {
  if (!filePath) return 'plaintext';
  const ext = filePath.split('.').pop().toLowerCase();
  return EXT_LANG_MAP[ext] || 'plaintext';
}

export default function CodeSnippet({
  code = '',
  filePath = '',
  startLine = 1,
  highlightRange = null,
}) {
  const codeRef = useRef(null);
  const language = detectLanguage(filePath);

  // Normalize the code - handle both \r\n and \n
  const normalizedCode = (code || '').replace(/\r\n/g, '\n');

  useEffect(() => {
    if (codeRef.current && normalizedCode) {
      try {
        Prism.highlightElement(codeRef.current);
      } catch (e) {
        // Prism can crash on some edge cases, fail silently
        console.warn('Prism highlighting failed:', e);
      }
    }
  }, [normalizedCode, language]);

  if (!normalizedCode) {
    return (
      <div className="code-snippet" id="code-snippet-block">
        <div className="code-snippet-header">
          <span className="code-snippet-lang">—</span>
        </div>
        <div className="code-snippet-body">
          <pre className="code-pre">
            <code className="code-empty">No code snippet available</code>
          </pre>
        </div>
      </div>
    );
  }

  const lines = normalizedCode.split('\n');
  // Remove trailing empty line if exists
  if (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(normalizedCode).catch(() => {});
  };

  return (
    <div className="code-snippet" id="code-snippet-block">
      <div className="code-snippet-header">
        <span className="code-snippet-lang">{language}</span>
        <button className="code-snippet-copy btn-ghost" onClick={handleCopy} title="Copy code">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </button>
      </div>
      <div className="code-snippet-body">
        <div className="line-numbers" aria-hidden="true">
          {lines.map((_, i) => {
            const lineNum = startLine + i;
            const isHighlighted =
              highlightRange &&
              lineNum >= highlightRange.start &&
              lineNum <= highlightRange.end;
            return (
              <span
                key={i}
                className={`line-number ${isHighlighted ? 'line-highlighted' : ''}`}
              >
                {lineNum}
              </span>
            );
          })}
        </div>
        <pre className="code-pre">
          <code ref={codeRef} className={`language-${language}`}>
            {normalizedCode}
          </code>
        </pre>
      </div>
    </div>
  );
}
