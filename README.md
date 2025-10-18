# Gemini Code Reviewer

An automated code review tool that uses the Gemini API to analyze files from public GitHub repositories, identify issues, and provide corrected code suggestions with a clear visual diff. This project uses a secure client-server architecture to protect your API key.

## Key Features

- **Secure Architecture:** The Gemini API key is managed securely in a backend Node.js server, ensuring it is never exposed to the browser.
- **High-Performance File Browser:** Implements lazy loading for directories, providing an instantaneous experience even with massive repositories.
- **Real-Time Streaming Analysis:** The holistic architectural review now streams results and status updates live, providing a transparent and engaging user experience.
- **Direct GitHub Integration:** Fetches and displays files directly from any public GitHub repository using the GitHub REST API.
- **Multi-File Review & Formatting:** Select multiple files for a batch review, with each file's results displayed in a convenient accordion view. Includes a one-click "Auto-Fix & Format" feature for quick cleanups.
- **Interactive Feedback with Diffs:** Review comments and architectural suggestions are interactive. Click on a line number reference (e.g., `L15-18`) to highlight the code, or view side-by-side diffs for suggested architectural fixes.
- **Modern & Resilient UI:** Built with React, TypeScript, and Tailwind CSS for a clean and responsive user experience. Includes error boundaries to gracefully handle runtime errors.

## How It Works: A Secure Architecture

The application is composed of two main parts: a client-side React application and a backend Node.js proxy server. This separation is crucial for security.

1.  **React Frontend (Client):**
    -   This is the user interface you interact with in the browser.
    -   It handles fetching the repository file structure from the GitHub API.
    -   When a review or analysis is requested, it **does not** call the Gemini API directly. Instead, it sends the code to its own backend server.

2.  **Node.js Server (Backend Proxy):**
    -   This server is the only part of the system that has access to your Gemini API key, which it reads securely from a `.env` file.
    -   It receives requests from the React frontend.
    -   It then forwards those requests to the Gemini API, adding the secret API key.
    -   It streams the response from the Gemini API back to the client.

This architecture ensures that your **Gemini API key is never exposed to the public internet**, resolving the critical security flaw of client-side key exposure.

## Project Structure

```
/
├── components/       # React components for the UI
├── services/         # Modules for interacting with APIs (GitHub and our own backend)
├── utils/            # Utility functions
├── App.tsx           # Main application component
├── index.html        # Entry point HTML
├── index.tsx         # React application root
├── server.js         # The secure backend proxy server
├── package.json      # Project dependencies and scripts
├── .env.example      # Template for environment variables
└── README.md         # You are here!
```

## Setup and Usage

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or later recommended)
- `npm` package manager

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/your-username/gemini-code-reviewer.git
cd gemini-code-reviewer
npm install
```

### 2. Configure Your API Key (Securely)

The Gemini API key is now managed on the backend.

1.  **Create a `.env` file:** Copy the example file.
    ```bash
    cp .env.example .env
    ```
2.  **Add your API Key:**
    -   Go to [Google AI Studio](https://aistudio.google.com/app/apikey) and create an API key.
    -   Open the `.env` file you just created and paste your key into it.
    ```
    API_KEY="YOUR_GEMINI_API_KEY_HERE"
    ```

### 3. Run the Application

This command will start both the backend server and the frontend development server at the same time.

```bash
npm run dev
```

- The backend will run on `http://localhost:3001`.
- The frontend will open in your browser, usually at `http://localhost:3000`.

### User Guide

1.  **Enter GitHub URL:**
    -   Enter the full URL of a **public** GitHub repository. The app will automatically fetch the file tree.
    -   Optionally, provide a GitHub Personal Access Token to avoid API rate limits.
2.  **Choose an Analysis Mode:**
    -   **Holistic Analysis:** Click **"Analyze Entire Repository"** for a high-level architectural review.
    -   **File-Specific Review:** Use the checkboxes to select files, then click **"Review Selected"**.
3.  **Analyze the Results:**
    -   Explore the interactive reports. Expand sections and click on line references to see the AI's insights and suggested changes with diffs.
4.  **Start a New Review:** Click **"New Review"** to clear the results and return to the file browser.