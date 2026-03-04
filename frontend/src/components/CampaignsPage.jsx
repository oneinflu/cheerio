import React from 'react';

export default function CampaignsPage() {
    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50">
            <div className="h-16 border-b border-slate-200 bg-white flex items-center px-6 shrink-0">
                <h1 className="font-semibold text-lg text-slate-800">Campaigns</h1>
            </div>
            <div className="flex-1 p-6 overflow-auto">
                <div className="max-w-4xl mx-auto">
                    {/* Add campaigns list/table here */}
                </div>
            </div>
        </div>
    );
}
