# Gemini Code Reviewer

An automated code review tool that uses the Gemini API to analyze files from public GitHub repositories, identify issues, and provide corrected code suggestions with a real-time, streaming "chain of thought" and a clear visual diff.

## Key Features

- **Direct GitHub Integration:** Fetches and displays files directly from any public GitHub repository using the GitHub REST API.
- **Multi-File Review & Formatting:** Select multiple files for a batch review, with each file's results displayed in a convenient accordion view. Includes a one-click "Auto-Fix & Format" feature for quick cleanups.
- **AI-Powered Code Analysis:** Leverages the advanced reasoning of the Gemini 2.5 Pro model to perform in-depth code reviews, checking for bugs, performance issues, security vulnerabilities, and adherence to best practices.
- **Interactive Feedback:** Review comments are interactive. Click on a line number reference (e.g., `L15-18`) in a comment, and the corresponding lines of code will instantly be highlighted in the diff viewer above.
- **Seamless Streaming Experience:** Provides a live, streaming view of the AI's "thought process" within a persistent UI, offering a superior and more transparent user experience than a simple loading spinner.
- **Side-by-Side Diff Viewer:** Renders suggested corrections in a clean, side-by-side diff format with line numbers and intuitive color-coding, making it easy to understand the proposed changes.
- **Modern & Resilient UI:** Built with React, TypeScript, and Tailwind CSS for a clean, performant, and responsive user experience. Includes error boundaries to gracefully handle runtime errors without crashing the application.

## How It Works: A Deep Dive

The application is a client-side React application that orchestrates two main external services: the GitHub API and the Gemini API. Here’s a detailed breakdown of the workflow.

### 1. Fetching Repository Files (`services/githubService.ts`)

When a user enters a GitHub repository URL, the application automatically initiates a debounced fetch process:

1.  **URL Parsing & Tree Construction:** The URL is parsed to extract the `owner` and `repo`. The application fetches the entire file list using the GitHub Git Trees API (`?recursive=1`), then intelligently constructs a hierarchical folder and file tree from the flat list of paths.
2.  **File Content Fetching:** When a user starts a review, a request is made to the Contents API endpoint (`/repos/{owner}/{repo}/contents/{path}`) for each selected file. This endpoint returns the file's content as a base64-encoded string, which the application decodes (`atob()`) into plain text for analysis. The process uses `Promise.allSettled` to handle errors gracefully, so one failed file won't stop an entire batch review.

### 2. AI-Powered Analysis (`services/geminiService.ts`)

The core of the application lies in its interaction with the Gemini API.

1.  **Prompt Engineering:** The file's content and path are embedded into a carefully crafted prompt. This prompt instructs the Gemini model to act as an **expert senior software engineer** and provides clear criteria for the review. Crucially, it asks the model to wrap any line number references in a special HTML tag (e.g., `<span data-lines="15-18">L15-18</span>`) to make its output machine-readable for the interactive highlighting feature.
2.  **Streaming for Real-Time Feedback:** The app uses the `gemini-2.5-pro` model's streaming capabilities (`generateContentStream`). This allows the app to receive the model's response in chunks as it's generated, rather than waiting for the entire review to complete.
3.  **Structured Output:** The prompt explicitly asks the model to structure its output in two parts, separated by a unique token (`<<CODE_SEPARATOR>>`):
    *   **Part 1: Review Comments:** A detailed, markdown-formatted explanation of the identified issues.
    *   **Part 2: Corrected Code:** The full, corrected version of the code.

### 3. The Code Review Lifecycle (`components/CodeReviewer.tsx`)

This component manages the multi-file review lifecycle in an accordion interface.

-   **Review in Progress:** When a review is initiated, the main view locks into a consistent layout. For each file, a **Review Comments** panel appears, showing the AI's "thought process" streaming in real-time, providing immediate feedback. Above it, a **Diff Viewer** shows the original code.
-   **Review Complete:** Once the stream for a file ends, the UI smoothly transitions. The **Review Comments** panel formats the streamed text into readable, structured markdown using the `marked` library. The **Diff Viewer** updates to show a side-by-side comparison of the original code and the AI's corrected version. This persistent layout avoids jarring UI shifts and keeps the context visible throughout the review.

### 4. Displaying the Results (`components/DiffViewer.tsx`)

To present the code changes clearly, the `DiffViewer` component performs a line-by-line comparison using the `diff` library. It renders two panels, "Original" and "Corrected," with line numbers. It intelligently adds blank lines to ensure that corresponding code blocks remain aligned, and it highlights lines in green (additions) or red (removals) for an intuitive visual representation.

## Project Structure

The project is organized into a logical structure to separate concerns.

```
/
├── components/            # Reusable React components
│   ├── icons/             # SVG icon components
│   ├── CodeReviewer.tsx     # Main component for managing the multi-file review accordion
│   ├── DiffViewer.tsx       # Component for showing side-by-side code differences
│   ├── ErrorBoundary.tsx    # Catches runtime errors to prevent app crashes
│   ├── FileBrowser.tsx      # Renders the interactive repository file tree
│   ├── RepoInput.tsx        # Component for GitHub URL input
│   ├── ReviewComments.tsx   # Displays streaming thought process and final formatted review
│   └── Spinner.tsx          # Loading spinner component
│
├── services/              # Modules for interacting with external APIs
│   ├── geminiService.ts     # Logic for calling the Gemini API
│   └── githubService.ts     # Logic for calling the GitHub API
│
├── App.tsx                # Main application component, manages state
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

1.  **Enter Repository URL:** In the input box at the top left, enter the full URL of a **public** GitHub repository. The app will automatically fetch the file tree.
2.  **Select Files:** Use the checkboxes in the file browser to select one or more files you want to review.
3.  **Start Review:** Click the **"Review Selected"** button at the bottom of the file browser.
4.  **Observe the Process:** The main view will populate with an accordion. Each selected file has its own collapsible section with a status indicator. The review process for all files starts automatically.
5.  **Analyze the Results:**
    -   Click on a file's header in the accordion to expand its review panel.
    -   Watch as the "thought process" comments are streamed in real-time.
    -   Once complete, the comments will be formatted, and the side-by-side diff will show the proposed changes.
    -   Click on line number references like `[L15-18]` in the comments to highlight the code in the diff viewer.
    -   Use the **"Auto-Fix & Format"** button for quick stylistic cleanups.
6.  **Start a New Review:** Click the **"New Review"** button to clear the results and select new files.