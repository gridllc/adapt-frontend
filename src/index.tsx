import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import RootLayout from './RootLayout';
import HomePage from './pages/HomePage';
import TrainingPage from './pages/TrainingPage';
import CreatePage from './pages/CreatePage';
import EditPage from './pages/EditPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

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
        <RouterProvider router={router} />
    </React.StrictMode>
);