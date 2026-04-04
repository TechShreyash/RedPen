import { useState, useCallback } from 'react';
import './FileTree.css';

const FolderIcon = ({ isOpen }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="file-tree-icon">
    {isOpen ? (
      <path d="M1.5 3.5h4l1 1h6a1 1 0 011 1v1H6.5l-1-1H2.5V3.5h-1zm0 2v7a1 1 0 001 1h11a1 1 0 001-1V6.5H6l-1-1H1.5z" fill="#8b5cf6" opacity="0.9"/>
    ) : (
      <path d="M1.5 2.5a1 1 0 011-1h3l1.5 1.5h5.5a1 1 0 011 1v8a1 1 0 01-1 1h-10a1 1 0 01-1-1v-9.5z" fill="#8b5cf6" opacity="0.7"/>
    )}
  </svg>
);

const FileIcon = ({ name, hasError }) => {
  const ext = name.split('.').pop();
  let color = '#64748b';
  if (ext === 'py') color = '#3b82f6';
  else if (ext === 'js' || ext === 'jsx') color = '#eab308';
  else if (ext === 'ts' || ext === 'tsx') color = '#3b82f6';
  else if (ext === 'md') color = '#6b7280';
  else if (ext === 'sh') color = '#22c55e';
  else if (ext === 'txt') color = '#94a3b8';
  else if (ext === 'pyc') color = '#64748b';

  return (
    <div className="file-icon-wrapper">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="file-tree-icon">
        <path d="M3 1.5h6.5L13 5v9a1 1 0 01-1 1H3a1 1 0 01-1-1V2.5a1 1 0 011-1z" fill={color} opacity="0.2" stroke={color} strokeWidth="0.5"/>
        <path d="M9.5 1.5V5H13" stroke={color} strokeWidth="0.5" fill={color} opacity="0.3"/>
      </svg>
      {hasError && <span className="file-error-dot"></span>}
    </div>
  );
};

const ChevronIcon = ({ isOpen }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    className={`chevron-icon ${isOpen ? 'chevron-open' : ''}`}
  >
    <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TreeNode = ({ element, depth = 0, selectedId, onSelect, expandedItems, onToggle, errorFileIds }) => {
  const isFolder = element.type === 'folder';
  const isExpanded = expandedItems.includes(element.id);
  const isSelected = selectedId === element.id;
  const hasError = errorFileIds?.includes(element.id);
  const hasErrorChild = isFolder && element.children?.some(c =>
    errorFileIds?.includes(c.id) || (c.type === 'folder' && hasErrorInTree(c, errorFileIds))
  );

  const handleClick = () => {
    if (isFolder) {
      onToggle(element.id);
    } else {
      onSelect(element.id);
    }
  };

  return (
    <div className="tree-node">
      <div
        className={`tree-item ${isSelected ? 'tree-item--selected' : ''} ${hasError ? 'tree-item--error' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        role="treeitem"
        tabIndex={0}
        id={`tree-item-${element.id}`}
      >
        {isFolder && <ChevronIcon isOpen={isExpanded} />}
        {!isFolder && <span className="tree-spacer"></span>}
        {isFolder ? <FolderIcon isOpen={isExpanded} /> : <FileIcon name={element.name} hasError={hasError} />}
        <span className={`tree-item-name ${hasError ? 'tree-item-name--error' : ''} ${hasErrorChild ? 'tree-item-name--warn' : ''}`}>
          {element.name}
        </span>
        {hasError && (
          <span className="tree-error-badge">
            {errorFileIds.filter(id => id === element.id).length > 0 ? '!' : ''}
          </span>
        )}
      </div>
      {isFolder && isExpanded && element.children && (
        <div className="tree-children">
          {element.children.map(child => (
            <TreeNode
              key={child.id}
              element={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedItems={expandedItems}
              onToggle={onToggle}
              errorFileIds={errorFileIds}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function hasErrorInTree(element, errorFileIds) {
  if (!element.children) return false;
  return element.children.some(c =>
    errorFileIds?.includes(c.id) || (c.type === 'folder' && hasErrorInTree(c, errorFileIds))
  );
}

const FileTree = ({
  elements,
  initialSelectedId = null,
  initialExpandedItems = [],
  onSelectFile,
  errorFileIds = [],
  className = ''
}) => {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [expandedItems, setExpandedItems] = useState(initialExpandedItems);

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
    onSelectFile?.(id);
  }, [onSelectFile]);

  const handleToggle = useCallback((id) => {
    setExpandedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  return (
    <div className={`file-tree ${className}`} role="tree">
      <div className="file-tree-header">
        <span className="file-tree-header-icon">📁</span>
        <span>Project Files</span>
      </div>
      <div className="file-tree-content">
        {elements.map(element => (
          <TreeNode
            key={element.id}
            element={element}
            selectedId={selectedId}
            onSelect={handleSelect}
            expandedItems={expandedItems}
            onToggle={handleToggle}
            errorFileIds={errorFileIds}
          />
        ))}
      </div>
    </div>
  );
};

export default FileTree;
