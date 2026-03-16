'use strict';
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { ListChecks, Clock, MessageSquare, Facebook, CheckCircle2, AlertCircle } from 'lucide-react';
import { getLeadStages, createLeadStage, updateLeadStage, deleteLeadStage, getWorkingHours, saveWorkingHours, getWhatsAppSettings, updateWhatsAppSettings, onboardWhatsApp } from '../api';

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
  const [addingStage, setAddingStage] = useState(false);
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#0f172a');
  const [newStageClosed, setNewStageClosed] = useState(false);

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

  const [whatsappSettings, setWhatsappSettings] = useState({
    phone_number_id: '',
    business_account_id: '',
    permanent_token: '',
    display_phone_number: '',
    is_active: false
  });
  const [allWhatsappSettings, setAllWhatsappSettings] = useState([]);
  const [discoveredPhones, setDiscoveredPhones] = useState([]);
  const [isPhoneSelectModalOpen, setIsPhoneSelectModalOpen] = useState(false);
  const [discoveredWabaId, setDiscoveredWabaId] = useState('');
  const [discoveredToken, setDiscoveredToken] = useState('');
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(false);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [whatsappError, setWhatsappError] = useState(null);

  useEffect(() => {
    if (!teamId) return;
    const load = async () => {
      try {
        setLoadingWhatsapp(true);
        const res = await getWhatsAppSettings(teamId);
        if (res) {
          if (res.settings) {
            setWhatsappSettings(res.settings);
          }
          if (res.allSettings) {
            setAllWhatsappSettings(res.allSettings);
          }
        }
      } catch (err) {
        console.error('Failed to load WhatsApp settings:', err);
      } finally {
        setLoadingWhatsapp(false);
      }
    };
    load();
  }, [teamId]);

  const handleSaveWhatsApp = async () => {
    if (!teamId) return;
    try {
      setSavingWhatsapp(true);
      setWhatsappError(null);
      await updateWhatsAppSettings(whatsappSettings, teamId);
      alert('WhatsApp settings saved successfully!');
    } catch (err) {
      setWhatsappError('Failed to save WhatsApp settings');
    } finally {
      setSavingWhatsapp(false);
    }
  };

  // Meta SDK & Onboarding
  const [sdkLoaded, setSdkLoaded] = useState(false);
  useEffect(() => {
    window.fbAsyncInit = function() {
      window.FB.init({
        appId      : '321531509460250', // Ideally from config/env
        cookie     : true,
        xfbml      : true,
        version    : 'v21.0'
      });
      setSdkLoaded(true);
    };

    (function(d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s); js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
  }, []);

  const handleConnectWhatsApp = () => {
    if (!window.FB) {
      alert('Facebook SDK not loaded yet. Please wait a moment.');
      return;
    }

    setLoadingWhatsapp(true);
    window.FB.login((response) => {
      if (response.authResponse) {
        const accessToken = response.authResponse.accessToken;
        onboardWhatsApp(accessToken, teamId)
          .then(res => {
            if (res.success) {
              if (res.data.phones && res.data.phones.length > 1) {
                // Multiple phones found, show selection modal
                setDiscoveredPhones(res.data.phones);
                setDiscoveredWabaId(res.data.businessAccountId);
                setDiscoveredToken(res.data.accessToken);
                setIsPhoneSelectModalOpen(true);
              } else if (res.data.phones && res.data.phones.length === 1) {
                // One phone found, it was already auto-saved by backend
                const phone = res.data.phones[0];
                const newSetting = {
                  phone_number_id: phone.id,
                  business_account_id: res.data.businessAccountId,
                  display_phone_number: phone.displayPhoneNumber,
                  permanent_token: accessToken,
                  is_active: true
                };
                setWhatsappSettings(newSetting);
                setAllWhatsappSettings(prev => {
                  const filtered = prev.filter(s => s.phone_number_id !== phone.id);
                  return [...filtered, newSetting];
                });
                alert('Successfully connected: ' + (phone.displayPhoneNumber || phone.id));
              } else {
                 setWhatsappError('No phone numbers found in this Business Account');
              }
            } else {
              setWhatsappError(res.error || 'Failed to onboard');
            }
          })
          .catch(err => {
            setWhatsappError('Failed to connect to backend during onboarding');
          })
          .finally(() => setLoadingWhatsapp(false));
      } else {
        setLoadingWhatsapp(false);
        console.log('User cancelled login or did not fully authorize.');
      }
    }, {
      scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management,public_profile'
    });
  };

  const handleSelectPhone = async (phone) => {
    try {
      setLoadingWhatsapp(true);
      const payload = {
        phone_number_id: phone.id,
        business_account_id: discoveredWabaId,
        permanent_token: discoveredToken,
        display_phone_number: phone.displayPhoneNumber,
        is_active: true
      };
      const res = await updateWhatsAppSettings(payload, teamId);
      if (res) {
        setAllWhatsappSettings(prev => {
          const filtered = prev.filter(s => s.phone_number_id !== phone.id);
          return [...filtered, res];
        });
        if (!whatsappSettings.phone_number_id) {
          setWhatsappSettings(res);
        }
        alert('Successfully linked ' + (phone.displayPhoneNumber || phone.id));
      }
    } catch (err) {
      console.error('Failed to link phone:', err);
      alert('Failed to link phone number');
    } finally {
      setLoadingWhatsapp(false);
    }
  };



  const handleCreateStage = async () => {
    if (!newStageName.trim()) {
      setStagesError('Stage name is required');
      return;
    }
    try {
      setAddingStage(true);
      const created = await createLeadStage({
        name: newStageName.trim(),
        color: newStageColor || null,
        is_closed: newStageClosed,
      }, teamId);
      if (created && created.id) {
        setLeadStages((prev) => [...prev, created]);
        setStagesError(null);
        setIsAddStageModalOpen(false);
        setNewStageName('');
        setNewStageColor('#0f172a');
        setNewStageClosed(false);
      } else {
        setStagesError('Failed to add stage');
      }
    } catch (err) {
      setStagesError('Failed to add stage');
    } finally {
      setAddingStage(false);
    }
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

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddStageModalOpen(true)}
              disabled={addingStage}
            >
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
        
        {/* WhatsApp Business Account */}
        <Card className="border-none shadow-sm h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between py-4 pb-2 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-50 rounded-lg">
                <MessageSquare className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-800">WhatsApp Business</CardTitle>
                <div className="text-[11px] text-slate-500 font-normal">Connect your own API credentials</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${whatsappSettings.is_active ? 'bg-green-500' : 'bg-slate-300'}`} />
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                {whatsappSettings.is_active ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col items-center justify-center py-6 text-center space-y-6">
              {!allWhatsappSettings.some(s => s.phone_number_id) ? (
                <>
                  <div className="max-w-xs space-y-2">
                    <p className="text-sm text-slate-600 font-medium">
                      One-click connection to Meta
                    </p>
                    <p className="text-[11px] text-slate-500">
                      We will automatically fetch your Business ID and Phone Number IDs from your Facebook account.
                    </p>
                  </div>
                  <Button
                    onClick={handleConnectWhatsApp}
                    disabled={loadingWhatsapp || !sdkLoaded}
                    className="bg-[#1877F2] hover:bg-[#166fe5] text-white flex items-center gap-3 px-8 h-11 rounded-full shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02]"
                  >
                    {loadingWhatsapp ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Facebook className="w-5 h-5 fill-current" />
                    )}
                    <span className="font-semibold">Connect with Meta</span>
                  </Button>
                  {!sdkLoaded && <p className="text-[10px] text-slate-400">Loading Meta SDK...</p>}
                </>
              ) : (
                <div className="w-full space-y-4">
                  <div className="bg-green-50/50 border border-green-100 rounded-xl p-4 flex flex-col items-stretch gap-3">
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      </div>
                      <div className="text-left flex-1">
                        <h4 className="text-sm font-bold text-slate-800">Accounts Connected</h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                          You have {allWhatsappSettings.length} number(s) linked to this team.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 mt-2">
                      {allWhatsappSettings.map(s => (
                        <div key={s.phone_number_id} className="flex items-center justify-between bg-white border border-green-100 rounded-lg p-2 px-3 shadow-sm">
                          <div className="text-left">
                            <p className="text-xs font-bold text-slate-800">{s.display_phone_number || s.phone_number_id}</p>
                            <p className="text-[10px] text-slate-500">ID: {s.phone_number_id}</p>
                          </div>
                          <div className={`text-[10px] px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {s.is_active ? 'Active' : 'Paused'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      onClick={handleConnectWhatsApp}
                      className="text-slate-500 text-xs border-slate-200 h-8 px-4 w-full"
                    >
                      Connect more numbers
                    </Button>
                  </div>
                </div>
              )}
              
              {whatsappError && (
                <div className="flex items-center gap-2 text-red-500 text-xs mt-2 bg-red-50 px-3 py-2 rounded-md border border-red-100 italic">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {whatsappError}
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t border-slate-50 flex items-center justify-between mt-auto">
              <div>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-green-600 focus:ring-green-500/20"
                    checked={whatsappSettings.is_active}
                    onChange={(e) => setWhatsappSettings(prev => ({ ...prev, is_active: e.target.checked }))}
                  />
                  <span className="text-[11px] font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Active Integration</span>
                </label>
              </div>
              <Button
                onClick={handleSaveWhatsApp}
                disabled={savingWhatsapp || loadingWhatsapp || !whatsappSettings.phone_number_id}
                className="bg-slate-900 hover:bg-black text-white h-9 px-6 text-xs font-semibold rounded-lg"
              >
                {savingWhatsapp ? 'Saving...' : 'Save Configuration'}
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

      <Modal
        isOpen={isAddStageModalOpen}
        onClose={() => setIsAddStageModalOpen(false)}
        title="Add Lead Stage"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Stage Name</label>
            <Input
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              className="h-9 text-sm"
              placeholder="e.g. New, Contacted, Enrolled"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Color</label>
            <input
              type="color"
              className="h-8 w-14 p-0 border border-slate-200 rounded"
              value={newStageColor}
              onChange={(e) => setNewStageColor(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={newStageClosed}
              onChange={(e) => setNewStageClosed(e.target.checked)}
            />
            Closed stage
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsAddStageModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateStage}
              disabled={addingStage || !newStageName.trim()}
            >
              {addingStage ? 'Adding...' : 'Add Stage'}
            </Button>
          </div>
        </div>
      </Modal>


      <Modal
        isOpen={isPhoneSelectModalOpen}
        onClose={() => setIsPhoneSelectModalOpen(false)}
        title="Select WhatsApp Numbers"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Multiple phone numbers found in your Business Account. Select the ones you want to link to this team.
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-100 rounded-lg p-2">
            {discoveredPhones.map(phone => {
              const alreadyLinked = allWhatsappSettings.some(s => s.phone_number_id === phone.id);
              return (
                <div key={phone.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors">
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-800">{phone.displayPhoneNumber || phone.id}</p>
                    {phone.verifiedName && <p className="text-[10px] text-slate-500">{phone.verifiedName}</p>}
                    <p className="text-[9px] text-slate-400">ID: {phone.id}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={alreadyLinked ? "ghost" : "primary"}
                    disabled={alreadyLinked || loadingWhatsapp}
                    onClick={() => handleSelectPhone(phone)}
                  >
                    {alreadyLinked ? 'Linked' : 'Link Number'}
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setIsPhoneSelectModalOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
