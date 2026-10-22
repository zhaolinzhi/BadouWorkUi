import React from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import NotesPage from '../pages/NotesPage';

export function createRouter(_routerBase: string) {
  return createMemoryRouter(
    [
      {
        path: '/',
        element: React.createElement(NotesPage),
      },
    ],
    { initialEntries: ['/'] }
  );
}

export { RouterProvider };
