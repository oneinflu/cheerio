import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../lib/utils';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { 
  MessageSquare, Facebook, CheckCircle2, AlertCircle, Trash2, 
  ArrowLeft, Instagram, Send, Puzzle, CreditCard, Phone, 
  Database, Zap, Mail, Layout, Smartphone, ChevronRight,
  Globe, ExternalLink, ShieldCheck
} from 'lucide-react';
import { 
  getWhatsAppSettings, updateWhatsAppSettings, onboardWhatsApp, 
  disconnectWhatsApp, getTelegramSettings, connectTelegram, 
  disconnectTelegram 
} from '../api';

export default function SettingsPage({ currentUser }) {
  const teamId = useMemo(() => {
    if (!currentUser) return null;
    const ids = currentUser.teamIds || [];
    if (ids.length > 0) return ids[0];
    return null;
  }, [currentUser]);

  const [activeIntegration, setActiveIntegration] = useState(null);

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
    if (window.FB) {
      setSdkLoaded(true);
      return;
    }
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
          if (res.settings) setWhatsappSettings(res.settings);
          if (res.allSettings) setAllWhatsappSettings(res.allSettings);
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
        if (res && res.settings) setTelegramSettings(res.settings);
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
          .catch(() => setWhatsappError('Failed to connect to backend'))
          .finally(() => setLoadingWhatsapp(false));
      } else {
        setLoadingWhatsapp(false);
      }
    }, { scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management,public_profile' });
  };

  const handleDisconnectWhatsApp = async (phoneNumberId) => {
    if (!window.confirm('Disconnect this number?')) return;
    try {
      setLoadingWhatsapp(true);
      const res = await disconnectWhatsApp(phoneNumberId, teamId);
      if (res.success) {
        setAllWhatsappSettings(prev => prev.filter(s => s.phone_number_id !== phoneNumberId));
        if (whatsappSettings.phone_number_id === phoneNumberId) {
          setWhatsappSettings({ phone_number_id: '', business_account_id: '', permanent_token: '', display_phone_number: '', is_active: false });
        }
      }
    } catch (err) {
      alert('Failed to disconnect');
    } finally {
      setLoadingWhatsapp(false);
    }
  };

  const handleSelectPhone = async (phone) => {
    try {
      setLoadingWhatsapp(true);
      const payload = { phone_number_id: phone.id, business_account_id: discoveredWabaId, permanent_token: discoveredToken, display_phone_number: phone.displayPhoneNumber, is_active: true };
      const res = await updateWhatsAppSettings(payload, teamId);
      if (res) {
        setAllWhatsappSettings(prev => [...prev.filter(s => s.phone_number_id !== phone.id), res]);
        if (!whatsappSettings.phone_number_id) setWhatsappSettings(res);
      }
    } catch (err) {
      alert('Failed to link phone');
    } finally {
      setLoadingWhatsapp(false);
    }
  };

  const handleConnectTelegram = async () => {
    if (!botTokenInput) return setTelegramError('Bot token is required');
    try {
      setSavingTelegram(true);
      const res = await connectTelegram(botTokenInput, botDisplayName || 'Telegram Bot', teamId);
      if (res.success) {
        setBotTokenInput(''); setBotDisplayName('');
        const updated = await getTelegramSettings(teamId);
        if (updated?.settings) setTelegramSettings(updated.settings);
      } else {
        setTelegramError(res.error || 'Failed to connect');
      }
    } catch {
      setTelegramError('Connection failed');
    } finally {
      setSavingTelegram(false);
    }
  };

  const handleDisconnectTelegram = async (botToken) => {
    if (!window.confirm('Disconnect bot?')) return;
    try {
      setSavingTelegram(true);
      const res = await disconnectTelegram(botToken, teamId);
      if (res.success) {
        const updated = await getTelegramSettings(teamId);
        if (updated?.settings) setTelegramSettings(updated.settings);
      }
    } finally {
      setSavingTelegram(false);
    }
  };

  const IntegrationCard = ({ id, name, description, icon: Icon, color, status, isUpcoming }) => (
    <Card 
      onClick={() => !isUpcoming && setActiveIntegration(id)}
      className={cn(
        "group h-full border-slate-200 transition-all duration-300 relative overflow-hidden flex flex-col justify-between",
        isUpcoming ? "opacity-60 grayscale-[0.5] cursor-not-allowed hover:border-slate-300" : "cursor-pointer hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-1"
      )}
    >
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className={cn("p-2 rounded-xl flex items-center justify-center shadow-sm", color)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {isUpcoming ? (
            <span className="text-[10px] font-bold uppercase tracking-tight text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              Soon
            </span>
          ) : status ? (
            <span className="text-[10px] font-bold uppercase tracking-tight text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-green-500" /> {status}
            </span>
          ) : null}
        </div>
        
        <div>
          <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{name}</h4>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{description}</p>
        </div>
      </CardContent>
    </Card>
  );

  const CategorySection = ({ title, items }) => (
    <div className="space-y-4 mb-10">
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h3>
        <div className="h-px bg-slate-200 flex-1" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item, idx) => <IntegrationCard key={idx} {...item} />)}
      </div>
    </div>
  );

  const renderOverview = () => {
    const categories = [
      {
        title: "Channels",
        items: [
          { id: 'whatsapp', name: 'WhatsApp', description: 'Official Business API via Meta.', icon: MessageSquare, color: 'bg-green-500', status: allWhatsappSettings.length > 0 ? 'Connected' : null },
          { id: 'telegram', name: 'Telegram', description: 'Bot integration for support.', icon: Send, color: 'bg-blue-500', status: telegramSettings.length > 0 ? 'Connected' : null },
          { id: 'instagram', name: 'Instagram', description: 'Direct Messages & Comments.', icon: Instagram, color: 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500', isUpcoming: true },
          { id: 'email', name: 'Email Inbox', description: 'Shared team email inbox.', icon: Mail, color: 'bg-slate-700', isUpcoming: true },
        ]
      },
      {
        title: "Payments",
        items: [
          { id: 'razorpay', name: 'Razorpay', description: 'Payment links & status.', icon: CreditCard, color: 'bg-blue-600', isUpcoming: true },
          { id: 'cashfree', name: 'Cashfree', description: 'Payouts and collections.', icon: Zap, color: 'bg-cyan-500', isUpcoming: true },
          { id: 'stripe', name: 'Stripe', description: 'Global payments & checkout.', icon: Globe, color: 'bg-indigo-600', isUpcoming: true },
        ]
      },
      {
        title: "CRM & Productivity",
        items: [
          { id: 'sheets', name: 'Google Sheets', description: 'Sync leads to spreadsheets.', icon: Layout, color: 'bg-emerald-600', isUpcoming: true },
          { id: 'hubspot', name: 'HubSpot', description: 'Full CRM data sync.', icon: Database, color: 'bg-orange-500', isUpcoming: true },
          { id: 'salesforce', name: 'Salesforce', description: 'Enterprise lead management.', icon: ShieldCheck, color: 'bg-sky-500', isUpcoming: true },
        ]
      },
      {
        title: "VoIP & Calling",
        items: [
          { id: 'airtel', name: 'Airtel IQ', description: 'Business calling & SMS.', icon: Phone, color: 'bg-red-600', isUpcoming: true },
          { id: 'twilio', name: 'Twilio', description: 'Programmable voice & SMS.', icon: Smartphone, color: 'bg-rose-500', isUpcoming: true },
        ]
      }
    ];

    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        {categories.map((cat, idx) => <CategorySection key={idx} {...cat} />)}
      </div>
    );
  };

  const renderWhatsAppDetail = () => (
    <div className="p-8 max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" className="mb-6 text-slate-500" onClick={() => setActiveIntegration(null)}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>
      <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-green-400 p-10 text-white">
          <h2 className="text-3xl font-black mb-2">WhatsApp Business</h2>
          <p className="text-green-50/80">Link your phone numbers to the unified inbox.</p>
        </div>
        <CardContent className="p-8">
          {!allWhatsappSettings.length ? (
            <div className="flex flex-col items-center py-10 gap-6">
              <div className="text-center max-w-sm">
                <p className="text-lg font-bold text-slate-900">Connect to Meta</p>
                <p className="text-sm text-slate-500 mt-2">Authorize your Facebook Business account to link your WhatsApp numbers.</p>
              </div>
              <Button onClick={handleConnectWhatsApp} disabled={loadingWhatsapp || !sdkLoaded} className="bg-[#1877F2] hover:bg-[#166fe5] text-white px-10 h-12 rounded-full font-bold">
                <Facebook className="w-5 h-5 mr-3 fill-current" /> Connect with Meta
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4">
                {allWhatsappSettings.map(s => (
                  <div key={s.phone_number_id} className={cn("flex items-center justify-between border-2 p-5 rounded-2xl transition-all", whatsappSettings.phone_number_id === s.phone_number_id ? "border-green-400 bg-green-50/30 shadow-md" : "border-slate-100 hover:border-slate-200")}>
                    <div>
                      <h4 className="font-bold text-slate-900">{s.display_phone_number || s.phone_number_id}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase tracking-tighter">ID: {s.phone_number_id}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={cn("text-[10px] px-3 py-1 rounded-full font-bold tracking-wider uppercase", s.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400")}>
                        {s.is_active ? 'Active' : 'Paused'}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDisconnectWhatsApp(s.phone_number_id)} className="text-slate-300 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={handleConnectWhatsApp} className="w-full border-dashed py-6 rounded-2xl text-slate-500 font-medium">+ Add Another Number</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderTelegramDetail = () => (
    <div className="p-8 max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" className="mb-6 text-slate-500" onClick={() => setActiveIntegration(null)}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>
      <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-400 p-10 text-white">
          <h2 className="text-3xl font-black mb-2">Telegram Bot</h2>
          <p className="text-blue-50/80">Connect your support bots via API token.</p>
        </div>
        <CardContent className="p-8">
          <div className="space-y-6 max-w-md mx-auto">
            {telegramSettings.length > 0 && (
              <div className="grid gap-3 mb-8">
                {telegramSettings.map(bot => (
                  <div key={bot.id} className="flex items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                    <div>
                      <p className="font-bold text-slate-900">@{bot.bot_username}</p>
                      <p className="text-xs text-slate-500">{bot.display_name}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDisconnectTelegram(bot.bot_token)} className="text-red-500 font-bold">Disconnect</Button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Bot Token</label>
                <Input type="password" value={botTokenInput} onChange={(e) => setBotTokenInput(e.target.value)} placeholder="000000000:AA..." className="h-12 bg-slate-50 border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Display Name</label>
                <Input value={botDisplayName} onChange={(e) => setBotDisplayName(e.target.value)} placeholder="Support Bot" className="h-12 bg-slate-50 border-slate-200" />
              </div>
              <Button onClick={handleConnectTelegram} disabled={savingTelegram || !botTokenInput} className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-xl text-white font-bold shadow-lg shadow-blue-500/20">
                {savingTelegram ? 'Connecting...' : 'Connect Bot'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/30">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="px-8 py-6 max-w-[1600px] mx-auto">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">App Directory</h1>
          <p className="text-sm text-slate-500 mt-1 mb-0 font-medium">Connect and manage your third-party tools.</p>
        </div>
      </div>

      {activeIntegration === null ? renderOverview() : 
       activeIntegration === 'whatsapp' ? renderWhatsAppDetail() : 
       activeIntegration === 'telegram' ? renderTelegramDetail() : null}

      <Modal isOpen={isPhoneSelectModalOpen} onClose={() => setIsPhoneSelectModalOpen(false)} title="Select Numbers">
        <div className="space-y-4">
          <div className="max-h-80 overflow-y-auto pr-1">
            {discoveredPhones.map(phone => (
              <div key={phone.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl mb-2">
                <div><p className="font-bold text-sm">{phone.displayPhoneNumber || phone.id}</p></div>
                <Button size="sm" onClick={() => handleSelectPhone(phone)} disabled={loadingWhatsapp} className="rounded-full">Link</Button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
