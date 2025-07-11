

import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import RootLayout from './RootLayout';
import HomePage from './pages/HomePage';
import TrainingPage from './pages/TrainingPage';
import CreatePage from './pages/CreatePage';
import EditPage from './pages/EditPage'; // Import the Edit page
import NotFoundPage from './pages/NotFoundPage';
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
                path: 'modules/:moduleId',
                element: <TrainingPage />,
            },
            {
                path: 'modules/:moduleId/edit', // Edit route for admins
                element: <EditPage />,
            },
            {
                path: 'create',
                element: <CreatePage />,
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