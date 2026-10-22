/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useParams } from 'react-router-dom';
import { useAppContext } from '../AppContext';

export default function RecordingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ctx = useAppContext();
  return (
    <div className='microapp-meeting-recording'>
      <h1>Recording Detail</h1>
      <p>ID: {id}</p>
      <p>User: {ctx.userInfo.username}</p>
    </div>
  );
}
