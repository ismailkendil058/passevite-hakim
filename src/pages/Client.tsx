import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, Search, AlertCircle } from 'lucide-react';

interface QueueData {
  client_id: string;
  patient_name?: string;
  state: string;
  position: number;
  peopleBefore: number;
  doctor_name: string;
  found: boolean;
}

const Client = () => {
  const [phone, setPhone] = useState('');
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<{ id: string; name: string; initial: string }[]>([]);

  useEffect(() => {
    supabase.from('doctors').select('*').then(({ data }) => {
      if (data) setDoctors(data);
    });
  }, []);

  const lookupByPhone = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    await findClient(phone.trim());
    setLoading(false);
  };

  const findClient = async (value: string) => {
    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();

    const { data: allEntries } = await supabase
      .from('queue_entries')
      .select('*, doctor:doctors(*)')
      .in('status', ['waiting', 'in_cabinet'])
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd);

    if (!allEntries) {
      setQueueData({ client_id: '', state: '', position: 0, peopleBefore: 0, doctor_name: '', found: false });
      return;
    }

    const PRIORITY: Record<string, number> = { U: 0, N: 1, R: 2 };
    const sorted = [...(allEntries || [])].sort((a, b) => {
      // Priority: U (Urgent) always has absolute priority
      if (a.state === 'U' && b.state !== 'U') return -1;
      if (a.state !== 'U' && b.state === 'U') return 1;
      if (a.state === 'U' && b.state === 'U') return a.state_number - b.state_number;

      // For N (New) and R (Appointment), alternate: N1, R1, N2, R2, ...
      const getRank = (e: any) => {
        const num = e.state_number || 0;
        if (e.state === 'N') return num * 2 - 1; // N1->1, N2->3, N3->5
        if (e.state === 'R') return num * 2;     // R1->2, R2->4, R3->6
        return 999;
      };

      const rankA = getRank(a);
      const rankB = getRank(b);

      if (rankA !== rankB) return rankA - rankB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const entry = sorted.find(e => e.phone === value);

    if (!entry) {
      setQueueData({ client_id: '', state: '', position: 0, peopleBefore: 0, doctor_name: '', found: false });
      return;
    }

    const idx = sorted.findIndex(e => e.id === entry!.id);

    // Count people before this client WAITING for the SAME doctor
    // If the entry itself is 'in_cabinet', peopleBefore should be 0
    const peopleBeforeSameDoctor = entry.status === 'in_cabinet'
      ? 0
      : sorted.slice(0, idx).filter(
        e => e.doctor_id === entry!.doctor_id && e.status === 'waiting'
      ).length;

    setQueueData({
      client_id: entry.client_id,
      patient_name: entry.patient_name,
      state: entry.state,
      position: idx + 1,
      peopleBefore: peopleBeforeSameDoctor,
      doctor_name: (entry as any).doctor?.name || '',
      found: true,
    });
  };

  // Real-time updates - optimized subscription
  useEffect(() => {
    if (!queueData?.found) return;

    const channel = supabase
      .channel('client-position-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_entries'
        },
        (payload) => {
          if (phone.trim()) findClient(phone.trim());
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queueData?.found, phone]);

  const stateLabels: Record<string, string> = { U: 'Urgence', N: 'Nouveau', R: 'Rendez-vous' };

  return (
    <div className="h-[100dvh] overflow-hidden bg-background flex flex-col">
      <header className="p-3 sm:p-4 text-center border-b gpu">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground italic animate-fade-in gpu">PasseVite</h1>
        <p className="text-[10px] tracking-[0.2em] text-muted-foreground -mt-1 uppercase animate-fade-in gpu">le soin qui passe</p>
      </header>

      {!queueData?.found && (
        <div className="flex-1 p-3 sm:p-4 flex items-center justify-center animate-slide-up gpu">
          <Card className="w-full max-w-md border-0 shadow-lg gpu">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg text-center font-bold tracking-tight">Trouver votre position</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
              <Input
                placeholder="Votre numéro de téléphone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                className="h-11 sm:h-12"
              />
              <Button onClick={lookupByPhone} className="w-full h-11 sm:h-12" disabled={loading}>
                <Search className="h-4 w-4 mr-2" /> Rechercher
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {queueData && !queueData.found && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm border-0 shadow-xl">
            <CardContent className="p-6 sm:p-8 text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-lg sm:text-xl font-semibold text-red-600">Aucun patient trouvé</p>
                <p className="text-sm text-muted-foreground">Vérifiez vos informations et réessayez.</p>
                <p className="text-xs text-muted-foreground">Assurez-vous que votre numéro de téléphone ou votre identifiant est correct.</p>
              </div>
              <Button variant="destructive" onClick={() => setQueueData(null)} className="mt-2">
                Réessayer
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {queueData?.found && (
        <div className="flex-1 p-3 sm:p-4 flex items-center justify-center animate-slide-up gpu">
          <Card className="w-full max-w-md border-0 shadow-lg gpu overflow-hidden">
            <CardContent className="p-6 sm:p-8 text-center space-y-4 sm:space-y-6 relative">
              {/* Decorative accent */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-primary/20" />
              <div className="absolute top-0 left-0 h-1.5 bg-primary animate-[shimmer_2s_infinite] w-full" style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)' }} />

              <div className="space-y-2">
                {queueData.patient_name && (
                  <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight italic">{queueData.patient_name}</h2>
                )}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">Votre identifiant</p>
                  <p className="text-5xl sm:text-7xl font-black text-primary tracking-tighter italic animate-pulse-subtle">{queueData.client_id}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs sm:text-sm px-4 py-1.5 font-bold border-primary/20 text-primary bg-primary/5 uppercase tracking-widest">{stateLabels[queueData.state] || queueData.state}</Badge>
              <div className="bg-primary/[0.03] rounded-[2rem] p-6 sm:p-8 border border-primary/5 shadow-inner">
                <div className="flex items-center justify-center gap-3 mb-2 animate-float gpu">
                  <Users className="h-6 w-6 text-primary" />
                  <span className="text-4xl sm:text-5xl font-black text-foreground tracking-tighter tabular-nums">{queueData.peopleBefore}</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                  {queueData.peopleBefore === 0
                    ? 'C\'est votre tour !'
                    : `personne${queueData.peopleBefore > 1 ? 's' : ''} avant vous`}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-muted-foreground py-2 border-y border-dashed border-muted-foreground/10">
                <Clock className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium tracking-wide">{queueData.doctor_name}</span>
              </div>
              <Button variant="ghost" onClick={() => setQueueData(null)} className="mt-2 sm:mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary">
                Nouvelle recherche
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Client;
