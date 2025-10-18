import type { RepoTreeNode } from '../types';

const serializeNode = (node: RepoTreeNode, prefix: string, isLast: boolean): string => {
  const linePrefix = prefix + (isLast ? '└── ' : '├── ');
  const childPrefix = prefix + (isLast ? '    ' : '│   ');
  
  let output = '';
  if (node.type === 'folder') {
    output += `${linePrefix}${node.name}/\n`;
    node.children.forEach((child, index) => {
      output += serializeNode(child, childPrefix, index === node.children.length - 1);
    });
  } else {
    output += `${linePrefix}${node.name}\n`;
  }
  return output;
};

export const serializeTree = (nodes: RepoTreeNode[]): string => {
  let treeString = '/\n';
  nodes.forEach((node, index) => {
    treeString += serializeNode(node, '', index === nodes.length - 1);
  });
  return treeString;
};
