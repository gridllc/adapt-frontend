
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Corrected import paths based on the project file structure
import RootLayout from '@/RootLayout';
import HomePage from '@/pages/HomePage';
import TrainingPage from '@/pages/TrainingPage';
import CreatePage from '@/pages/CreatePage';
import EditPage from '@/pages/EditPage';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import NotFoundPage from '@/pages/NotFoundPage';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ToastProvider } from '@/hooks/useToast';
import { ThemeProvider } from '@/hooks/useTheme';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

const queryClient = new QueryClient();

const router = createBrowserRouter([
    {
        path: '/',
        element: <RootLayout />,
        children: [
            {
                index: true,
                element: <HomePage />,
            },
            {
                path: 'login',
                element: <LoginPage />,
            },
            {
                path: 'dashboard',
                element: (
                    <ProtectedRoute>
                        <DashboardPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: 'modules/:moduleId',
                element: <TrainingPage />,
            },
            {
                path: 'modules/:moduleId/edit',
                element: (
                    <ProtectedRoute>
                        <EditPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: 'create',
                element: (
                    <ProtectedRoute>
                        <CreatePage />
                    </ProtectedRoute>
                ),
            },
            {
                path: '*', // Catch-all for 404
                element: <NotFoundPage />,
            }
        ],
    },
]);


const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <ToastProvider>
                    <RouterProvider router={router} />
                </ToastProvider>
            </ThemeProvider>
        </QueryClientProvider>
    </React.StrictMode>
);

// Register the service worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, err => {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}