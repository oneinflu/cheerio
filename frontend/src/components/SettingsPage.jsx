'use strict';
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { Plug, Shield, Bell, Webhook, Instagram, Zap, Hash } from 'lucide-react';
import { getInstagramAutoDmConfig, saveInstagramAutoDmConfig } from '../api';

export default function SettingsPage() {
  const [autoAssign, setAutoAssign] = useState(true);
  const [slaAlerts, setSlaAlerts] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('https://example.com/webhooks/meta');
  const [isInstagramModalOpen, setIsInstagramModalOpen] = useState(false);
  const [instagramTab, setInstagramTab] = useState('stories');
  const [instagramConfig, setInstagramConfig] = useState({
    stories: {
      enabled: true,
      triggerType: 'any',
      keywords: '',
      message: 'Thanks for replying to our story. We will DM you with more details shortly.'
    },
    posts: {
      enabled: true,
      triggerType: 'any',
      keywords: '',
      message: 'Thanks for engaging with our post. We will DM you with more details shortly.'
    }
  });

  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        const res = await getInstagramAutoDmConfig();
        if (!isMounted || !res || !res.rules) return;
        setInstagramConfig({
          stories: {
            enabled: Boolean(res.rules.stories?.enabled),
            triggerType: res.rules.stories?.triggerType || 'any',
            keywords: res.rules.stories?.keywords || '',
            message:
              res.rules.stories?.message ||
              'Thanks for replying to our story. We will DM you with more details shortly.'
          },
          posts: {
            enabled: Boolean(res.rules.posts?.enabled),
            triggerType: res.rules.posts?.triggerType || 'any',
            keywords: res.rules.posts?.keywords || '',
            message:
              res.rules.posts?.message ||
              'Thanks for engaging with our post. We will DM you with more details shortly.'
          }
        });
      } catch (err) {
        console.error('Failed to load Instagram auto DM config:', err);
      }
    }
    loadConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  const updateInstagramConfig = (tab, partial) => {
    setInstagramConfig((prev) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        ...partial
      }
    }));
  };

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
              <Button
                className="w-full h-8 text-xs"
                variant="outline"
                onClick={() => setIsInstagramModalOpen(true)}
              >
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

      <Modal
        isOpen={isInstagramModalOpen}
        onClose={() => setIsInstagramModalOpen(false)}
        title="Instagram Auto DM"
        className="max-w-2xl"
      >
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-pink-500 to-purple-500 flex items-center justify-center text-white">
              <Instagram size={16} />
            </div>
            <div>
              <div className="font-medium text-slate-900">Automate Instagram replies</div>
              <div className="text-xs text-slate-500">
                Define how DMs should be sent when someone interacts with your stories or posts.
              </div>
            </div>
          </div>

          <div className="flex gap-2 rounded-lg bg-slate-100 p-1 text-xs font-medium">
            <button
              type="button"
              className={
                instagramTab === 'stories'
                  ? 'flex-1 inline-flex items-center justify-center px-3 py-1 rounded-md bg-white shadow-sm text-slate-900'
                  : 'flex-1 inline-flex items-center justify-center px-3 py-1 rounded-md text-slate-600 hover:bg-slate-200'
              }
              onClick={() => setInstagramTab('stories')}
            >
              <Zap size={12} className="mr-1.5" />
              Stories
            </button>
            <button
              type="button"
              className={
                instagramTab === 'posts'
                  ? 'flex-1 inline-flex items-center justify-center px-3 py-1 rounded-md bg-white shadow-sm text-slate-900'
                  : 'flex-1 inline-flex items-center justify-center px-3 py-1 rounded-md text-slate-600 hover:bg-slate-200'
              }
              onClick={() => setInstagramTab('posts')}
            >
              <Hash size={12} className="mr-1.5" />
              Posts
            </button>
          </div>

          {(() => {
            const current = instagramConfig[instagramTab];
            const isStories = instagramTab === 'stories';
            const triggerLabel = isStories ? 'When someone replies to a story' : 'When someone comments on a post';
            const anyLabel = isStories ? 'Any story reply' : 'Any post comment';
            const keywordPlaceholder = isStories ? 'e.g. brochure, price, details' : 'e.g. offer, enroll, info';
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{triggerLabel}</div>
                    <div className="text-xs text-slate-500">
                      Choose when to send an automatic DM.
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs">
                    <span className="text-slate-600">Enable auto DM</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={current.enabled}
                      onChange={(e) =>
                        updateInstagramConfig(instagramTab, { enabled: e.target.checked })
                      }
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-600">Trigger rule</div>
                  <select
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                    value={current.triggerType}
                    onChange={(e) =>
                      updateInstagramConfig(instagramTab, { triggerType: e.target.value })
                    }
                  >
                    <option value="any">{anyLabel}</option>
                    <option value="keyword">Only when message contains specific keywords</option>
                  </select>
                </div>

                {current.triggerType === 'keyword' && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-600">Match keywords</div>
                    <Input
                      placeholder={keywordPlaceholder}
                      value={current.keywords}
                      onChange={(e) =>
                        updateInstagramConfig(instagramTab, { keywords: e.target.value })
                      }
                    />
                    <div className="text-[11px] text-slate-400">
                      Separate multiple keywords with commas.
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-slate-600">DM message</div>
                    <div className="text-[10px] text-slate-400">
                      You can use placeholders like {'{{name}}'} later at API level.
                    </div>
                  </div>
                  <textarea
                    className="flex min-h-[90px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                    value={current.message}
                    onChange={(e) =>
                      updateInstagramConfig(instagramTab, { message: e.target.value })
                    }
                  />
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-2">
                  <div className="font-medium text-slate-800">Preview</div>
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-pink-500 to-purple-500 flex items-center justify-center text-white text-xs">
                      IG
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">
                        Auto DM reply
                      </div>
                      <div className="text-sm text-slate-800 whitespace-pre-wrap">
                        {current.message || 'Your automated reply will appear here.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setInstagramConfig({
                  stories: {
                    enabled: true,
                    triggerType: 'any',
                    keywords: '',
                    message:
                      'Thanks for replying to our story. We will DM you with more details shortly.'
                  },
                  posts: {
                    enabled: true,
                    triggerType: 'any',
                    keywords: '',
                    message:
                      'Thanks for engaging with our post. We will DM you with more details shortly.'
                  }
                })
              }
            >
              Reset to defaults
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsInstagramModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  try {
                    await saveInstagramAutoDmConfig({ rules: instagramConfig });
                  } catch (err) {
                    console.error('Failed to save Instagram auto DM config:', err);
                  }
                  setIsInstagramModalOpen(false);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
