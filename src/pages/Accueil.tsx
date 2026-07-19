import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueue, QueueEntry } from '@/hooks/useQueue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Phone, Plus, LogOut, ChevronRight, ChevronLeft, Users, Clock, CheckCircle, XCircle, MessageCircle, Pencil, Trash2, UserCheck, Calendar as CalendarIcon, DollarSign, ShoppingCart, Sparkles, Lock, Unlock, QrCode, List } from 'lucide-react';
import QrScannerModal from '@/components/QrScannerModal';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';


const TREATMENTS = [
  'Extraction simple',
  'Extraction chirurgicale',
  'Obturation (Plombage)',
  'Traitement de canal',
  'Détartrage & Polissage',
  'Blanchiment dentaire',
  'Prothèse fixe (Couronne)',
  'Prothèse amovible',
  'Implant dentaire',
  'Appareil orthodontique',
  'Consultation dentaire'
];


const QueueItem = React.memo(({ entry, index, onEdit, onDelete, onNext }: { entry: QueueEntry; index: number; onEdit: (e: QueueEntry) => void; onDelete: (id: string) => void; onNext: (e: QueueEntry) => void }) => {
  const stateColors = {
    U: 'bg-destructive text-destructive-foreground',
    N: 'bg-primary text-primary-foreground',
    R: 'bg-foreground text-background',
  };
  const stateLabels = { U: 'Urgence', N: 'Nouveau', R: 'Rendez-vous' };

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow gpu">
      <CardContent className="p-3 sm:p-4 lg:p-5 flex items-center justify-between gap-2 lg:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <span className="text-xs sm:text-sm lg:text-base font-bold text-primary">{index + 1}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm sm:text-base lg:text-lg text-foreground">{entry.client_id}</span>
              {entry.patient_name && (
                <span className="text-sm lg:text-base font-medium text-muted-foreground truncate max-w-[120px] sm:max-w-[200px] lg:max-w-[320px]">
                  · {entry.patient_name}
                </span>
              )}
              <Badge variant="outline" className={`${stateColors[entry.state]} text-xs lg:text-sm px-1.5 lg:px-2.5 py-0`}>
                {stateLabels[entry.state]}
              </Badge>
            </div>
            <p className="text-xs lg:text-sm text-muted-foreground truncate mt-0.5">
              equipe {entry.doctor?.name || '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 lg:gap-3 shrink-0">
          <div className="flex items-center gap-1 lg:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:h-12 lg:w-12 text-muted-foreground hover:text-green-600"
              asChild
              title="Appeler"
            >
              <a href={`tel:${entry.phone}`}>
                <Phone className="h-4 w-4 lg:h-6 lg:w-6" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:h-12 lg:w-12 text-muted-foreground hover:text-primary"
              onClick={() => onEdit(entry)}
              title="Modifier"
            >
              <Pencil className="h-4 w-4 lg:h-6 lg:w-6" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 lg:h-12 lg:w-12 text-muted-foreground hover:text-destructive"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4 lg:h-6 lg:w-6" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer le patient ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action supprimera {entry.client_id} de la file d'attente. Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(entry.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <Button
            size="sm"
            onClick={() => onNext(entry)}
            className="gap-1 shrink-0 h-8 sm:h-9 lg:h-11 px-2 sm:px-3 lg:px-5 text-xs sm:text-sm lg:text-base"
          >
            <span className="hidden sm:inline">Suivant</span> <ChevronRight className="h-4 w-4 lg:h-5 lg:w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

const Accueil = () => {
  const { user, signOut } = useAuth();
  const { entries, inCabinetEntries, doctors, loading, addClient, callClient, completeClient, updateClient, deleteClient, updateCompletedClient, deleteCompletedClient } = useQueue();

  const [isManagerAuthorized, setIsManagerAuthorized] = useState(false);
  const [managerPassword, setManagerPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  // Edit Completed Client State
  const [editCompletedClient, setEditCompletedClient] = useState<any>(null);
  const [showEditCompletedModal, setShowEditCompletedModal] = useState(false);
  const [ecName, setEcName] = useState('');
  const [ecTreatment, setEcTreatment] = useState('');
  const [ecTotal, setEcTotal] = useState('');
  const [ecPaid, setEcPaid] = useState('');
  const [ecNotes, setEcNotes] = useState('');

  const handleVerifyManager = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('roles')
        .select('id')
        .in('role', ['manager', 'admin'])
        .eq('password', managerPassword)
        .limit(1);

      if (error || !data || data.length === 0) {
        toast.error('Mot de passe incorrect');
        return;
      }

      setIsManagerAuthorized(true);
      setShowPasswordDialog(false);
      setManagerPassword('');
      toast.success('Mode édition activé');
    } catch (err) {
      toast.error('Erreur de vérification');
    }
  };

  const fetchTodayClients = async () => {
    try {
      setLoadingTodayClients(true);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const nextStart = new Date(start);
      nextStart.setDate(nextStart.getDate() + 1);
      const { data, error } = await supabase
        .from('completed_clients')
        .select('id, client_name, phone, client_id, treatment, total_amount, tranche_paid, state, doctor_id, completed_at')
        .gte('completed_at', start.toISOString())
        .lt('completed_at', nextStart.toISOString())
        .order('completed_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error fetching today clients:', error);
        setTodayClients([]);
        return;
      }

      // Fetch doctors to map names
      const { data: doctorsData } = await supabase
        .from('doctors')
        .select('id, name');

      const doctorsMap = new Map((doctorsData || []).map((d: any) => [d.id, d.name]));

      const enriched = (data || []).map((c: any) => ({
        ...c,
        doctor: { name: doctorsMap.get(c.doctor_id) || '—' },
      }));

      setTodayClients(enriched);
    } catch (err) {
      console.error('Error fetching today clients', err);
      setTodayClients([]);
    } finally {
      setLoadingTodayClients(false);
    }
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTodayModal, setShowTodayModal] = useState(false);
  const [todayClients, setTodayClients] = useState<any[]>([]);
  const [loadingTodayClients, setLoadingTodayClients] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<QueueEntry | null>(null);
  const [editEntry, setEditEntry] = useState<QueueEntry | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editPatientName, setEditPatientName] = useState('');
  const [editState, setEditState] = useState<'U' | 'N' | 'R'>('N');
  const [editDoctorId, setEditDoctorId] = useState('');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');

  // Quick Expense Modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  const [isCompletingClient, setIsCompletingClient] = useState(false);
  // Channel Choice Modal
  const [showChannelChoice, setShowChannelChoice] = useState(false);
  const [lastCompletedPatient, setLastCompletedPatient] = useState<{ name: string; phone: string; treatment: string } | null>(null);
  // QR Scanner
  const [showQrScanner, setShowQrScanner] = useState(false);

  const doctorsScrollRef = useRef<HTMLDivElement>(null);

  const scrollDoctors = (direction: 'left' | 'right') => {
    if (doctorsScrollRef.current) {
      const scrollAmount = 150;
      doctorsScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Add client form
  const [newPhone, setNewPhone] = useState('');
  const [newPatientName, setNewPatientName] = useState('');
  const [newState, setNewState] = useState<'U' | 'N' | 'R'>('N');
  const [newDoctorId, setNewDoctorId] = useState('');
  const [linkedAppointmentId, setLinkedAppointmentId] = useState<string | null>(null);
  const [foundAppointments, setFoundAppointments] = useState<any[]>([]);

  // Complete form
  const [clientName, setClientName] = useState('');
  const [treatment, setTreatment] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [tranchePaid, setTranchePaid] = useState('');
  const [totalPaidPreviously, setTotalPaidPreviously] = useState(0);
  const [completeNotes, setCompleteNotes] = useState('');
  const [historyTreatments, setHistoryTreatments] = useState<Array<{ treatment: string; totalAmount: number; totalPaid: number }>>([]);
  const [selectedHistoryTreatment, setSelectedHistoryTreatment] = useState<string | null>(null);

  const [hasNextAppt, setHasNextAppt] = useState(false);
  const [nextApptDate, setNextApptDate] = useState<Date | undefined>(undefined);
  const [nextApptTime, setNextApptTime] = useState('08:00');
  const [nextApptDoctorId, setNextApptDoctorId] = useState('');
  const [nextApptNote, setNextApptNote] = useState('');

  // Treatments list (load from localStorage to allow adding custom treatments)
  const [treatmentsList, setTreatmentsList] = useState<string[]>(TREATMENTS);
  const [showTreatmentSuggestions, setShowTreatmentSuggestions] = useState(false);


  const stats = useMemo(() => {
    const stats = { U: { current: 0, total: 0 }, N: { current: 0, total: 0 }, R: { current: 0, total: 0 } };
    const waiting = entries.filter(e => e.status === 'waiting');

    (['U', 'N', 'R'] as const).forEach(state => {
      const stateEntries = waiting.filter(e => e.state === state);
      stats[state].current = stateEntries.length > 0 ? stateEntries[0].state_number : 0;
      stats[state].total = stateEntries.length;
    });

    return stats;
  }, [entries]);

  // Load persisted treatments from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pv_treatments');
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed)) {
          // If the cached list contains old treatments, clear it
          if (parsed.some(t => ['Peeling carbonique', 'Hydrafacial', 'Nettoyage de peau'].includes(t))) {
            localStorage.removeItem('pv_treatments');
            setTreatmentsList(TREATMENTS);
            return;
          }
          // Merge with default treatments preserving uniqueness
          const merged = Array.from(new Set([...parsed, ...TREATMENTS]));
          setTreatmentsList(merged);
        }
      }
    } catch (err) {
      // ignore
    }
  }, []);

  // Memoize statistics by doctor
  const doctorStats = useMemo(() => {
    return doctors.map(doctor => {
      const doctorEntries = entries.filter(e => e.doctor_id === doctor.id);
      return {
        ...doctor,
        waitingCount: doctorEntries.length
      };
    });
  }, [doctors, entries]);


  // Removed handleOpenSession and handleCloseSession as séance logic is being removed.

  const handleAddClient = async () => {
    if (!newPhone.trim() || !newDoctorId) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    const { error } = await addClient(newPhone, newState, newDoctorId, newPatientName, linkedAppointmentId || undefined);
    if (error) {
      if ((error as any).code === '23505') {
        toast.error('Ce numéro de téléphone est déjà dans la file d\'attente');
      } else {
        toast.error('Erreur lors de l\'ajout');
      }
    }
    else {
      toast.success('Patient ajouté à la file');
      setShowAddModal(false);
      setNewPhone('');
      setNewPatientName('');
      setNewState('N');
      setNewDoctorId('');
      setLinkedAppointmentId(null);
    }
  };

  // Search for appointment when phone, name or state changes with debounce
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      const searchAppointments = async () => {
        // Only search if we are in Rendez-vous state and have enough characters
        const hasEnoughChars = (newPhone.trim().length >= 3 || newPatientName.trim().length >= 2);

        if (newState === 'R' && hasEnoughChars && !linkedAppointmentId) {
          const today = new Date();
          const start = new Date(today.setHours(0, 0, 0, 0)).toISOString();

          let orConditions = [];
          if (newPhone.trim().length >= 3) orConditions.push(`client_phone.ilike.%${newPhone.trim()}%`);
          if (newPatientName.trim().length >= 2) orConditions.push(`client_name.ilike.%${newPatientName.trim()}%`);

          const { data } = await supabase
            .from('appointments')
            .select('id, client_name, client_phone, doctor_id, appointment_at, status')
            .neq('status', 'attended')
            .neq('status', 'denied')
            .or(orConditions.join(','))
            .gte('appointment_at', start)
            .order('appointment_at', { ascending: true })
            .limit(5);

          if (data && data.length > 0) {
            setFoundAppointments(data);
          } else {
            setFoundAppointments([]);
          }
        } else {
          setFoundAppointments([]);
          if (newState !== 'R') setLinkedAppointmentId(null);
        }
      };

      searchAppointments();
    }, 400); // 400ms debounce

    return () => clearTimeout(timeoutId);
  }, [newPhone, newPatientName, newState, linkedAppointmentId]);

  const handleNext = async (entry: QueueEntry) => {
    // Call client - move from waiting to in_cabinet
    const { error } = await callClient(entry.id);
    if (error) {
      toast.error('Erreur lors de l\'appel du patient');
    } else {
      toast.success(`Patient ${entry.client_id} appelé au cabinet`);
    }
  };

  const handleCompleteClick = async (entry: QueueEntry) => {
    // Open completion form for in-cabinet client
    setSelectedEntry(entry);
    setClientName(entry.patient_name || '');

    // Fetch history for pre-filling
    try {
      // Only load previous treatments when this entry is a Rendez-vous (R).
      if (entry.state === 'R') {
        const { data: history } = await (await import('@/integrations/supabase/client')).supabase
          .from('completed_clients')
          .select('id, client_name, phone, client_id, treatment, total_amount, tranche_paid, completed_at, state')
          .eq('phone', entry.phone)
          .order('completed_at', { ascending: false })
          .limit(200);

        if (history && history.length > 0) {
          // Aggregate history per treatment: sum paid tranches and keep latest total_amount for that treatment
          const map = new Map<string, { totalPaid: number; totalAmount: number; lastDate: number }>();
          history.forEach((item: any) => {
            const key = item.treatment || '—';
            const existing = map.get(key) || { totalPaid: 0, totalAmount: 0, lastDate: 0 };
            existing.totalPaid += (item.tranche_paid || 0);
            const ts = new Date(item.completed_at).getTime();
            if (!existing.lastDate || ts > existing.lastDate) {
              existing.totalAmount = item.total_amount || 0;
              existing.lastDate = ts;
            }
            map.set(key, existing);
          });

          const treatmentsArr = Array.from(map.entries()).map(([treatment, v]) => ({
            treatment,
            totalAmount: v.totalAmount || 0,
            totalPaid: v.totalPaid || 0,
          }));

          setHistoryTreatments(treatmentsArr);
          // Prefill with the most recent treatment if available
          const first = treatmentsArr[0];
          if (first) {
            setTreatment(first.treatment);
            setTotalAmount(first.totalAmount?.toString() || '');
            setTotalPaidPreviously(first.totalPaid || 0);
            setSelectedHistoryTreatment(first.treatment);
          } else {
            setTreatment('');
            setTotalAmount('');
            setTotalPaidPreviously(0);
            setSelectedHistoryTreatment(null);
          }
          setTranchePaid('');
        } else {
          setHistoryTreatments([]);
          setTreatment('');
          setTotalAmount('');
          setTotalPaidPreviously(0);
          setTranchePaid('');
          setSelectedHistoryTreatment(null);
        }
      } else {
        // New patient: do not show or prefill any previous totals
        setHistoryTreatments([]);
        setTreatment('');
        setTotalAmount('');
        setTotalPaidPreviously(0);
        setTranchePaid('');
        setSelectedHistoryTreatment(null);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      setHistoryTreatments([]);
      setTreatment('');
      setTotalAmount('');
      setTotalPaidPreviously(0);
      setTranchePaid('');
      setSelectedHistoryTreatment(null);
    }

    setCompleteNotes('');
    setHasNextAppt(false);
    setNextApptDate(undefined);
    setNextApptTime('09:00');
    setNextApptDoctorId(entry.doctor_id);
    setNextApptNote('');
    setShowCompleteModal(true);

  };

  const handleComplete = async () => {
    if (!selectedEntry || !user || !clientName.trim() || !treatment) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    if (isCompletingClient) return;

    setIsCompletingClient(true);

    try {
      const { error, alreadyCompleted } = await completeClient(
        selectedEntry.id,
        clientName,
        treatment,
        parseFloat(totalAmount) || 0,
        parseFloat(tranchePaid) || 0,
        user.id,
        completeNotes
      );
      if (error) {
        toast.error('Erreur lors de la validation du patient');
        return;
      }

      if (alreadyCompleted) {
        toast.info('Ce patient était déjà traité');
        // Still proceed to show choice modal in case it was a double-click/retry
        setLastCompletedPatient({
          name: clientName,
          phone: selectedEntry.phone,
          treatment: treatment
        });
        setShowCompleteModal(false);
        setShowChannelChoice(true);
        return;
      }
      if (hasNextAppt && nextApptDate) {
        const [hours, minutes] = nextApptTime.split(':');
        const appointmentAt = new Date(nextApptDate);
        appointmentAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        await (await import('@/integrations/supabase/client')).supabase
          .from('appointments')
          .insert({
            client_phone: selectedEntry.phone,
            client_name: clientName.trim(),
            doctor_id: nextApptDoctorId,
            appointment_at: appointmentAt.toISOString(),
            status: 'scheduled',
            notes: nextApptNote.trim() || null
          });

        toast.success('Rendez-vous programmé');
      }


      // Prepare data for the choice modal
      setLastCompletedPatient({
        name: clientName,
        phone: selectedEntry.phone,
        treatment: treatment
      });

      toast.success('Patient traité avec succès');

      // Show choice modal instead of direct redirect
      setShowCompleteModal(false);
      setShowChannelChoice(true);

      // Persist new treatment for suggestions if it's not already present
      try {
        const trimmed = treatment.trim();
        if (trimmed && !treatmentsList.find(t => t.toLowerCase() === trimmed.toLowerCase())) {
          const newList = [trimmed, ...treatmentsList];
          setTreatmentsList(newList);
          try { localStorage.setItem('pv_treatments', JSON.stringify(newList)); } catch (e) { /* ignore */ }
        }
      } catch (err) {
        // ignore
      }

      setShowCompleteModal(false);
    } finally {
      setIsCompletingClient(false);
    }
  };

    const handleReturnToQueue = async () => {
      if (!selectedEntry) return;
      try {
        const { error } = await updateClient(selectedEntry.id, { status: 'waiting' as any });
        if (error) {
          toast.error('Erreur lors du retour à la file');
          return;
        }
        toast.success('Patient renvoyé à la file d\'attente');
        setShowCompleteModal(false);
      } catch (err) {
        toast.error('Erreur lors du retour à la file');
      }
    };

  const handleEdit = (entry: QueueEntry) => {
    setEditEntry(entry);
    setEditPhone(entry.phone);
    setEditPatientName(entry.patient_name || '');
    setEditState(entry.state);
    setEditDoctorId(entry.doctor_id);
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editEntry || !editPhone.trim() || !editDoctorId) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    const { error } = await updateClient(editEntry.id, {
      phone: editPhone.trim(),
      patient_name: editPatientName.trim(),
      state: editState,
      doctor_id: editDoctorId,
    });
    if (error) toast.error('Erreur lors de la modification');
    else {
      toast.success('Patient modifié avec succès');
      setShowEditModal(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    const { error } = await deleteClient(entryId);
    if (error) toast.error('Erreur lors de la suppression');
    else toast.success('Patient supprimé');
  };

  const handleAddExpense = async () => {
    if (!expenseAmount || !expenseDesc) {
      toast.error('Veuillez remplir le montant et la description');
      return;
    }
    const amount = parseFloat(expenseAmount);
    if (isNaN(amount)) {
      toast.error('Montant invalide');
      return;
    }

    setSavingExpense(true);
    try {
      // @ts-ignore - The database uses 'title' but types.ts is out of sync
      const { error } = await supabase.from('expenses').insert({
        amount: amount,
        title: expenseDesc,
        date: format(new Date(), 'yyyy-MM-dd'),
        created_by: user?.id || 'system'
      });
      if (error) throw error;
      toast.success('Dépense ajoutée avec succès');
      setExpenseAmount('');
      setExpenseDesc('');
      setShowExpenseModal(false);
    } catch (err) {
      toast.error('Erreur lors de l\'ajout de la dépense');
    } finally {
      setSavingExpense(false);
    }
  };

  const filtered = useMemo(() => {
    return entries.filter(e => {
      const matchesDoctor = doctorFilter === 'all' || e.doctor_id === doctorFilter;
      return matchesDoctor;
    });
  }, [entries, doctorFilter]);

  const stateColors = {
    U: 'bg-destructive text-destructive-foreground',
    N: 'bg-primary text-primary-foreground',
    R: 'bg-foreground text-background',
  };

  const stateLabels = { U: 'Urgence', N: 'Nouveau', R: 'Rendez-vous' };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Chargement de la séance...</p>
        </div>
      </div>
    );
  }

  // séance removed, direct access to dashboard.

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-3 sm:p-4 lg:px-8 lg:py-4 border-b sticky top-0 bg-background z-10">
        <Link to="/" className="flex items-center gap-2.5 lg:gap-4 hover:opacity-80 transition-opacity">
          <div className="p-1 lg:p-2 rounded-lg bg-white shadow-lg shadow-primary/5 border border-primary/5 shrink-0 hidden sm:block">
            <img src="/Dr hakim.png" alt="Logo" className="h-6 w-6 lg:h-9 lg:w-9 object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-primary tracking-tighter italic leading-none">
              PasseVite
            </h1>
            <p className="text-[9px] lg:text-[11px] text-muted-foreground truncate uppercase font-medium tracking-widest hidden sm:block">
              Le soin qui passe vite
            </p>
          </div>
        </Link>
        <div className="flex gap-1.5 sm:gap-2 lg:gap-3 mx-auto">
          <Button onClick={async () => {
            await fetchTodayClients();
            setShowTodayModal(true);
          }} variant="outline" size="sm" className="h-8 lg:h-10 px-2 sm:px-3 lg:px-5 text-[11px] lg:text-sm font-black uppercase">Terminer</Button>
          <Button asChild variant="secondary" size="sm" className="h-8 lg:h-10 px-2 sm:px-3 lg:px-5 text-[11px] lg:text-sm font-black uppercase tracking-widest bg-primary/10 text-primary hover:bg-primary/20 border-0 rounded-full sm:rounded-md shadow-none">
            <Link to="/accueil/factures/ajouter">
              <ShoppingCart className="h-3.5 w-3.5 lg:h-4 lg:w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Facture</span>
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 lg:h-10 px-2 sm:px-3 lg:px-5 text-[11px] lg:text-sm font-black uppercase tracking-widest bg-destructive/5 text-destructive border-destructive/20 hover:bg-destructive/10 rounded-full sm:rounded-md shadow-none" onClick={() => setShowExpenseModal(true)}>
            <DollarSign className="h-3.5 w-3.5 lg:h-4 lg:w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Dépense</span>
          </Button>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 shrink-0">
          <Link to="/rendezvous">
            <Button variant="outline" size="sm" className="hidden sm:flex h-8 lg:h-10 px-3 lg:px-5 text-[11px] lg:text-sm font-black uppercase tracking-widest">
              <CalendarIcon className="h-3.5 w-3.5 lg:h-4 lg:w-4 mr-1.5" /> Rendez-vous
            </Button>
            <Button variant="outline" size="icon" className="sm:hidden h-8 w-8 rounded-full">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </Link>


          {/* Session close removed */}
          <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8 lg:h-10 lg:w-10"><LogOut className="h-4 w-4 lg:h-5 lg:w-5" /></Button>
        </div>
      </header>

      {/* Today's completed clients modal (Terminer) */}
      <Dialog open={showTodayModal} onOpenChange={setShowTodayModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[calc(100vh-4rem)] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle>Clients traités aujourd'hui</DialogTitle>
              {!isManagerAuthorized ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-primary"
                  onClick={() => setShowPasswordDialog(true)}
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Modifier</span>
                </Button>
              ) : (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1.5 py-1">
                  <Unlock className="h-3.5 w-3.5" /> Mode Manager
                </Badge>
              )}
            </div>
          </DialogHeader>
          <div className="relative">
            <div className="max-h-[calc(100vh-28rem)] overflow-y-auto space-y-3 py-2 pr-2">
              {loadingTodayClients ? (
                <div className="flex items-center justify-center p-6">
                  <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : todayClients.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Aucun client traité aujourd'hui.</div>
              ) : (
                <div className="space-y-2">
                  {todayClients.map((c: any) => (
                    <Card key={c.id} className="border-0 shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-foreground">{c.client_name}</div>
                            <div className="text-xs text-muted-foreground">{c.phone} · {c.doctor?.name || '—'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">{(c.total_amount || 0).toLocaleString()} DZD</div>
                            <div className="text-xs text-muted-foreground">Payé: {(c.tranche_paid || 0).toLocaleString()} DZD</div>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground flex items-center justify-between">
                          <div>Traitement: {c.treatment}</div>
                          {isManagerAuthorized && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                onClick={() => {
                                  setEditCompletedClient(c);
                                  setEcName(c.client_name);
                                  setEcTreatment(c.treatment);
                                  setEcTotal(c.total_amount.toString());
                                  setEcPaid(c.tranche_paid.toString());
                                  setEcNotes(c.notes || '');
                                  setShowEditCompletedModal(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer ce traitement ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Cette action supprimera le record du client {c.client_name} pour le traitement {c.treatment}.
                                      Les statistiques financières seront impactées.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground"
                                      onClick={async () => {
                                        const { error } = await deleteCompletedClient(c.id);
                                        if (error) toast.error('Erreur');
                                        else {
                                          toast.success('Supprimé');
                                          fetchTodayClients();
                                        }
                                      }}
                                    >
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </div>
                        {c.notes && <div className="mt-1 text-xs text-muted-foreground italic">Note: {c.notes}</div>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            {isManagerAuthorized && (
              <Button variant="outline" onClick={() => setIsManagerAuthorized(false)} className="flex-1">
                Désactiver Mode Manager
              </Button>
            )}
            <Button onClick={() => setShowTodayModal(false)} className={isManagerAuthorized ? 'flex-1' : 'w-full'}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manager Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-[320px]">
          <DialogHeader>
            <DialogTitle>Accès Manager</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">Veuillez entrer le mot de passe manager pour modifier les traitements.</p>
            <Input
              type="password"
              placeholder="Mot de passe"
              value={managerPassword}
              onChange={(e) => setManagerPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyManager()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Annuler</Button>
            <Button onClick={handleVerifyManager}>Valider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Completed Client Modal */}
      <Dialog open={showEditCompletedModal} onOpenChange={setShowEditCompletedModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le traitement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom du patient</label>
              <Input value={ecName} onChange={e => setEcName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Traitement</label>
              <Input value={ecTreatment} onChange={e => setEcTreatment(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Total (DZD)</label>
                <Input type="number" value={ecTotal} onChange={e => setEcTotal(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Payé (DZD)</label>
                <Input type="number" value={ecPaid} onChange={e => setEcPaid(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Input value={ecNotes} onChange={e => setEcNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCompletedModal(false)}>Annuler</Button>
            <Button onClick={async () => {
              const { error } = await updateCompletedClient(editCompletedClient.id, {
                client_name: ecName,
                treatment: ecTreatment,
                total_amount: parseFloat(ecTotal) || 0,
                tranche_paid: parseFloat(ecPaid) || 0,
                notes: ecNotes
              });
              if (error) toast.error('Erreur');
              else {
                toast.success('Modifié');
                setShowEditCompletedModal(false);
                fetchTodayClients();
              }
            }}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Stats by Doctor */}
      <div className="w-full flex justify-center lg:px-8">
        <div
          ref={doctorsScrollRef}
          className="flex justify-center flex-wrap gap-2 lg:gap-4 p-3 sm:p-4 lg:py-5 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {doctorStats.map(ds => {
            return (
              <Card
                key={ds.id}
                className="border-0 shadow-sm shrink-0 w-28 sm:w-40 lg:w-52 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setDoctorFilter(doctorFilter === ds.id ? 'all' : ds.id)}
              >
                <CardContent className="p-3 sm:p-4 lg:p-6 text-center">
                  <p className="text-xs lg:text-sm font-medium text-muted-foreground mb-1 truncate">{ds.name}</p>
                  <p className="text-xl sm:text-2xl lg:text-4xl font-bold text-foreground">{ds.waitingCount}</p>
                  <p className="text-xs lg:text-sm text-muted-foreground mt-1">en attente</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* In Cabinet Section */}
      {inCabinetEntries.length > 0 && (
        <div className="p-3 sm:p-4 lg:px-8 lg:py-5 pb-0 w-full flex flex-col items-center">
          <h2 className="text-sm lg:text-base font-semibold text-muted-foreground mb-2 lg:mb-3 flex items-center gap-2 w-full justify-center">
            <UserCheck className="h-4 w-4 lg:h-5 lg:w-5 text-orange-500" />
            Au cabinet ({inCabinetEntries.length})
          </h2>
          <div className="flex justify-center flex-wrap w-full gap-2 lg:gap-4 overflow-x-auto pb-3 scrollbar-hide">
            {inCabinetEntries.map(entry => (
              <Card
                key={entry.id}
                className="border-orange-200 bg-orange-50 shrink-0 w-40 sm:w-48 lg:w-64 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleCompleteClick(entry)}
              >
                <CardContent className="p-3 lg:p-5 text-center">
                  <p className="font-bold text-lg lg:text-2xl text-orange-700">{entry.client_id}</p>
                  <p className="text-xs lg:text-sm font-medium text-orange-800 truncate">{entry.patient_name || '—'}</p>
                  <p className="text-xs lg:text-sm text-orange-600 truncate">{entry.doctor?.name || '—'}</p>
                  <p className="text-xs lg:text-sm text-orange-500 mt-1">Cliquer pour finaliser</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="flex-1 p-3 sm:p-4 lg:px-8 lg:py-6 space-y-2 lg:space-y-3 pb-24 lg:max-w-5xl lg:w-full lg:mx-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-12 lg:py-20 text-muted-foreground">
            <Users className="h-10 w-10 sm:h-12 sm:w-12 lg:h-16 lg:w-16 mx-auto mb-3 lg:mb-4 opacity-30" />
            <p className="lg:text-lg">Aucun patient en attente</p>
          </div>
        ) : (
          filtered.map((entry, index) => (
            <QueueItem
              key={entry.id}
              entry={entry}
              index={index}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onNext={handleNext}
            />
          ))
        )}
      </div>

      {/* FAB to add client */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 lg:bottom-10 lg:right-10 flex flex-col gap-2 lg:gap-3 items-end">
        <Button
          size="lg"
          variant="outline"
          className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 rounded-full shadow-lg border-2 border-violet-200 bg-white hover:bg-violet-50 text-violet-600"
          onClick={() => setShowQrScanner(true)}
          title="Scanner QR"
        >
          <QrCode className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
        </Button>
        <Button
          size="lg"
          className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 rounded-full shadow-lg"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
        </Button>
      </div>


      {/* Add Client Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <Select value={newState} onValueChange={(v) => setNewState(v as 'N' | 'R')}>
              <SelectTrigger className="h-11 sm:h-12"><SelectValue placeholder="État" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="N">🟢 Nouveau</SelectItem>
                <SelectItem value="R">🔵 Rendez-vous</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Nom du patient"
              value={newPatientName}
              onChange={(e) => {
                setNewPatientName(e.target.value);
                setLinkedAppointmentId(null); // Clear link if user manually changes name
              }}
              className="h-11 sm:h-12"
            />
            {linkedAppointmentId && (
              <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 py-1.5 flex items-center gap-1.5">
                <CalendarIcon className="h-3 w-3" /> Rendez-vous lié
              </Badge>
            )}
            <Input
              placeholder="Numéro de téléphone"
              value={newPhone}
              onChange={(e) => {
                setNewPhone(e.target.value);
                setLinkedAppointmentId(null);
              }}
              type="tel"
              className="h-11 sm:h-12"
            />

            {foundAppointments.length > 0 && !linkedAppointmentId && (
              <div className="space-y-2 p-3 bg-blue-50/50 border border-blue-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-1.5 px-1">
                  <Sparkles className="h-3 w-3" /> Suggestions (Avenir) :
                </p>
                <div className="flex flex-col gap-1.5">
                  {foundAppointments.map((appt) => {
                    const apptDate = new Date(appt.appointment_at);
                    const isToday = apptDate.toDateString() === new Date().toDateString();

                    return (
                      <Button
                        key={appt.id}
                        variant="outline"
                        size="sm"
                        className="justify-start h-auto py-2.5 px-3 text-left border-blue-100 bg-white hover:bg-blue-50 hover:border-blue-200 transition-all rounded-lg group"
                        onClick={() => {
                          setNewPatientName(appt.client_name);
                          setNewPhone(appt.client_phone);
                          setNewDoctorId(appt.doctor_id);
                          setLinkedAppointmentId(appt.id);
                          setFoundAppointments([]);
                          toast.success(`Patient lié : ${appt.client_name}`);
                        }}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isToday ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                            <CalendarIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-bold text-slate-900 truncate">{appt.client_name}</p>
                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border-0 ${isToday ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                {isToday ? "Aujourd'hui" : format(apptDate, 'dd/MM')}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                              <span>{appt.client_phone}</span>
                              <span>•</span>
                              <span className="truncate">{doctors.find(d => d.id === appt.doctor_id)?.name || '...'}</span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-blue-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
            <Select value={newDoctorId} onValueChange={setNewDoctorId}>
              <SelectTrigger className="h-11 sm:h-12"><SelectValue placeholder="Equipe" /></SelectTrigger>
              <SelectContent>
                {doctors.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleAddClient} className="w-full h-11 sm:h-12">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Client Modal */}
      <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Finaliser · {selectedEntry?.client_id}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-1 -m-1 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="space-y-3 sm:space-y-4 pb-2">
              <Input
                placeholder="Nom du client"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="h-11 sm:h-12"
              />
              <div className="relative">
                <Input
                  placeholder="Traitement"
                  value={treatment}
                  onChange={(e) => {
                    setTreatment(e.target.value);
                    setShowTreatmentSuggestions(true);
                  }}
                  onFocus={() => setShowTreatmentSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowTreatmentSuggestions(false), 150)}
                  className="h-11 sm:h-12"
                />
                {showTreatmentSuggestions && (
                  <div className="absolute left-0 right-0 mt-1 bg-card border rounded-lg overflow-hidden shadow-lg max-h-40 overflow-y-auto z-50 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {treatmentsList
                      .filter(t => {
                        const q = treatment.trim().toLowerCase();
                        if (!q) return false;
                        return t.toLowerCase().includes(q);
                      })
                      .slice(0, 8)
                      .map(s => (
                        <button
                          key={s}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); setTreatment(s); setShowTreatmentSuggestions(false); }}
                          className="w-full text-left px-3 py-2 hover:bg-secondary/50"
                        >
                          {s}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <Input
                placeholder="Montant total (DZD)"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                type="number"
                className="h-11 sm:h-12"
              />
              {historyTreatments.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Historique des traitements :</p>
                  <div className="flex flex-col gap-2">
                    {historyTreatments.map(ht => (
                      <Button
                        key={ht.treatment}
                        variant={selectedHistoryTreatment === ht.treatment ? 'secondary' : 'outline'}
                        size="sm"
                        className="justify-between"
                        onClick={() => {
                          setSelectedHistoryTreatment(ht.treatment);
                          setTreatment(ht.treatment);
                          setTotalAmount(ht.totalAmount?.toString() || '');
                          setTotalPaidPreviously(ht.totalPaid || 0);
                        }}
                      >
                        <span className="truncate">{ht.treatment}</span>
                        <span className="text-xs">{(ht.totalPaid || 0).toLocaleString()} / {(ht.totalAmount || 0).toLocaleString()} DZD</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                totalPaidPreviously > 0 && (
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex justify-between items-center">
                    <span className="text-xs font-medium text-emerald-800">Déjà payé (total history):</span>
                    <span className="text-sm font-bold text-emerald-700">{totalPaidPreviously.toLocaleString()} DZD</span>
                  </div>
                )
              )}
              <Input
                placeholder="Tranche payée aujourd'hui (DZD)"
                value={tranchePaid}
                onChange={(e) => setTranchePaid(e.target.value)}
                type="number"
                className="h-11 sm:h-12"
              />
              <div className="grid grid-cols-1 gap-4">
                <Input
                  placeholder="Note (optionnelle)"
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  className="h-11 sm:h-12"
                />
              </div>

              <div className="flex items-center space-x-2 py-2">
                <Checkbox
                  id="next-appt"
                  checked={hasNextAppt}
                  onCheckedChange={(checked) => setHasNextAppt(checked === true)}
                />
                <label
                  htmlFor="next-appt"
                  className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Prendre un rendez-vous ?
                </label>
              </div>

              {hasNextAppt && (
                <div className="space-y-3 p-3 bg-secondary/30 rounded-lg animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal h-10 px-3">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {nextApptDate ? format(nextApptDate, 'dd/MM/yy', { locale: fr }) : <span>Choisir...</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={nextApptDate} onSelect={setNextApptDate} locale={fr} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Heure</label>
                      <Input type="time" value={nextApptTime} onChange={(e) => setNextApptTime(e.target.value)} className="h-10" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Equipe</label>
                    <Select value={nextApptDoctorId} onValueChange={setNextApptDoctorId}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Equipe" /></SelectTrigger>
                      <SelectContent>
                        {doctors.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Motif du rendez-vous</label>
                    <Input
                      placeholder="Motif (optionnel)"
                      value={nextApptNote}
                      onChange={(e) => setNextApptNote(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
              )}

            </div>
          </div>
          <DialogFooter className="space-y-2 sm:space-y-0 sm:flex sm:gap-3">
            <Button onClick={handleReturnToQueue} variant="outline" className="w-full h-11 sm:h-12">
              Retour à la file
            </Button>
            <Button onClick={handleComplete} disabled={isCompletingClient} className="w-full h-11 sm:h-12">
              {isCompletingClient ? 'Enregistrement...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Edit Client Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le patient · {editEntry?.client_id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <Input
              placeholder="Nom du patient"
              value={editPatientName}
              onChange={(e) => setEditPatientName(e.target.value)}
              className="h-11 sm:h-12"
            />
            <Input
              placeholder="Numéro de téléphone"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              type="tel"
              className="h-11 sm:h-12"
            />
            <Select value={editState} onValueChange={(v) => setEditState(v as 'U' | 'N' | 'R')}>
              <SelectTrigger className="h-11 sm:h-12"><SelectValue placeholder="État" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="U">🔴 Urgence</SelectItem>
                <SelectItem value="N">🟢 Nouveau</SelectItem>
                <SelectItem value="R">🔵 Rendez-vous</SelectItem>
              </SelectContent>
            </Select>
            <Select value={editDoctorId} onValueChange={setEditDoctorId}>
              <SelectTrigger className="h-11 sm:h-12"><SelectValue placeholder="Equipe" /></SelectTrigger>
              <SelectContent>
                {doctors.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdate} className="w-full h-11 sm:h-12">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Add Expense Modal */}
      <Dialog open={showExpenseModal} onOpenChange={setShowExpenseModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-destructive" />
              Nouvelle Dépense Rapide
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Montant (DZD)</label>
              <Input
                placeholder="ex: 1500"
                type="number"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="h-12 text-lg font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Description / Motif</label>
              <Input
                placeholder="Café, Fournitures, Réparations..."
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
                className="h-12"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddExpense} disabled={savingExpense} className="w-full h-12 text-sm font-black uppercase tracking-widest bg-destructive hover:bg-destructive/90 text-white border-0">
              {savingExpense ? "Enregistrement..." : "Confirmer la dépense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Choice Modal */}
      <Dialog open={showChannelChoice} onOpenChange={setShowChannelChoice}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm p-0 overflow-hidden border-0 shadow-2xl rounded-[2.5rem] bg-white">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-10 text-center relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-primary/10 flex items-center justify-center mx-auto mb-6 relative z-10 animate-in zoom-in-50 duration-500">
              <MessageCircle className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2 relative z-10">
              <h3 className="text-2xl font-black text-foreground tracking-tight">Envoyer l'Avis ?</h3>
              <p className="text-sm text-muted-foreground px-4 leading-relaxed">
                Appuyez pour envoyer le lien de satisfaction à <span className="font-bold text-primary">{lastCompletedPatient?.name}</span>
              </p>
            </div>
          </div>

          <div className="p-8 space-y-4">
            <Button
              asChild
              className="w-full h-16 rounded-2xl bg-[#25D366] hover:bg-[#128C7E] text-white border-0 shadow-lg shadow-[#25D366]/20 font-bold text-lg gap-4 active:scale-95 transition-all"
            >
              <a
                href={(() => {
                  if (!lastCompletedPatient) return "#";
                  const msg = `Bonjour ${lastCompletedPatient.name}, avez-vous aimé votre traitement "${lastCompletedPatient.treatment}" à la CD Dental clinic ?\n\nLaissez-nous votre avis ici : https://passevite-hakim.vercel.app/review?phone=${lastCompletedPatient.phone}`;
                  let cleanPhone = lastCompletedPatient.phone.replace(/\s+/g, '');
                  if (cleanPhone.startsWith('0')) cleanPhone = '213' + cleanPhone.substring(1);
                  else if (!cleanPhone.startsWith('213')) cleanPhone = '213' + cleanPhone;
                  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
                })()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setTimeout(() => setShowChannelChoice(false), 500)}
              >
                <div className="bg-white/20 p-2 rounded-xl">
                  <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                WhatsApp
              </a>
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full h-16 rounded-2xl border-2 border-primary/20 hover:bg-primary/5 hover:border-primary/40 font-bold text-lg gap-4 active:scale-95 transition-all text-primary"
            >
              <a
                href={(() => {
                  if (!lastCompletedPatient) return "#";
                  const msg = `Bonjour ${lastCompletedPatient.name}, avez-vous aimé votre traitement "${lastCompletedPatient.treatment}" à la CD Dental clinic ?\n\nLaissez-nous votre avis ici : https://passevite-hakim.vercel.app/review?phone=${lastCompletedPatient.phone}`;
                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                  return `sms:${lastCompletedPatient.phone}${isIOS ? '&' : '?'}body=${encodeURIComponent(msg)}`;
                })()}
                onClick={() => setTimeout(() => setShowChannelChoice(false), 500)}
              >
                <div className="bg-primary/10 p-2 rounded-xl">
                  <Phone className="h-6 w-6" />
                </div>
                SMS Classique
              </a>
            </Button>

            <div className="pt-2">
              <Button
                variant="ghost"
                className="w-full h-12 rounded-xl text-muted-foreground hover:text-foreground text-xs font-black uppercase tracking-[0.2em] active:scale-95 transition-all"
                onClick={() => setShowChannelChoice(false)}
              >
                Ignorer pour le moment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Scanner Modal */}
      <QrScannerModal
        open={showQrScanner}
        onOpenChange={setShowQrScanner}
        onScanResult={async (phone, name) => {
          toast.success('QR code scanné !');

          // Search for the patient in completed_clients
          const { data: found } = await supabase
            .from('completed_clients')
            .select('client_name, phone, doctor_id')
            .eq('phone', phone)
            .order('completed_at', { ascending: false })
            .limit(1);

          if (found && found.length > 0) {
            const patient = found[0];
            // Auto-fill and open the add modal
            setNewPatientName(patient.client_name || name);
            setNewPhone(patient.phone);
            setNewState('R');
            if (patient.doctor_id) setNewDoctorId(patient.doctor_id);
            toast.success(`Patient trouvé : ${patient.client_name}`);
          } else {
            // Patient not found in history, fill with QR data
            setNewPatientName(name);
            setNewPhone(phone);
            setNewState('R');
            toast('Patient non trouvé dans l\'historique, données QR remplies.', { icon: 'ℹ️' });
          }

          // Also search for linked appointments
          const today = new Date();
          const start = new Date(today.setHours(0, 0, 0, 0)).toISOString();
          const { data: appts } = await supabase
            .from('appointments')
            .select('id, client_name, client_phone, doctor_id, appointment_at, status')
            .neq('status', 'attended')
            .neq('status', 'denied')
            .eq('client_phone', phone)
            .gte('appointment_at', start)
            .order('appointment_at', { ascending: true })
            .limit(1);

          if (appts && appts.length > 0) {
            const appt = appts[0];
            setNewPatientName(appt.client_name);
            setNewDoctorId(appt.doctor_id);
            setLinkedAppointmentId(appt.id);
            toast.success('Rendez-vous lié automatiquement !');
          }

          setShowAddModal(true);
        }}
      />
    </div>
  );
};

export default Accueil;
