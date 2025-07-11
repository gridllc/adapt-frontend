<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Adapt - AI Training Platform</title>
  <link rel="icon" href="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3e%3ctext y='.9em' font-size='90'%3e🤖%3c/text%3e%3c/svg%3e">
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#1e293b">
  <script>
    // This script must run before the main app script to prevent a flash of unstyled content.
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // Configure Tailwind to use class-based dark mode
    tailwind.config = {
      darkMode: 'class',
    }
  </script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* For custom scrollbars */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: #e2e8f0;
      /* light: slate-200 */
    }

    .dark ::-webkit-scrollbar-track {
      background: #1e293b;
      /* dark: slate-800 */
    }


    ::-webkit-scrollbar-thumb {
      background: #94a3b8;
      /* light: slate-400 */
      border-radius: 4px;
    }

    .dark ::-webkit-scrollbar-thumb {
      background: #475569;
      /* dark: slate-600 */
    }


    ::-webkit-scrollbar-thumb:hover {
      background: #64748b;
      /* dark: slate-500 */
    }

    .dark ::-webkit-scrollbar-thumb:hover {
      background: #64748b;
    }

    /* Simple fade-in animation */
    @keyframes fade-in-up {
      from {
        opacity: 0;
        transform: translateY(10px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .animate-fade-in-up {
      animation: fade-in-up 0.3s ease-out forwards;
    }
  </style>
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@^18.2.0",
    "react-dom/": "https://esm.sh/react-dom@^18.2.0/",
    "react-router-dom": "https://esm.sh/react-router-dom@^6.23.1",
    "react/": "https://esm.sh/react@^18.2.0/",
    "@google/genai": "https://esm.sh/@google/genai@^0.14.0",
    "@/": "/src/",
    "vite": "https://esm.sh/vite@^7.0.4",
    "@vitejs/plugin-react": "https://esm.sh/@vitejs/plugin-react@^4.6.0",
    "vite-tsconfig-paths": "https://esm.sh/vite-tsconfig-paths@^5.1.4",
    "@tanstack/react-query": "https://esm.sh/@tanstack/react-query@^5.82.0",
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@^2.50.5"
  }
}
</script>
</head>

<body class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-sans transition-colors duration-300">
  <div id="root"></div>
  <script type="module" src="/src/index.tsx"></script>
</body>

</html>