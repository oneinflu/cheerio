import React, { useState } from 'react';
import FlowsList from './FlowsList';
import FlowsCreate from './FlowsCreate';

export default function FlowsPage() {
  const [view, setView] = useState('list'); // 'list' | 'create'

  return (
    <div className="w-full h-screen bg-slate-50/50">
      {view === 'list' ? (
        <FlowsList onCreate={() => setView('create')} />
      ) : (
        <FlowsCreate 
          onCancel={() => setView('list')} 
          onSave={() => setView('list')}
        />
      )}
    </div>
  );
}
