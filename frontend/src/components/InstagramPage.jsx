import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Instagram, CheckCircle, ExternalLink } from 'lucide-react';

export default function InstagramPage() {
  const instagramAuthUrl = "https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=1115102437313127&redirect_uri=https://inbox.xolox.io/api/auth/instagram/callback&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights";
  
  // Check for connected query param
  const isConnected = new URLSearchParams(window.location.search).get('connected') === 'true';

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Instagram Integration</h1>
          <p className="text-slate-500 mt-1">Connect your Instagram Business account to manage messages and comments.</p>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-white pb-4">
            <div className="flex items-center gap-2">
              <Instagram className="w-5 h-5 text-pink-600" />
              <CardTitle className="text-base font-semibold text-slate-900">Connect Account</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h3 className="font-medium text-slate-900 mb-2">Why connect Instagram?</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Receive and reply to Direct Messages directly from your inbox</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Manage comments on your posts</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Access business insights and analytics</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-4 pt-2">
              <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 rounded-lg flex items-center justify-center text-white">
                    <Instagram size={24} />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">Instagram Business</div>
                    <div className="text-xs text-slate-500">
                        {isConnected ? <span className="text-green-600 font-medium">Connected</span> : 'Not Connected'}
                    </div>
                  </div>
                </div>
                {isConnected ? (
                     <Button disabled variant="outline" className="border-green-200 bg-green-50 text-green-700">
                         <CheckCircle className="w-4 h-4 mr-2" />
                         Connected
                     </Button>
                ) : (
                    <Button 
                    onClick={() => window.location.href = instagramAuthUrl}
                    className="bg-[#E1306C] hover:bg-[#C13584] text-white"
                    >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect Instagram
                    </Button>
                )}
              </div>
              {!isConnected && (
                <p className="text-xs text-slate-500 text-center">
                    You will be redirected to Facebook/Instagram to authorize the connection.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
