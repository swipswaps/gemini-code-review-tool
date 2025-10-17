
export interface RepoTreeFile {
  type: 'file';
  path: string;
  name: string;
}

export interface RepoTreeFolder {
  type: 'folder';
  path: string;
  name: string;
  children: RepoTreeNode[];
}

export type RepoTreeNode = RepoTreeFile | RepoTreeFolder;

export interface ReviewResult {
  reviewComments: string;
  correctedCode: string;
}
