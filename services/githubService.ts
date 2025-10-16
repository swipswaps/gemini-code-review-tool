import type { RepoFile } from '../types';

const API_BASE = 'https://api.github.com';

// Helper to parse "owner/repo" from a GitHub URL
const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname !== 'github.com') {
      return null;
    }
    const parts = urlObj.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    return { owner: parts[0], repo: parts[1].replace('.git', '') };
  } catch (error) {
    return null;
  }
};

const ALLOWED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.go', '.java', '.cs',
  '.php', '.html', '.css', '.scss', '.json', '.yml', '.yaml', '.md',
  '.sh', 'Dockerfile', '.env'
]);

const hasAllowedExtension = (path: string): boolean => {
  if (ALLOWED_EXTENSIONS.has(path)) return true; // for files like "Dockerfile"
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) return false;
  const ext = path.substring(lastDot);
  return ALLOWED_EXTENSIONS.has(ext.toLowerCase());
};

// Fetches the file tree for a repository
export const fetchRepoFiles = async (repoUrl: string): Promise<RepoFile[]> => {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw new Error('Invalid GitHub repository URL.');
  }
  const { owner, repo } = parsed;

  const repoInfoResponse = await fetch(`${API_BASE}/repos/${owner}/${repo}`);
  if (!repoInfoResponse.ok) {
    if (repoInfoResponse.status === 404) throw new Error('Repository not found. Is it public?');
    throw new Error(`Failed to fetch repository info (status: ${repoInfoResponse.status}).`);
  }
  const repoInfo = await repoInfoResponse.json();
  const defaultBranch = repoInfo.default_branch;

  const treeResponse = await fetch(`${API_BASE}/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`);
  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch repository file tree (status: ${treeResponse.status}).`);
  }
  const treeData = await treeResponse.json();

  if (treeData.truncated) {
    console.warn("Warning: The file tree is too large and has been truncated by the GitHub API. Not all files may be shown.");
  }

  const files: RepoFile[] = treeData.tree
    .filter((item: any) => item.type === 'blob' && hasAllowedExtension(item.path))
    .map((item: any) => ({ path: item.path }));

  if (files.length === 0) {
    console.log("No reviewable files found in the repository.");
  }
  
  return files;
};

// Fetches the content of a single file
export const fetchFileContent = async (owner: string, repo: string, path: string): Promise<string> => {
    const contentResponse = await fetch(`${API_BASE}/repos/${owner}/${repo}/contents/${path}`);
    
    if (!contentResponse.ok) {
        throw new Error(`Failed to fetch file content for ${path} (status: ${contentResponse.status})`);
    }

    const contentData = await contentResponse.json();

    if (Array.isArray(contentData)) {
      throw new Error(`The path "${path}" is a directory, not a file.`);
    }

    if (contentData.encoding !== 'base64' || !contentData.content) {
        throw new Error(`Unsupported file encoding or empty file: ${path}`);
    }

    try {
        return atob(contentData.content);
    } catch (e) {
        console.error("Base64 decoding error:", e);
        throw new Error(`Failed to decode file content for ${path}.`);
    }
};
