'use strict';
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ListChecks, Clock } from 'lucide-react';
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
    const load = async () => {
      try {
        setLoadingStages(true);
        const res = await getLeadStages(teamId);
        if (res && Array.isArray(res.stages)) {
          setLeadStages(res.stages);
          setStagesError(null);
        } else {
          setLeadStages([]);
          setStagesError('Failed to load lead stages');
        }
      } catch (err) {
        setStagesError('Failed to load lead stages');
      } finally {
        setLoadingStages(false);
      }
    };
    load();
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;
    const load = async () => {
      try {
        setLoadingHours(true);
        const res = await getWorkingHours(teamId);
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
      } catch (err) {
        setHoursError('Failed to load working hours');
      } finally {
        setLoadingHours(false);
      }
    };
    load();
  }, [teamId]);

  const handleAddStage = async () => {
    if (!teamId) return;
    try {
      const name = `Stage ${leadStages.length + 1}`;
      const created = await createLeadStage({ name });
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

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleSaveHours}
                disabled={savingHours || loadingHours}
              >
                {savingHours ? 'Saving...' : 'Save Working Hours'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
