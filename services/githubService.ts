
import type { RepoTreeNode, RepoTreeFolder, RepoTreeFile } from '../types';

const API_BASE = 'https://api.github.com';

// Helper to add a timeout to fetch requests
const fetchWithTimeout = async (resource: RequestInfo, options: RequestInit = {}, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(resource, {
        ...options,
        signal: controller.signal  
    });
    
    clearTimeout(id);
    return response;
};


// Helper to parse "owner/repo" from a GitHub URL
export const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
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

const sortNodes = (nodes: RepoTreeNode[]): RepoTreeNode[] => {
    return nodes.sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
    });
};

// Fetches the top-level file tree for a repository
export const fetchRepoRoot = async (repoUrl: string, token?: string): Promise<RepoTreeNode[]> => {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw new Error('Invalid GitHub repository URL.');
  }
  return fetchFolderContents(parsed.owner, parsed.repo, '', token);
};


// Fetches the contents of a specific folder
export const fetchFolderContents = async (owner: string, repo: string, path: string, token?: string): Promise<RepoTreeNode[]> => {
    const headers: HeadersInit = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const contentsResponse = await fetchWithTimeout(`${API_BASE}/repos/${owner}/${repo}/contents/${path}`, { headers });
    if (!contentsResponse.ok) {
        if (contentsResponse.status === 404) throw new Error(`Folder not found: ${path}`);
        if (contentsResponse.status === 403) throw new Error('GitHub API rate limit exceeded. Please provide a Personal Access Token.');
        throw new Error(`Failed to fetch folder contents for ${path} (status: ${contentsResponse.status}).`);
    }

    const contents = await contentsResponse.json();
    if (!Array.isArray(contents)) {
        throw new Error("The path does not appear to be a directory.");
    }
    
    const nodes: RepoTreeNode[] = contents.map((item: any) => {
        if (item.type === 'dir') {
            return {
                type: 'folder',
                path: item.path,
                name: item.name,
                children: null, // Mark as lazy-loadable
            } as RepoTreeFolder;
        } else {
            return {
                type: 'file',
                path: item.path,
                name: item.name,
                size: item.size,
            } as RepoTreeFile;
        }
    });

    return sortNodes(nodes);
};


// Fetches the content of a single file
export const fetchFileContent = async (owner: string, repo: string, path: string, token?: string): Promise<string> => {
    const headers: HeadersInit = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const contentResponse = await fetchWithTimeout(`${API_BASE}/repos/${owner}/${repo}/contents/${path}`, { headers });
    
    if (!contentResponse.ok) {
        if (contentResponse.status === 403) throw new Error('GitHub API rate limit exceeded. Please provide a Personal Access Token.');
        throw new Error(`Failed to fetch file content for ${path} (status: ${contentResponse.status})`);
    }

    const contentData = await contentResponse.json();

    if (Array.isArray(contentData)) {
      throw new Error(`The path "${path}" is a directory, not a file.`);
    }

    // Reliably handle empty files by checking the size property.
    if (contentData.size === 0) {
        return '';
    }

    if (contentData.encoding !== 'base64' || typeof contentData.content !== 'string') {
        if (contentData.download_url) {
            // This indicates a file too large for the contents API. Treat as an error for this app.
            throw new Error(`File is too large to fetch via this method: ${path}`);
        }
        throw new Error(`Unsupported file encoding or missing content for file: ${path}`);
    }

    try {
        return atob(contentData.content);
    } catch (e) {
        console.error("Base64 decoding error:", e);
        throw new Error(`Failed to decode file content for ${path}.`);
    }
};

// Fetches the content for all files in the repository tree by recursively fetching folder contents
export const fetchAllFileContents = async (
  owner: string,
  repo: string,
  initialTree: RepoTreeNode[],
  token?: string,
  onProgress?: (message: string) => void
): Promise<{ path: string; content: string }[]> => {
  
  const allFiles: { path: string; content: string }[] = [];
  const foldersToFetch: RepoTreeNode[] = [...initialTree];
  let fetchedPaths = new Set<string>();

  while(foldersToFetch.length > 0) {
      // Unconditionally yield to the event loop on each iteration. This prevents the UI from
      // freezing when processing a large number of files synchronously (e.g., skipping empty files).
      await new Promise(resolve => setTimeout(resolve, 0));

      const node = foldersToFetch.pop()!;
      if (fetchedPaths.has(node.path)) continue;
      fetchedPaths.add(node.path);

      if (node.type === 'file') {
          // The node from the tree now includes size, so we can skip fetching empty files.
          if ((node as RepoTreeFile).size === 0) {
              onProgress?.(`Skipping empty file: ${node.path}`);
              allFiles.push({ path: node.path, content: '' });
          } else {
              onProgress?.(`Fetching file ${allFiles.length + 1}/100: ${node.path}`);
              try {
                  const content = await fetchFileContent(owner, repo, node.path, token);
                  allFiles.push({ path: node.path, content });
              } catch(e) {
                  const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                  onProgress?.(`ERROR fetching ${node.path}: ${errorMessage}`);
                  console.error(`Skipping file ${node.path} due to fetch error:`, e);
                  allFiles.push({ path: node.path, content: `// Error fetching content: ${errorMessage}` });
              }
          }
      } else if (node.type === 'folder') {
          onProgress?.(`Scanning directory: ${node.path || '/'}`);
          try {
            const children = await fetchFolderContents(owner, repo, node.path, token);
            // Push children in reverse order to process them in a more natural (e.g., alphabetical) order
            foldersToFetch.push(...[...children].reverse());
          } catch(e) {
             const errorMessage = e instanceof Error ? e.message : 'Unknown error';
             onProgress?.(`ERROR scanning directory ${node.path || '/'}: ${errorMessage}`);
             console.error(`Skipping folder ${node.path} due to fetch error:`, e);
          }
      }

      if (allFiles.length >= 100) {
          onProgress?.(`Reached 100 files. Starting analysis...`);
          console.warn(`Reached 100 files. Limiting analysis to the first 100 files fetched to avoid performance issues.`);
          break;
      }
  }
  
  return allFiles;
};
