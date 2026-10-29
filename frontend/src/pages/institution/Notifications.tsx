import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Mail, MessageCircle, Smartphone } from 'lucide-react';
import { Badge, Card, PageHeader, Toggle, toast } from '../../components/ui';
import { Tour } from '../../components/live';
import { NOTIFICATIONS_TOUR } from '../../data/tours';
import { formatDateTime } from '../../lib/utils';
import { useNotifications } from '../../lib/live-data';
import { invalidate } from '../../lib/resource';
import { markNotificationRead, saveNotificationPrefs } from '../../services/api';

const CHANNEL_NAME: Record<string, string> = { email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp' };

const INBOX = [
  { at: '2026-10-22T09:00:00', channel: 'Email + SMS', title: 'Fire safety certificate expires in 17 days', body: 'Renew before 8 Nov 2026 to avoid a deficiency.', unread: true },
  { at: '2026-10-14T16:06:00', channel: 'Email + WhatsApp', title: 'Action needed on ANU-2026-0398', body: 'The university NOC does not name the new course. Your clock is paused until you respond.', unread: true },
  { at: '2026-10-09T12:01:00', channel: 'Email', title: 'Expert visit panel assigned for ANU-2026-0412', body: 'Three experts selected by a verifiable draw. Visit window opens 26 Oct 2026.', unread: false },
  { at: '2026-10-06T15:21:00', channel: 'Email', title: 'Scrutiny cleared for ANU-2026-0412', body: 'No deficiencies. Moved to the expert visit queue automatically.', unread: false },
];

const LANGS = ['English', 'हिन्दी (Hindi)', 'தமிழ் (Tamil)', 'తెలుగు (Telugu)', 'ಕನ್ನಡ (Kannada)', 'മലയാളം (Malayalam)', 'मराठी (Marathi)', 'বাংলা (Bengali)', 'ગુજરાતી (Gujarati)', 'ਪੰਜਾਬੀ (Punjabi)', 'ଓଡ଼ିଆ (Odia)', 'অসমীয়া (Assamese)', 'اردو (Urdu)'];

const PREVIEW: Record<string, string> = {
  English: 'ANUMATI: Fire safety certificate for Narmada Valley Institute of Technology expires on 8 Nov 2026. Renew and upload to avoid a deficiency.',
  'हिन्दी (Hindi)': 'अनुमति: नर्मदा वैली इंस्टीट्यूट ऑफ टेक्नोलॉजी का अग्नि सुरक्षा प्रमाणपत्र 8 नवंबर 2026 को समाप्त हो रहा है। कमी से बचने के लिए नवीनीकरण कर अपलोड करें।',
  'தமிழ் (Tamil)': 'அனுமதி: நர்மதா வேலி தொழில்நுட்பக் கல்லூரியின் தீ பாதுகாப்புச் சான்றிதழ் 8 நவம்பர் 2026 அன்று காலாவதியாகிறது. புதுப்பித்து பதிவேற்றவும்.',
};

export default function InstNotifications() {
  const [ch, setCh] = useState({ email: true, sms: true, whatsapp: true });
  const [lang, setLang] = useState('English');
  const [saving, setSaving] = useState(false);
  const { data: live } = useNotifications();
  // Real alerts when connected; the sample inbox otherwise.
  const inbox =
    live?.map((n) => ({
      id: n.id,
      at: n.createdAt,
      channel: Object.keys(n.delivery ?? {}).map((c) => CHANNEL_NAME[c] ?? c).join(' + ') || 'Portal',
      title: n.title,
      body: n.ref ? `Reference ${n.ref}` : '',
      unread: !n.read,
    })) ?? INBOX.map((n, i) => ({ ...n, id: -i - 1 }));
  const unread = inbox.filter((n) => n.unread).length;

  const open = async (id: number) => {
    if (id < 0) return;
    await markNotificationRead(id).catch(() => undefined);
    invalidate('notifications');
  };
  const markAll = async () => {
    await Promise.all(inbox.filter((n) => n.unread && n.id > 0).map((n) => markNotificationRead(n.id).catch(() => undefined)));
    invalidate('notifications');
    toast('All notifications marked as read');
  };
  const save = async () => {
    setSaving(true);
    try {
      const channels = Object.entries(ch).filter(([, on]) => on).map(([c]) => c);
      const done = await saveNotificationPrefs(channels, lang.startsWith('हिन्दी') ? 'hi' : 'en');
      toast(done ? 'Preferences saved to your account' : 'Preferences saved on this device');
    } catch {
      toast('Could not save preferences. Please try again.', 'red');
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <PageHeader eyebrow="After approval" title="Notifications" description="Reminders arrive before every date, in your language, on the channels you choose. SMS templates are registered on TRAI DLT so they are never blocked." tourId="notifications" />
      <Tour id="notifications" steps={NOTIFICATIONS_TOUR} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card
          data-tour="unread"
          title="Inbox"
          subtitle={unread ? `${unread} unread` : 'All caught up'}
          action={
            unread > 0 && live ? (
              <button className="btn-ghost btn-sm" onClick={markAll}>
                Mark all read
              </button>
            ) : undefined
          }
          pad={false}
        >
          <ul className="divide-y divide-slate-100">
            {inbox.map((n, i) => (
              <motion.li
                key={n.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 10) * 0.04 }}
                onClick={() => n.unread && open(n.id)}
                className={n.unread ? 'flex cursor-pointer gap-3 px-6 py-4 transition-colors hover:bg-slate-50' : 'flex gap-3 px-6 py-4'}
              >
                <span className={n.unread ? 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-saffron-500' : 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent'} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={n.unread ? 'font-semibold' : 'font-medium text-ink-soft'}>{n.title}</p>
                  {n.body && <p className="text-sm text-ink-mute">{n.body}</p>}
                  <p className="mt-1 text-xs text-ink-mute">
                    {formatDateTime(n.at)} · {n.channel}
                  </p>
                </div>
              </motion.li>
            ))}
          </ul>
        </Card>
        <div className="space-y-6">
          <Card title="Channels">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <Mail size={16} className="text-brand-600" /> Email
                </span>
                <Toggle checked={ch.email} onChange={(v) => setCh({ ...ch, email: v })} label="" srLabel="Email notifications" />
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <Smartphone size={16} className="text-brand-600" /> SMS <Badge tone="slate">DLT registered</Badge>
                </span>
                <Toggle checked={ch.sms} onChange={(v) => setCh({ ...ch, sms: v })} label="" srLabel="SMS notifications" />
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <MessageCircle size={16} className="text-brand-600" /> WhatsApp
                </span>
                <Toggle checked={ch.whatsapp} onChange={(v) => setCh({ ...ch, whatsapp: v })} label="" srLabel="WhatsApp notifications" />
              </div>
            </div>
          </Card>
          <Card title="Language" subtitle="Machine-translated with IndicTrans2 (22 scheduled languages), reviewed by staff">
            <label htmlFor="lang" className="sr-only">
              Notification language
            </label>
            <select id="lang" className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink-mute">
                <Bell size={13} /> Preview
              </p>
              <motion.p key={lang} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-sm leading-relaxed">
                {PREVIEW[lang] ?? 'Preview shown for English, Hindi and Tamil; all 22 languages are delivered.'}
              </motion.p>
            </div>
            <button className="btn-secondary mt-4 w-full" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
          </Card>
        </div>
      </div>
    </>
  );
}
