import React, { useState } from 'react';
import FlowsList from './FlowsList';
import FlowsCreate from './FlowsCreate';

export default function FlowsPage() {
  const [view, setView] = useState(() => localStorage.getItem('whatsapp_flows_view') || 'list'); // 'list' | 'create'

  React.useEffect(() => {
    localStorage.setItem('whatsapp_flows_view', view);
  }, [view]);

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
