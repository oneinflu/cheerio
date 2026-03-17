import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { MessageSquare, Facebook, CheckCircle2, AlertCircle, Trash2, ArrowLeft, Instagram, Send, Puzzle } from 'lucide-react';
import { getWhatsAppSettings, updateWhatsAppSettings, onboardWhatsApp, disconnectWhatsApp, getTelegramSettings, connectTelegram, disconnectTelegram } from '../api';

export default function SettingsPage({ currentUser }) {
  const teamId = useMemo(() => {
    if (!currentUser) return null;
    const ids = currentUser.teamIds || [];
    if (ids.length > 0) return ids[0];
    return null;
  }, [currentUser]);

  const [activeIntegration, setActiveIntegration] = useState(null); // 'whatsapp', 'telegram', 'instagram'

  // --- WhatsApp State ---
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

  // --- Telegram State ---
  const [telegramSettings, setTelegramSettings] = useState([]);
  const [loadingTelegram, setLoadingTelegram] = useState(false);
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [telegramError, setTelegramError] = useState(null);
  const [botTokenInput, setBotTokenInput] = useState('');
  const [botDisplayName, setBotDisplayName] = useState('');

  // --- Meta SDK & Onboarding ---
  const [sdkLoaded, setSdkLoaded] = useState(false);
  useEffect(() => {
    window.fbAsyncInit = function() {
      window.FB.init({
        appId      : '321531509460250', 
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

  // Load WhatsApp Settings
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

  // Load Telegram settings
  useEffect(() => {
    if (!teamId) return;
    const load = async () => {
      try {
        setLoadingTelegram(true);
        const res = await getTelegramSettings(teamId);
        if (res && res.settings) {
          setTelegramSettings(res.settings);
        }
      } catch (err) {
        console.error('Failed to load Telegram settings:', err);
      } finally {
        setLoadingTelegram(false);
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
                setDiscoveredPhones(res.data.phones);
                setDiscoveredWabaId(res.data.businessAccountId);
                setDiscoveredToken(res.data.accessToken);
                setIsPhoneSelectModalOpen(true);
              } else if (res.data.phones && res.data.phones.length === 1) {
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

  const handleDisconnectWhatsApp = async (phoneNumberId) => {
    if (!window.confirm('Are you sure you want to disconnect this WhatsApp number? This will stop receiving messages from it.')) return;
    try {
      setLoadingWhatsapp(true);
      const res = await disconnectWhatsApp(phoneNumberId, teamId);
      if (res.success) {
        setAllWhatsappSettings(prev => prev.filter(s => s.phone_number_id !== phoneNumberId));
        if (whatsappSettings.phone_number_id === phoneNumberId) {
          setWhatsappSettings({
            phone_number_id: '',
            business_account_id: '',
            permanent_token: '',
            display_phone_number: '',
            is_active: false
          });
        }
        alert('WhatsApp number disconnected successfully!');
      }
    } catch (err) {
      console.error('Failed to disconnect WhatsApp:', err);
      alert('Failed to disconnect WhatsApp number');
    } finally {
      setLoadingWhatsapp(false);
    }
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


  const handleConnectTelegram = async () => {
    if (!botTokenInput) {
      setTelegramError('Bot token is required');
      return;
    }
    try {
      setSavingTelegram(true);
      setTelegramError(null);
      const res = await connectTelegram(botTokenInput, botDisplayName || 'Telegram Bot', teamId);
      if (res.success) {
        setBotTokenInput('');
        setBotDisplayName('');
        const updated = await getTelegramSettings(teamId);
        if (updated && updated.settings) {
          setTelegramSettings(updated.settings);
        }
        alert('Telegram bot connected successfully!');
      } else {
        setTelegramError(res.error || 'Failed to connect bot');
      }
    } catch (err) {
      setTelegramError('Failed to connect Telegram bot');
    } finally {
      setSavingTelegram(false);
    }
  };

  const handleDisconnectTelegram = async (botToken) => {
    if (!window.confirm('Are you sure you want to disconnect this Telegram bot?')) return;
    try {
      setSavingTelegram(true);
      const res = await disconnectTelegram(botToken, teamId);
      if (res.success) {
        const updated = await getTelegramSettings(teamId);
        if (updated && updated.settings) {
          setTelegramSettings(updated.settings);
        }
        alert('Telegram bot disconnected successfully!');
      }
    } catch (err) {
      setTelegramError('Failed to disconnect Telegram bot');
    } finally {
      setSavingTelegram(false);
    }
  };


  const renderOverview = () => (
    <div className="p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* WhatsApp Card */}
        <Card 
          className="group cursor-pointer hover:shadow-md transition-all duration-300 border-slate-200 hover:border-green-300 relative overflow-hidden flex flex-col"
          onClick={() => setActiveIntegration('whatsapp')}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-bl-full -z-10 transition-transform group-hover:scale-110" />
          <CardContent className="p-6 flex-1 flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">WhatsApp Business</h3>
            <p className="text-sm text-slate-500 flex-1">
              Connect multiple WhatsApp numbers via Meta API.
            </p>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className={cn(
                "text-xs font-semibold px-2.5 py-1 rounded-full",
                allWhatsappSettings.length > 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
              )}>
                {allWhatsappSettings.length > 0 ? `${allWhatsappSettings.length} Connected` : 'Not connected'}
              </span>
              <Button variant="ghost" size="sm" className="text-slate-400 group-hover:text-green-600 -mr-2">
                Configure <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Telegram Card */}
        <Card 
          className="group cursor-pointer hover:shadow-md transition-all duration-300 border-slate-200 hover:border-blue-300 relative overflow-hidden flex flex-col"
          onClick={() => setActiveIntegration('telegram')}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full -z-10 transition-transform group-hover:scale-110" />
          <CardContent className="p-6 flex-1 flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
              <Send className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Telegram Bot</h3>
            <p className="text-sm text-slate-500 flex-1">
              Sync messages from Telegram bots seamlessly.
            </p>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
               <span className={cn(
                "text-xs font-semibold px-2.5 py-1 rounded-full",
                telegramSettings.length > 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
              )}>
                {telegramSettings.length > 0 ? `${telegramSettings.length} Connected` : 'Not connected'}
              </span>
              <Button variant="ghost" size="sm" className="text-slate-400 group-hover:text-blue-600 -mr-2">
                Configure <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instagram Card */}
        <Card 
          className="group cursor-pointer hover:shadow-md transition-all duration-300 border-slate-200 hover:border-pink-300 relative overflow-hidden flex flex-col"
          onClick={() => setActiveIntegration('instagram')}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-bl-full -z-10 transition-transform group-hover:scale-110" />
          <CardContent className="p-6 flex-1 flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 flex items-center justify-center mb-4">
              <Instagram className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Instagram DMs</h3>
            <p className="text-sm text-slate-500 flex-1">
              Manage Instagram Direct Messages directly alongside your other channels.
            </p>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
               <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                Not connected
              </span>
              <Button variant="ghost" size="sm" className="text-slate-400 group-hover:text-pink-600 -mr-2">
                Configure <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );

  const renderWhatsAppDetail = () => (
    <div className="p-8 max-w-4xl mx-auto">
      <Button 
        variant="ghost" 
        size="sm" 
        className="mb-6 text-slate-500 hover:text-slate-900 -ml-2"
        onClick={() => setActiveIntegration(null)}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Integrations
      </Button>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-green-400 p-8 text-white relative">
          <MessageSquare className="w-32 h-32 absolute -right-6 -bottom-6 text-white/10" />
          <h2 className="text-2xl font-bold mb-2 relative z-10">WhatsApp Business Integration</h2>
          <p className="text-green-50 max-w-xl relative z-10">Connect your WhatsApp Business API accounts to start answering customer inquiries directly from the unified inbox.</p>
        </div>
        
        <CardContent className="p-8 flex-1 flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center py-6 text-center space-y-6">
            {!allWhatsappSettings.some(s => s.phone_number_id) ? (
              <>
                <div className="max-w-xs space-y-2">
                  <p className="text-base text-slate-800 font-semibold">
                    One-click connection to Meta
                  </p>
                  <p className="text-sm text-slate-500">
                    We will automatically fetch your Business ID and Phone Number IDs from your Facebook account.
                  </p>
                </div>
                <Button
                  onClick={handleConnectWhatsApp}
                  disabled={loadingWhatsapp || !sdkLoaded}
                  className="bg-[#1877F2] hover:bg-[#166fe5] text-white flex items-center gap-3 px-8 h-12 rounded-full shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] text-sm"
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
              <div className="w-full space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex flex-col items-stretch gap-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 bg-green-100 p-1.5 rounded-full">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-left flex-1">
                      <h4 className="text-base font-bold text-slate-900">Accounts Connected</h4>
                      <p className="text-sm text-slate-600 mt-1">
                        You have {allWhatsappSettings.length} number(s) linked to this team.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 mt-4">
                    {allWhatsappSettings.map(s => (
                      <div 
                        key={s.phone_number_id} 
                        className={cn(
                          "flex items-center justify-between border rounded-xl p-4 shadow-sm cursor-pointer transition-all duration-200",
                          whatsappSettings.phone_number_id === s.phone_number_id 
                            ? "bg-white border-green-400 ring-4 ring-green-100/50 shadow-md" 
                            : "bg-white/60 border-slate-200 hover:border-green-300 hover:bg-white"
                        )}
                        onClick={() => setWhatsappSettings(s)}
                      >
                        <div className="text-left">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-slate-900">{s.display_phone_number || s.phone_number_id}</p>
                            {s.is_active && <div className="h-2 w-2 rounded-full bg-green-500 shadow-sm shadow-green-200" />}
                          </div>
                          <p className="text-xs text-slate-500 font-mono">ID: {s.phone_number_id}</p>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "text-xs px-3 py-1.5 rounded-full font-semibold uppercase tracking-wider",
                            s.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                          )}>
                            {s.is_active ? 'Active' : 'Paused'}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDisconnectWhatsApp(s.phone_number_id);
                            }}
                            title="Delete number"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={handleConnectWhatsApp}
                    className="text-slate-600 font-medium border-slate-300 h-10 px-6 rounded-full hover:bg-slate-50"
                  >
                    + Connect another number
                  </Button>
                </div>
              </div>
            )}
            
            {whatsappError && (
              <div className="flex items-center gap-2 text-red-600 text-sm mt-4 bg-red-50 p-4 rounded-xl border border-red-100 w-full text-left">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{whatsappError}</span>
              </div>
            )}
          </div>
          
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between mt-auto">
            <div>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-green-600 focus:ring-green-500 h-5 w-5"
                  checked={whatsappSettings.is_active}
                  onChange={(e) => setWhatsappSettings(prev => ({ ...prev, is_active: e.target.checked }))}
                />
                <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">Route messages to inbox</span>
              </label>
            </div>
            <Button
              onClick={handleSaveWhatsApp}
              disabled={savingWhatsapp || loadingWhatsapp || !whatsappSettings.phone_number_id}
              className="bg-slate-900 hover:bg-black text-white h-11 px-8 text-sm font-semibold rounded-full shadow-md"
            >
              {savingWhatsapp ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTelegramDetail = () => (
    <div className="p-8 max-w-4xl mx-auto">
      <Button 
        variant="ghost" 
        size="sm" 
        className="mb-6 text-slate-500 hover:text-slate-900 -ml-2"
        onClick={() => setActiveIntegration(null)}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Integrations
      </Button>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-400 p-8 text-white relative">
          <Send className="w-32 h-32 absolute -right-6 -bottom-6 text-white/10" />
          <h2 className="text-2xl font-bold mb-2 relative z-10">Telegram Bot Integration</h2>
          <p className="text-blue-50 max-w-xl relative z-10">Link your Telegram bots to send and receive messages directly inside your shared dashboard.</p>
        </div>
        
        <CardContent className="p-8 flex-1 flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center py-6 space-y-8">
            {telegramSettings.length === 0 ? (
              <div className="w-full max-w-md space-y-6">
                <div className="text-center space-y-2 mb-6">
                  <p className="text-lg text-slate-800 font-bold">
                    Connect your Telegram bot
                  </p>
                  <p className="text-sm text-slate-500">
                    Create a bot with <a href="https://t.me/botfather" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">@BotFather</a> on Telegram and paste the token here to start receiving messages.
                  </p>
                </div>
                
                {telegramError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-4 rounded-xl border border-red-100 w-full text-left">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{telegramError}</span>
                  </div>
                )}

                <div className="w-full space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Bot Token <span className="text-red-500">*</span></label>
                    <Input
                      type="password"
                      placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                      value={botTokenInput}
                      onChange={(e) => setBotTokenInput(e.target.value)}
                      className="h-11 text-base bg-slate-50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Display Name (Optional)</label>
                    <Input
                      placeholder="My Telegram Bot"
                      value={botDisplayName}
                      onChange={(e) => setBotDisplayName(e.target.value)}
                      className="h-11 text-base bg-slate-50"
                    />
                  </div>

                  <Button
                    onClick={handleConnectTelegram}
                    disabled={savingTelegram || !botTokenInput}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-full font-bold text-base mt-4 shadow-lg shadow-blue-500/20"
                  >
                    {savingTelegram ? 'Connecting...' : 'Connect Telegram Bot'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 flex flex-col items-stretch gap-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 bg-blue-100 p-1.5 rounded-full">
                      <CheckCircle2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-left flex-1">
                      <h4 className="text-base font-bold text-slate-900">Bots Connected</h4>
                      <p className="text-sm text-slate-600 mt-1">
                        You have {telegramSettings.length} bot(s) linked to this team.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 mt-4">
                    {telegramSettings.map((bot) => (
                      <div key={bot.id} className="flex items-center justify-between bg-white border border-blue-100 rounded-xl p-4 shadow-sm hover:border-blue-300 transition-colors">
                        <div className="text-left">
                          <p className="text-base font-bold text-slate-900">@{bot.bot_username}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{bot.display_name}</p>
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => handleDisconnectTelegram(bot.bot_token)}
                          disabled={savingTelegram}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 h-9 font-medium rounded-lg"
                        >
                          Disconnect
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-center pt-2 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setBotTokenInput('');
                      setBotDisplayName('');
                      setTelegramError(null);
                      setTelegramSettings([]); // Temporary clear to show form, backend will fix on reload
                    }}
                    className="text-slate-600 font-medium border-slate-300 h-10 px-6 rounded-full hover:bg-slate-50"
                  >
                    + Connect another bot
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderInstagramDetail = () => (
    <div className="p-8 max-w-4xl mx-auto">
      <Button 
        variant="ghost" 
        size="sm" 
        className="mb-6 text-slate-500 hover:text-slate-900 -ml-2"
        onClick={() => setActiveIntegration(null)}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Integrations
      </Button>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-8 text-white relative">
          <Instagram className="w-32 h-32 absolute -right-6 -bottom-6 text-white/10" />
          <h2 className="text-2xl font-bold mb-2 relative z-10">Instagram Integration</h2>
          <p className="text-white/90 max-w-xl relative z-10">Configure your Instagram API access to start managing DMs natively here.</p>
        </div>
        
        <CardContent className="p-16 flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Puzzle className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Coming Soon</h3>
            <p className="text-slate-500 max-w-sm">We are finalizing the Meta API approvals for automatic Instagram connection. Sit tight!</p>
            <Button disabled className="mt-8 rounded-full h-11 px-8">Connect Instagram</Button>
        </CardContent>
      </Card>
    </div>
  );


  // Add a small arrow right icon
  const ArrowRight = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"></path>
      <path d="m12 5 7 7-7 7"></path>
    </svg>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50">
      <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Integrations</h1>
            <p className="text-sm text-slate-500 mt-1">
              Connect external channels and bots to your shared workspace.
            </p>
          </div>
        </div>
      </div>

      {activeIntegration === null && renderOverview()}
      {activeIntegration === 'whatsapp' && renderWhatsAppDetail()}
      {activeIntegration === 'telegram' && renderTelegramDetail()}
      {activeIntegration === 'instagram' && renderInstagramDetail()}

      {/* Re-using the identical Phone Select Modal for WhatsApp */}
      <Modal
        isOpen={isPhoneSelectModalOpen}
        onClose={() => setIsPhoneSelectModalOpen(false)}
        title="Select WhatsApp Numbers"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Multiple phone numbers found in your Business Account. Select the ones you want to link.
          </p>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {discoveredPhones.map(phone => {
              const alreadyLinked = allWhatsappSettings.some(s => s.phone_number_id === phone.id);
              return (
                <div key={phone.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-green-300 hover:shadow-sm transition-all">
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-800">{phone.displayPhoneNumber || phone.id}</p>
                    {phone.verifiedName && <p className="text-xs text-slate-500 mt-0.5">{phone.verifiedName}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant={alreadyLinked ? "secondary" : "default"}
                    disabled={alreadyLinked || loadingWhatsapp}
                    onClick={() => handleSelectPhone(phone)}
                    className="rounded-full"
                  >
                    {alreadyLinked ? 'Linked' : 'Link Number'}
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button onClick={() => setIsPhoneSelectModalOpen(false)} variant="outline" className="rounded-full">Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
