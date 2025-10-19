
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

// Traverses the entire repository structure to get a flat list of all file paths.
// This is much faster than fetching content for every file.
export const fetchAllFilePaths = async (
  owner: string,
  repo: string,
  token: string | undefined,
  initialTree: RepoTreeNode[],
  onProgress?: (message: string) => void
): Promise<string[]> => {
    const allPaths: string[] = [];
    // Start with a copy of the initial tree to avoid modifying the original state directly.
    const foldersToScan: RepoTreeNode[] = [...initialTree]; 
    const scannedPaths = new Set<string>();

    while (foldersToScan.length > 0) {
        // Yield to the event loop on each iteration to prevent freezing the UI on very large repos.
        await new Promise(resolve => setTimeout(resolve, 0)); 
        const node = foldersToScan.pop()!;
        
        if (scannedPaths.has(node.path)) continue;
        scannedPaths.add(node.path);

        if (node.type === 'file') {
            allPaths.push(node.path);
        } else if (node.type === 'folder') {
            onProgress?.(`Scanning directory: ${node.path || '/'}`);
            try {
                // Fetch the contents of the directory.
                const children = await fetchFolderContents(owner, repo, node.path, token);
                // Add children to the scan queue in reverse to maintain a somewhat-depth-first order with pop().
                foldersToScan.push(...[...children].reverse());
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                onProgress?.(`ERROR scanning directory ${node.path || '/'}: ${errorMessage}`);
                console.error(`Skipping folder ${node.path} due to fetch error:`, e);
            }
        }
        
        // Safety break to avoid excessive API calls during development/testing.
        if (allPaths.length >= 100) {
            onProgress?.(`Reached 100 files. Limiting analysis to the first 100 files found.`);
            console.warn(`Reached 100 files limit.`);
            return allPaths.slice(0, 100);
        }
    }
    return allPaths;
};