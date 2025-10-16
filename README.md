# Gemini Code Reviewer

An automated code review tool that uses the Gemini API to analyze files from public GitHub repositories, identify issues, and provide corrected code suggestions with a real-time, streaming "chain of thought" and a clear visual diff.

## Key Features

- **Direct GitHub Integration:** Fetches and displays files directly from any public GitHub repository using the GitHub REST API.
- **AI-Powered Code Analysis:** Leverages the advanced reasoning of the Gemini 2.5 Pro model to perform in-depth code reviews, checking for bugs, performance issues, security vulnerabilities, and adherence to best practices.
- **Real-Time Streaming Feedback:** Provides a live, streaming view of the AI's "thought process" as it analyzes the code, offering superior user experience and transparency compared to a simple loading spinner.
- **Visual Diff Viewer:** Renders suggested corrections in a clean, unified diff format—similar to `git diff`—with intuitive color-coding for added and removed lines, making it easy to understand the proposed changes.
- **Modern & Responsive UI:** Built with React, TypeScript, and Tailwind CSS for a clean, performant, and responsive user experience that works across devices.
- **Broad Language Support:** Capable of reviewing a wide range of common programming languages and configuration file types, thanks to a configurable file extension filter.

## How It Works: A Deep Dive

The application is a client-side React application that orchestrates two main external services: the GitHub API and the Gemini API. Here’s a detailed breakdown of the workflow.

### 1. Fetching Repository Files (`services/githubService.ts`)

When a user enters a GitHub repository URL and clicks "Fetch Files," the application initiates a multi-step process to retrieve the file tree:

1.  **URL Parsing:** The provided URL is parsed to extract the repository `owner` and `repo` name.
2.  **Default Branch Discovery:** An initial, unauthenticated request is made to the GitHub REST API endpoint (`/repos/{owner}/{repo}`) to get the repository's metadata, which includes the name of its `default_branch`.
3.  **Recursive Tree Fetch:** A second request is made to the Git Trees API endpoint (`/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1`). The `recursive=1` query parameter is crucial, as it fetches the entire file structure of the repository in a single API call, avoiding the need to traverse directories one by one.
4.  **File Filtering:** The response, which contains a list of all files and directories, is filtered to include only files (`type: 'blob'`). Each file's path is checked against a predefined set of allowed extensions (`ALLOWED_EXTENSIONS`) to ensure only reviewable, text-based files are shown to the user.
5.  **Content Fetching:** When a user clicks on a file in the browser, a final API call is made to the Contents API endpoint (`/repos/{owner}/{repo}/contents/{path}`). This endpoint returns the file's content as a base64-encoded string, which the application then decodes into plain text using `atob()` for display and analysis.

### 2. AI-Powered Analysis (`services/geminiService.ts`)

The core of the application lies in its interaction with the Gemini API.

1.  **Prompt Engineering:** When the "Review Code" button is clicked, the selected file's content and path are embedded into a carefully crafted prompt. This prompt instructs the Gemini model to assume the persona of an **expert senior software engineer**. It provides a clear set of criteria for the review, including bugs, performance, best practices, security, and style.
2.  **Streaming for Real-Time Feedback:** The application uses the `gemini-2.5-pro` model via the `@google/genai` SDK's `generateContentStream` method. This is a key feature, as it allows the app to receive the model's response in chunks as it's being generated, rather than waiting for the entire review to complete.
3.  **Structured Output:** The prompt explicitly asks the model to structure its output in two parts, separated by a unique token (`<<CODE_SEPARATOR>>`):
    *   **Part 1: Review Comments:** A detailed, markdown-formatted explanation of the identified issues and the reasoning behind the suggested fixes.
    *   **Part 2: Corrected Code:** The full, corrected version of the code, formatted in a markdown code block. This ensures the output can be programmatically parsed.

### 3. The Code Review Lifecycle (`components/CodeReviewer.tsx`)

This component acts as the central hub for the user's interaction with a selected file. It manages the entire review lifecycle through its state:

-   **Initial State:** Displays the content of the selected file in a `<pre>` block.
-   **Review in Progress:** When the review is initiated, the view switches to the `StreamingResponse` component. This component receives the stream of text from the Gemini API and renders it in real-time, along with a blinking cursor, giving the user immediate feedback that the analysis is underway.
-   **Review Complete:** Once the stream ends, `CodeReviewer.tsx` processes the complete response. It splits the text at the `<<CODE_SEPARATOR>>` token to separate the comments from the corrected code. It then passes this data to the `DiffViewer` and displays the markdown comments below it. Error handling is also managed here, displaying any issues that occur during the API call.

### 4. Displaying the Results (`components/DiffViewer.tsx`)

To present the code changes clearly, the `DiffViewer` component performs a line-by-line comparison:

-   It uses the `diff` library's `diffLines` function to compare the original and corrected code snippets.
-   The function returns an array of "change objects," where each object represents a block of added, removed, or unchanged lines.
-   The component maps over this array, rendering each line with:
    -   A `+` or `-` prefix.
    -   A distinct background color (green for additions, red for removals) to provide an immediate, scannable visual representation of the proposed changes.

## Project Structure

The project is organized into a logical structure to separate concerns.

```
/
├── components/          # Reusable React components
│   ├── icons/           # SVG icon components
│   ├── CodeReviewer.tsx   # Main component for displaying code and review results
│   ├── DiffViewer.tsx     # Component for showing code differences
│   ├── FileBrowser.tsx    # Component for listing repository files
│   ├── RepoInput.tsx      # Component for GitHub URL input
│   ├── Spinner.tsx        # Loading spinner component
│   └── StreamingResponse.tsx # Component for displaying streaming text
│
├── services/            # Modules for interacting with external APIs
│   ├── geminiService.ts   # Logic for calling the Gemini API
│   └── githubService.ts   # Logic for calling the GitHub API
│
├── App.tsx              # Main application component, manages state
├── index.html           # The entry point HTML file
├── index.tsx            # React application root
├── types.ts             # TypeScript type definitions for the project
└── README.md            # You are here!
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

### 3. Set Up Your Gemini API Key

1.  Go to [Google AI Studio](https://aistudio.google.com/app/apikey) and create an API key.
2.  Create a file named `.env` in the root of the project and add your key:
    ```
    # .env
    API_KEY=YOUR_GEMINI_API_KEY_HERE
    ```

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

1.  **Enter Repository URL:** In the input box at the top left, enter the full URL of a **public** GitHub repository (e.g., `https://github.com/microsoft/TypeScript-Node-Starter`).
2.  **Fetch Files:** Click the **"Fetch Files"** button. The application will contact the GitHub API, and the file browser below the input box will populate with a list of reviewable files from the repository.
3.  **Select a File:** Click on any file in the browser. Its content will load and appear in the main view on the right.
4.  **Review Code:** Click the purple **"Review Code"** button at the top of the main view.
5.  **Observe the Process:** The main view will be replaced by a panel showing "Gemini's thought process..." Watch as the review comments are streamed in real-time. This confirms the AI is actively working on your request.
6.  **Analyze the Results:** Once the review is complete, the view will update to show two panels:
    - A **Code Diff** panel at the top, highlighting the exact changes between the original and corrected code. Lines in red are deletions, and lines in green are additions.
    - A **Review Comments** panel below, containing the detailed, markdown-formatted explanations from the AI.
