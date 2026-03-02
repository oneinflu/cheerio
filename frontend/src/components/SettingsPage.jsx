'use strict';
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { ListChecks, Clock, Instagram, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { getLeadStages, createLeadStage, updateLeadStage, deleteLeadStage, getWorkingHours, saveWorkingHours } from '../api';

export default function SettingsPage({ currentUser }) {
  const teamId = useMemo(() => {
    if (!currentUser) return null;
    const ids = currentUser.teamIds || [];
    if (ids.length > 0) return ids[0];
    return null;
  }, [currentUser]);

  const [leadStages, setLeadStages] = useState([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [stagesError, setStagesError] = useState(null);
  const [savingStageId, setSavingStageId] = useState(null);

  // Instagram States
  const [isInstaConnected, setIsInstaConnected] = useState(false);
  const [instaAccountName, setInstaAccountName] = useState(null);
  const [loadingInsta, setLoadingInsta] = useState(false);
  const instagramAuthUrl = "https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=1115102437313127&redirect_uri=https://inbox.xolox.io/api/auth/instagram/callback&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights";

  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [workingHours, setWorkingHours] = useState({
    mon: { closed: false, open: '09:00', close: '18:00' },
    tue: { closed: false, open: '09:00', close: '18:00' },
    wed: { closed: false, open: '09:00', close: '18:00' },
    thu: { closed: false, open: '09:00', close: '18:00' },
    fri: { closed: false, open: '09:00', close: '18:00' },
    sat: { closed: true, open: '09:00', close: '18:00' },
    sun: { closed: true, open: '09:00', close: '18:00' },
  });
  const [loadingHours, setLoadingHours] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursError, setHoursError] = useState(null);
  const [isHoursModalOpen, setIsHoursModalOpen] = useState(false);

  const dayLabels = {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday',
  };

  useEffect(() => {
    if (!teamId) return;
    
    // Fetch Lead Stages
    setLoadingStages(true);
    getLeadStages(teamId)
      .then(res => {
        if (res && Array.isArray(res.stages)) {
          setLeadStages(res.stages);
          setStagesError(null);
        } else {
          setLeadStages([]);
          setStagesError('Failed to load lead stages');
        }
      })
      .catch(err => setStagesError('Failed to load lead stages'))
      .finally(() => setLoadingStages(false));

    // Fetch Working Hours
    setLoadingHours(true);
    getWorkingHours(teamId)
      .then(res => {
        if (res && res.hours) {
          setTimezone(res.timezone || 'Asia/Kolkata');
          setWorkingHours({
            mon: { closed: false, open: '09:00', close: '18:00' },
            tue: { closed: false, open: '09:00', close: '18:00' },
            wed: { closed: false, open: '09:00', close: '18:00' },
            thu: { closed: false, open: '09:00', close: '18:00' },
            fri: { closed: false, open: '09:00', close: '18:00' },
            sat: { closed: true, open: '09:00', close: '18:00' },
            sun: { closed: true, open: '09:00', close: '18:00' },
            ...res.hours,
          });
          setHoursError(null);
        } else {
          setHoursError('Failed to load working hours');
        }
      })
      .catch(err => setHoursError('Failed to load working hours'))
      .finally(() => setLoadingHours(false));

    // Check Instagram Status
    checkInstagramStatus();

  }, [teamId]);

  const checkInstagramStatus = async () => {
    try {
      setLoadingInsta(true);
      const res = await fetch('/api/auth/instagram/status', {
         headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      const data = await res.json();
      setIsInstaConnected(data.connected);
      if (data.connected && data.channel) {
          setInstaAccountName(data.channel.name);
      } else {
          setInstaAccountName(null);
      }
    } catch (err) {
      console.error('Failed to check instagram status', err);
    } finally {
      setLoadingInsta(false);
    }
  };

  const handleDisconnectInstagram = async () => {
    if(!confirm('Are you sure you want to disconnect Instagram? You will stop receiving messages.')) return;
    try {
      setLoadingInsta(true);
      const res = await fetch('/api/auth/instagram', {
         method: 'DELETE',
         headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if(res.ok) {
        setIsInstaConnected(false);
        setInstaAccountName(null);
      }
    } catch(err) {
      console.error(err);
      alert('Failed to disconnect');
    } finally {
      setLoadingInsta(false);
    }
  };

  const handleAddStage = async () => {
    if (!teamId) return;
    try {
      const name = `Stage ${leadStages.length + 1}`;
      const created = await createLeadStage({ name }, teamId);
      if (created && created.id) {
        setLeadStages((prev) => [...prev, created]);
      }
    } catch (err) {}
  };

  const handleStageChange = (id, field, value) => {
    setLeadStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleStageBlur = async (stage) => {
    if (!teamId) return;
    setSavingStageId(stage.id);
    try {
      await updateLeadStage(stage.id, {
        name: stage.name,
        color: stage.color,
        is_closed: stage.is_closed,
      }, teamId);
    } catch (err) {
    } finally {
      setSavingStageId(null);
    }
  };

  const handleDeleteStage = async (id) => {
    if (!teamId) return;
    if (!window.confirm('Delete this stage?')) return;
    try {
      await deleteLeadStage(id, teamId);
      setLeadStages((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {}
  };

  const handleHoursChange = (day, field, value) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const handleSaveHours = async () => {
    if (!teamId) return;
    try {
      setSavingHours(true);
      const payload = {
        timezone,
        hours: workingHours,
      };
      const res = await saveWorkingHours(payload, teamId);
      if (res && res.hours) {
        setTimezone(res.timezone || timezone);
        setWorkingHours(res.hours);
        setHoursError(null);
      } else {
        setHoursError('Failed to save working hours');
      }
    } catch (err) {
      setHoursError('Failed to save working hours');
    } finally {
      setSavingHours(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="border-b border-slate-200 bg-white">
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
            <p className="text-sm text-slate-500">
              Configure lead stages and working hours for your team.
            </p>
          </div>
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-pink-600" />
                Instagram Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-900">Connect Business Account</h3>
                  <p className="text-xs text-slate-500 mt-1">Link your Instagram Business account to manage DMs and comments.</p>
                </div>
                <div>
                   {loadingInsta ? (
                     <Button disabled variant="outline" size="sm">Checking...</Button>
                   ) : isInstaConnected ? (
                     <div className="flex items-center gap-3">
                        <div className="text-sm font-medium text-slate-700 bg-slate-100 px-3 py-1.5 rounded-full flex items-center gap-2">
                            <Instagram size={14} className="text-pink-600" />
                            {instaAccountName || 'Connected Account'}
                        </div>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={handleDisconnectInstagram}>
                            Disconnect
                        </Button>
                     </div>
                   ) : (
                     <Button 
                       size="sm"
                       className="bg-[#E1306C] hover:bg-[#C13584] text-white border-0"
                       onClick={() => window.location.href = instagramAuthUrl}
                     >
                       <ExternalLink className="w-3 h-3 mr-2" />
                       Connect
                     </Button>
                   )}
                </div>
              </div>
              {isInstaConnected && (
                 <div className="p-3 bg-green-50 border border-green-100 rounded-md flex items-center gap-2 text-xs text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    <span>Your Instagram account <strong>{instaAccountName}</strong> is connected and active.</span>
                 </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-slate-500" />
              Lead Stages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500">
              Define the stages a lead moves through, like New, Contacted, Enrolled.
            </p>

            {stagesError && (
              <div className="text-xs text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
                {stagesError}
              </div>
            )}

            <div className="space-y-2 max-h-72 overflow-y-auto border border-slate-200 rounded-md">
              {loadingStages && leadStages.length === 0 ? (
                <div className="px-4 py-6 text-xs text-slate-500">Loading stages...</div>
              ) : leadStages.length === 0 ? (
                <div className="px-4 py-6 text-xs text-slate-500">
                  No stages yet. Add your first stage.
                </div>
              ) : (
                leadStages.map((stage) => (
                  <div
                    key={stage.id}
                    className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 last:border-b-0"
                  >
                    <div className="w-2 h-8 rounded-full mr-1" style={{ backgroundColor: stage.color || '#0f172a' }} />
                    <div className="flex-1 flex flex-col gap-1">
                      <Input
                        value={stage.name || ''}
                        onChange={(e) =>
                          handleStageChange(stage.id, 'name', e.target.value)
                        }
                        onBlur={() => handleStageBlur(stage)}
                        placeholder="Stage name"
                        className="h-8 text-xs"
                      />
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          className="h-6 w-10 p-0 border border-slate-200 rounded"
                          value={stage.color || '#0f172a'}
                          onChange={(e) =>
                            handleStageChange(stage.id, 'color', e.target.value)
                          }
                          onBlur={() => handleStageBlur(stage)}
                        />
                        <label className="flex items-center gap-1 text-[11px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={stage.is_closed}
                            onChange={(e) =>
                              handleStageChange(stage.id, 'is_closed', e.target.checked)
                            }
                            onBlur={() => handleStageBlur(stage)}
                          />
                          Closed stage
                        </label>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-600"
                      onClick={() => handleDeleteStage(stage.id)}
                    >
                      ×
                    </Button>
                    {savingStageId === stage.id && (
                      <span className="text-[10px] text-slate-400 ml-1">Saving...</span>
                    )}
                  </div>
                ))
              )}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={handleAddStage}>
              Add Stage
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              Working Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500">
              Set the hours when your team is considered available for leads.
            </p>

            {hoursError && (
              <div className="text-xs text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
                {hoursError}
              </div>
            )}

            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="flex flex-col">
                <span className="font-medium text-slate-700">
                  {timezone || 'Timezone not set'}
                </span>
                <span className="text-[11px] text-slate-500">
                  Configure daily open and close times for your team.
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsHoursModalOpen(true)}
              >
                Set Working Hours
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={isHoursModalOpen}
        onClose={() => setIsHoursModalOpen(false)}
        title="Working Hours"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600">
              Timezone
            </label>
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="h-9 text-sm"
              placeholder="e.g. Asia/Kolkata"
            />
          </div>

          <div className="border border-slate-200 rounded-md overflow-hidden">
            <div className="grid grid-cols-4 text-[11px] font-medium text-slate-500 bg-slate-50 px-3 py-2">
              <div>Day</div>
              <div>Closed</div>
              <div>Open</div>
              <div>Close</div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {Object.keys(dayLabels).map((key) => {
                const cfg = workingHours[key] || {};
                return (
                  <div
                    key={key}
                    className="grid grid-cols-4 items-center text-xs px-3 py-2 border-t border-slate-100"
                  >
                    <div className="text-slate-700">{dayLabels[key]}</div>
                    <div>
                      <input
                        type="checkbox"
                        checked={Boolean(cfg.closed)}
                        onChange={(e) =>
                          handleHoursChange(key, 'closed', e.target.checked)
                        }
                      />
                    </div>
                    <div>
                      <input
                        type="time"
                        className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs"
                        disabled={Boolean(cfg.closed)}
                        value={cfg.open || ''}
                        onChange={(e) =>
                          handleHoursChange(key, 'open', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <input
                        type="time"
                        className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs"
                        disabled={Boolean(cfg.closed)}
                        value={cfg.close || ''}
                        onChange={(e) =>
                          handleHoursChange(key, 'close', e.target.value)
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsHoursModalOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={async () => {
                await handleSaveHours();
                setIsHoursModalOpen(false);
              }}
              disabled={savingHours || loadingHours}
            >
              {savingHours ? 'Saving...' : 'Save Working Hours'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
