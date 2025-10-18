# Gemini Code Reviewer

An automated code review tool that uses the Gemini API to analyze files from public GitHub repositories, identify issues, and provide corrected code suggestions with a real-time, streaming "chain of thought" and a clear visual diff.

## Key Features

- **Direct GitHub Integration:** Fetches and displays files directly from any public GitHub repository using the GitHub REST API.
- **Deep Repository Analysis:** Go beyond single files with a holistic architectural review. The tool analyzes the entire codebase to identify cross-cutting concerns, dependency issues, and common error patterns, presenting the results in an interactive, multi-section report.
- **Multi-File Review & Formatting:** Select multiple files for a batch review, with each file's results displayed in a convenient accordion view. Includes a one-click "Auto-Fix & Format" feature for quick cleanups.
- **AI-Powered Code Analysis:** Leverages the advanced reasoning of the Gemini 2.5 Pro model to perform in-depth code reviews, checking for bugs, performance issues, security vulnerabilities, and adherence to best practices.
- **Interactive Feedback with Diffs:** Review comments and architectural suggestions are interactive. For single-file reviews, click on a line number reference (e.g., `L15-18`) to highlight the code. For the repository analysis, each suggested fix comes with its own side-by-side diff view.
- **Side-by-Side Diff Viewer:** Renders suggested corrections in a clean, side-by-side diff format with line numbers and intuitive color-coding, making it easy to understand the proposed changes.
- **Modern & Resilient UI:** Built with React, TypeScript, and Tailwind CSS for a clean, performant, and responsive user experience. Includes error boundaries to gracefully handle runtime errors without crashing the application.

## How It Works: A Deep Dive

The application is a client-side React application that orchestrates two main external services: the GitHub API and the Gemini API. There are two primary analysis modes.

### 1. Multi-File Code Review (`components/CodeReviewer.tsx`)

This mode is for deep-diving into specific files.

- **File Fetching (`services/githubService.ts`):** When a user selects files and starts a review, a request is made to the GitHub Contents API for each file. The base64 content is decoded into plain text.
- **Streaming Analysis (`services/geminiService.ts`):** The content of each file is sent to the Gemini 2.5 Pro model via a streaming request. The prompt instructs the model to act as a senior engineer, provide markdown-formatted comments, and wrap line numbers in special tags (`<span data-lines="...">`) for interactivity. It must also provide the full corrected code after a separator token.
- **Interactive Display (`components/DiffViewer.tsx`, `components/ReviewComments.tsx`):** The UI displays the AI's "thought process" as it streams in. Once complete, the final comments are formatted and the diff view is populated by comparing the original and AI-corrected code.

### 2. Holistic Repository Analysis (`components/RepoAnalyzer.tsx`)

This mode provides a high-level, architectural overview of the entire project.

1.  **Fetch Entire Codebase:** The application first fetches the content of every file in the repository (up to a safety limit).
2.  **Holistic Prompting & JSON Output:** All the file contents are concatenated into a single, massive prompt. The Gemini 2.5 Pro model is instructed to act as a **solution architect** and return a structured **JSON object** containing its full analysis. This ensures a reliable, machine-readable response.
3.  **Interactive Report:** The `RepoAnalyzer` component receives this JSON object and renders a comprehensive, multi-part report including:
    -   An overall architectural summary.
    -   A review of the project's dependencies.
    -   A list of common error trends or anti-patterns observed across the codebase.
    -   An accordion of specific, file-by-file suggested fixes, each with its own description and side-by-side **diff view**.

## Project Structure

The project is organized into a logical structure to separate concerns.

```
/
├── components/            # Reusable React components
│   ├── icons/             # SVG icon components
│   ├── CodeReviewer.tsx     # Manages the multi-file review accordion
│   ├── DiffViewer.tsx       # Shows side-by-side code differences
│   ├── ErrorBoundary.tsx    # Catches runtime errors to prevent app crashes
│   ├── FileBrowser.tsx      # Renders the interactive repository file tree
│   ├── RepoAnalyzer.tsx     # Renders the holistic, multi-part repository analysis report
│   ├── RepoInput.tsx        # Component for GitHub URL input
│   ├── ReviewComments.tsx   # Displays streaming thought process and final formatted review
│   └── Spinner.tsx          # Loading spinner component
│
├── services/              # Modules for interacting with external APIs
│   ├── geminiService.ts     # Logic for calling the Gemini API
│   └── githubService.ts     # Logic for calling the GitHub API
│
├── utils/                 # Utility functions
│   └── constants.ts       # Shared constants like API tokens
│
├── App.tsx                # Main application component, manages state and review modes
├── index.html             # The entry point HTML file
├── index.tsx              # React application root
├── types.ts               # TypeScript type definitions for the project
└── README.md              # You are here!
```

## Installation and Setup Guide

This project is a static web application and can be run with any simple HTTP server. However, it relies on a `process.env.API_KEY` environment variable being available in the browser context, which standard static servers do not provide. The setup below includes using `Vite` as a development server because it can easily handle this requirement without modifying the application's source code.

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or later recommended)
- `npm` or `yarn` package manager

### 1. Clone the Repository

Clone this project to your local machine:

```bash
git clone https://github.com/your-username/gemini-code-reviewer.git
cd gemini-code-reviewer
```

### 2. Install Dependencies

You'll need `vite` to run the development server. Initialize a `package.json` if you don't have one (`npm init -y`) and then install `vite`:

```bash
npm install vite
```

### 3. Set Up Your API Keys

#### a) Gemini API Key

<div style="background-color: #4B0000; border: 1px solid #FF5555; border-radius: 8px; padding: 16px; color: #FFDDDD;">
  <h3 style="color: #FF8888; margin-top: 0;">⚠️ Security Warning</h3>
  <p>This project is designed as a proof-of-concept and uses a client-side implementation where the <strong>Gemini API key is exposed in the browser</strong>. This is a significant security risk.</p>
  <p><strong>Do not use this application in a production environment or with an unrestricted API key.</strong> Anyone with access to the web page can view your API key and use it, which could lead to unexpected charges on your Google Cloud bill. For a production-ready application, you must implement a backend proxy that securely stores the API key and forwards requests to the Gemini API.</p>
</div>

1.  Go to [Google AI Studio](https://aistudio.google.com/app/apikey) and create an API key.
2.  Create a file named `.env` in the root of the project and add your key:
    ```
    # .env
    API_KEY=YOUR_GEMINI_API_KEY_HERE
    ```

#### b) GitHub Personal Access Token (Recommended)
The GitHub API has strict rate limits for unauthenticated requests. To avoid these limits, especially when analyzing entire repositories, you should use a Personal Access Token.

1. Go to your [GitHub Developer Settings](https://github.com/settings/tokens?type=beta) to create a new token.
2. Configure the token with `public_repo` access. This is all the permission the application needs.
3. Copy the token and paste it into the "GitHub Personal Access Token" field in the application's UI. The token is only stored in your browser's memory for the current session and is not saved anywhere else.


### 4. Configure Vite

Create a `vite.config.js` file in the project root. This configuration will make the environment variable from your `.env` file available as `process.env.API_KEY` in the browser.

```javascript
// vite.config.js
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
});
```
*This configuration tells Vite to find `API_KEY` in your `.env` file and replace any occurrence of `process.env.API_KEY` in the code with the actual key string during development.*

### 5. Run the Development Server

1. Add a `start` script to your `package.json`:

    ```json
    // package.json
    "scripts": {
      "start": "vite"
    }
    ```

2. Start the server:

    ```bash
    npm start
    ```

3. Open the local URL provided by Vite (e.g., `http://localhost:5173`) in your browser.

## User Guide

1.  **Enter Repository URL & Token:**
    - In the input box at the top left, enter the full URL of a **public** GitHub repository. The app will automatically fetch the file tree.
    - Paste your GitHub Personal Access Token into the field below the URL to avoid API rate limits.
2.  **Choose an Analysis Mode:**
    -   **Holistic Analysis:** Click the **"Analyze Entire Repository"** button for a high-level architectural review. This may take a minute as it fetches and analyzes the entire codebase.
    -   **File-Specific Review:** Use the checkboxes in the file browser to select one or more files, then click the **"Review Selected"** button.
3.  **Analyze the Results:**
    -   For a repository analysis, explore the different sections of the report. Expand the "Suggested Fixes" to see descriptions and side-by-side diffs.
    -   For file reviews, expand each file's accordion panel to see the diff and the AI's comments. Click on line number references like `[L15-18]` in the comments to highlight the code.
4.  **Start a New Review:** Click the **"New Review"** button to clear the results and return to the file browser.