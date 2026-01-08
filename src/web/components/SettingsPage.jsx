'use strict';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Plug, Shield, Bell, Webhook } from 'lucide-react';

export default function SettingsPage() {
  const [autoAssign, setAutoAssign] = useState(true);
  const [slaAlerts, setSlaAlerts] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('https://example.com/webhooks/meta');

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="border-b border-slate-200 bg-white">
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
            <p className="text-sm text-slate-500">Demo configuration panel</p>
          </div>
          <Badge variant="outline">Not connected to Meta</Badge>
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-slate-500" />
              Channels
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* WhatsApp */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">WhatsApp</div>
                  <div className="text-xs text-slate-500">Demo Channel</div>
                </div>
                <Badge variant="secondary">Active</Badge>
              </div>
              <div className="text-xs text-slate-500">
                Phone number: +1 (555) 999-9999
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Instagram */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">Instagram</div>
                  <div className="text-xs text-slate-500">Demo Account</div>
                </div>
                <Badge variant="secondary">Active</Badge>
              </div>
              <div className="text-xs text-slate-500">
                Account: @demo_instagram
              </div>
              <Button className="w-full h-8 text-xs" variant="outline">
                Configure Instagram
              </Button>
            </div>
            
            <div className="h-px bg-slate-100" />
            
            <Button className="w-full" variant="outline" disabled>
              Connect Meta Account
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-500" />
              Assignment Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-900">Auto-assign new conversations</div>
                <div className="text-xs text-slate-500">Demo toggle</div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={autoAssign}
                onChange={(e) => setAutoAssign(e.target.checked)}
              />
            </label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              When enabled, new inbound messages can be auto-assigned to an available agent.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-500" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-900">SLA breach alerts</div>
                <div className="text-xs text-slate-500">Demo toggle</div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={slaAlerts}
                onChange={(e) => setSlaAlerts(e.target.checked)}
              />
            </label>
            <Button className="w-full" variant="secondary">
              Save Alerts
            </Button>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-slate-500" />
              Webhook
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                <div className="text-xs font-medium text-slate-500 mb-1">Webhook URL</div>
                <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
              </div>
              <Button variant="outline">Update</Button>
            </div>
            <div className="text-xs text-slate-500">
              Demo only. In production this must match your Meta Webhook configuration.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

