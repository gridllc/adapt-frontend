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
import { AuthProvider } from '@/hooks/useAuth';
import './index.css';
import LiveCoachPage from '@/pages/LiveCoachPage';
import { PwaUpdater } from '@/components/PwaUpdater';

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
                path: 'modules/:moduleId/live',
                element: (
                    <ProtectedRoute>
                        <LiveCoachPage />
                    </ProtectedRoute>
                )
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
                <AuthProvider>
                    <ToastProvider>
                        <RouterProvider router={router} />
                        <PwaUpdater />
                    </ToastProvider>
                </AuthProvider>
            </ThemeProvider>
        </QueryClientProvider>
    </React.StrictMode>
);