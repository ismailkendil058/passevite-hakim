import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import {
    Search, LogOut, Calendar as CalendarIcon, FileText,
    Users, TrendingUp, Plus, Clock, History,
    PieChart, DollarSign, Activity, FileDown, Edit3,
    X, Printer, ClipboardList, CheckCircle2, ChevronRight,
    LayoutDashboard, MapPin, Phone, ArrowUpRight, User, Trash2,
    Calendar as CalIcon, MessageSquare, XCircle, Pencil, CreditCard, Wallet, ChevronLeft
} from 'lucide-react';
import { format, parseISO, startOfToday, endOfToday, startOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { ToothIcon } from '@/components/icons/ToothIcon';
import { cn, getPersistentAuth } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface LaboOrder {
    id: string;
    date_reception: string;
    client_name: string;
    type_travail: string;
    teinte: string;
    status: 'En cours' | 'Au labo' | 'Livré' | 'Problème';
    devis: number;
    versement: number;
    reste: number;
    patient_phone: string;
    doctor_id: string;
    created_at: string;
}

const TYPE_SUGGESTIONS = ['B ceramique', 'Zirconne', 'Résine', 'Bridge', '4 éléments'];
const TEINTE_OPTIONS = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'D2'];
const STATUS_OPTIONS = ['En cours', 'Au labo', 'Livré', 'Problème'];
const DEFAULT_LABOS = ['NewSmile', 'MEDDOUR', 'Youcef', 'new smille'];

const MedecinDashboard = () => {
    const navigate = useNavigate();
    const { signOut } = useAuth();

    // LOGGED IN DOCTOR INFO
    const [doctorInfo, setDoctorInfo] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        const authData = getPersistentAuth('doctor_auth');
        if (authData) {
            setDoctorInfo(JSON.parse(authData));
        } else {
            navigate('/doctor/login');
        }
    }, [navigate]);

    // DASHBOARD DATA
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // CALENDAR STATE
    const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
    const parsedAppointments = useMemo(() => {
        return appointments.map(a => ({
            ...a,
            startOfDayTime: startOfDay(parseISO(a.appointment_at)).getTime()
        }));
    }, [appointments]);

    // FILTERS & SEARCH
    const [searchOrdonnance, setSearchOrdonnance] = useState('');
    const [searchPatient, setSearchPatient] = useState('');
    const [patientFilter, setPatientFilter] = useState('all');

    // SELECTED PATIENT FOR FICHE MALADE
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    const [isPatientDialogOpen, setIsPatientDialogOpen] = useState(false);
    const [viewingNote, setViewingNote] = useState<string | null>(null);

    // LABO STATE
    const [orders, setOrders] = useState<LaboOrder[]>([]);
    const [laboLoading, setLaboLoading] = useState(true);
    const [laboSearchQuery, setLaboSearchQuery] = useState('');
    const [laboStatusFilter, setLaboStatusFilter] = useState('Tous');
    const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [showLaboAddModal, setShowLaboAddModal] = useState(false);
    const [showLaboPaymentModal, setShowLaboPaymentModal] = useState(false);
    const [editingLaboId, setEditingLaboId] = useState<string | null>(null);
    const [customLabo, setCustomLabo] = useState(false);
    const [laboFormData, setLaboFormData] = useState<Partial<LaboOrder>>({
        date_reception: format(new Date(), 'yyyy-MM-dd'),
        status: 'En cours',
        devis: 0,
        versement: 0
    });
    const [laboPaymentAmount, setLaboPaymentAmount] = useState('');
    const [laboPaymentOrder, setLaboPaymentOrder] = useState<LaboOrder | null>(null);

    // Helper for formatting frequency line
    const formatFrequencyLine = (count: number, timing: string, unit: string = 'comprimé(s)') => {
        if (!count) return '';
        const timingMap: Record<string, string> = {
            'avant': 'avant les repas',
            'apres': 'après les repas',
            'pendant': 'pendant les repas',
            'soir': 'le soir au coucher'
        };
        const tText = timingMap[timing] || '';
        return `${count} ${unit} ${tText}`.trim();
    };

    // ORDONNANCE MODAL STATE
    const [showOrdonnanceModal, setShowOrdonnanceModal] = useState(false);
    const [ordonnanceFormData, setOrdonnanceFormData] = useState({
        patient_name: '',
        age: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        medications: [{ name: '', dosage: '', duree: '', frequency_count: 1, frequency_unit: 'comprimé(s)', timing: 'apres', instructions: '' }],
        notes: ''
    });
    const [savingOrdonnance, setSavingOrdonnance] = useState(false);

    // Available Medications from DB
    const [dbMedications, setDbMedications] = useState<any[]>([]);
    const [showAddMedModal, setShowAddMedModal] = useState(false);
    const [newMedFormData, setNewMedFormData] = useState({
        name: '',
        dosage: '',
        duree: '',
        frequency_count: 1,
        frequency_unit: 'comprimé(s)',
        timing: 'apres'
    });
    const [savingNewMed, setSavingNewMed] = useState(false);

    const normalizeMedication = (med: any) => ({
        ...med,
        dosage: med.dosage || med.default_dosage || '',
        duree: med.duree || med.default_duration || '',
        frequency_count: med.frequency_count ?? med.default_frequency_count ?? 1,
        frequency_unit: med.frequency_unit || med.default_frequency_unit || 'comprimé(s)',
        timing: med.timing || med.default_timing || 'apres',
        variants: med.variants || []
    });

    const displayStatus = (s: string) => s === 'Problème' ? 'daulirence' : s;

    const fetchMeds = async () => {
        try {
            const { data, error } = await supabase
                .from('medications')
                .select('*')
                .order('name');
            if (error) throw error;
            if (data) {
                setDbMedications(data.map(normalizeMedication));
            }
        } catch (err) {
            console.error('Error fetching medications:', err);
            toast.error('Erreur lors du chargement des médicaments');
        }
    };

    useEffect(() => {
        fetchMeds();
    }, []);

    const handleSaveNewMed = async () => {
        if (!newMedFormData.name) {
            toast.error('Le nom du médicament est obligatoire');
            return;
        }
        setSavingNewMed(true);
        try {
            const { error } = await supabase.from('medications').insert([
                {
                    name: newMedFormData.name,
                    default_dosage: newMedFormData.dosage,
                    default_duration: newMedFormData.duree,
                    default_frequency_count: newMedFormData.frequency_count,
                    default_frequency_unit: newMedFormData.frequency_unit,
                    default_timing: newMedFormData.timing
                }
            ]);

            if (error) throw error;

            toast.success('Médicament ajouté au catalogue');
            setShowAddMedModal(false);
            setNewMedFormData({
                name: '',
                dosage: '',
                duree: '',
                frequency_count: 1,
                frequency_unit: 'comprimé(s)',
                timing: 'apres'
            });
            await fetchMeds();
        } catch (err: any) {
            toast.error('Erreur: ' + err.message);
        } finally {
            setSavingNewMed(false);
        }
    };

    const hydrateMedicationFromVariant = (med: any, variantIdx: number, itemIdx: number) => {
        if (!med) return;

        const variants = med.variants || [];
        const variant = variants[variantIdx] || null;

        // Use variant data if available, otherwise fall back to direct values and default columns
        const dosage = variant?.dosage || med.dosage || med.default_dosage || '';
        const duree = variant?.duration || med.duree || med.default_duration || '';
        const frequency_count = variant?.frequency_count ?? med.frequency_count ?? med.default_frequency_count ?? 1;
        const frequency_unit = variant?.frequency_unit || med.frequency_unit || med.default_frequency_unit || 'comprimé(s)';
        const timing = variant?.timing || med.timing || med.default_timing || 'apres';

        console.log('[Hydrate]', med.name, { dosage, duree, frequency_count, frequency_unit, timing });

        // Functional update avoids stale closure issues
        setOrdonnanceFormData(prev => {
            const newMeds = [...prev.medications];
            // @ts-ignore
            newMeds[itemIdx] = {
                ...newMeds[itemIdx],
                name: med.name,
                dosage,
                duree,
                frequency_count,
                frequency_unit,
                timing
            };
            return { ...prev, medications: newMeds };
        });
    };


    // Fetch Patient History (Appointments & Ordonnances)
    const { data: patientHistory, isLoading: isLoadingHistory } = useQuery({
        queryKey: ['patient-history', selectedPatient?.phone, selectedPatient?.client_name],
        enabled: !!selectedPatient,
        queryFn: async () => {
            const [appts, ords] = await Promise.all([
                supabase.from('appointments').select('*, doctor:doctors(*)').eq('client_phone', selectedPatient.phone).order('appointment_at', { ascending: false }),
                supabase.from('prescriptions').select('*').eq('patient_name', selectedPatient.client_name).order('created_at', { ascending: false })
            ]);
            return { appointments: appts.data || [], ordonnances: ords.data || [] };
        }
    });

    const fetchDashboardData = async () => {
        if (!doctorInfo) return;
        setLoading(true);
        try {
            const { data: rxData } = await supabase
                .from('prescriptions')
                .select('*')
                .eq('doctor_id', doctorInfo.id)
                .order('created_at', { ascending: false });
            if (rxData) setPrescriptions(rxData);

            const { data: aptData } = await supabase
                .from('appointments')
                .select('*')
                .eq('doctor_id', doctorInfo.id)
                .order('appointment_at', { ascending: false });
            if (aptData) setAppointments(aptData);

            const { data: clientData } = await supabase
                .from('completed_clients')
                .select('*')
                .eq('doctor_id', doctorInfo.id)
                .order('completed_at', { ascending: false });
            if (clientData) setPatients(clientData);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            toast.error('Erreur lors du chargement des données');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (doctorInfo) {
            fetchDashboardData();
        }
    }, [doctorInfo]);

    const handleSaveOrdonnance = async () => {
        if (!doctorInfo) return;
        if (!ordonnanceFormData.patient_name || ordonnanceFormData.medications.some(m => !m.name)) {
            toast.error('Veuillez remplir au moins le nom du patient et un médicament');
            return;
        }

        setSavingOrdonnance(true);
        try {
            const { error } = await supabase.from('prescriptions').insert({
                doctor_id: doctorInfo.id,
                patient_name: ordonnanceFormData.patient_name,
                prescription_date: ordonnanceFormData.date || format(new Date(), 'yyyy-MM-dd'),
                medications: ordonnanceFormData.medications,
                notes: ordonnanceFormData.notes
            });

            if (error) throw error;

            toast.success('Ordonnance créée avec succès');
            setShowOrdonnanceModal(false);
            setOrdonnanceFormData({
                patient_name: '',
                age: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                medications: [{ name: '', dosage: '', duree: '', frequency_count: 1, frequency_unit: 'comprimé(s)', timing: 'apres', instructions: '' }],
                notes: ''
            });
            fetchDashboardData();
        } catch (err) {
            console.error(err);
            toast.error('Erreur lors de la création');
        } finally {
            setSavingOrdonnance(false);
        }
    };

    const addMedication = () => {
        setOrdonnanceFormData({
            ...ordonnanceFormData,
            medications: [...ordonnanceFormData.medications, { name: '', dosage: '', duree: '', frequency_count: 1, frequency_unit: 'comprimé(s)', timing: 'apres', instructions: '' }]
        });
    };

    const removeMedication = (index: number) => {
        if (ordonnanceFormData.medications.length <= 1) return;
        const newMeds = [...ordonnanceFormData.medications];
        newMeds.splice(index, 1);
        setOrdonnanceFormData({ ...ordonnanceFormData, medications: newMeds });
    };

    const updateMedication = (index: number, field: string, value: string) => {
        const newMeds = [...ordonnanceFormData.medications];
        // @ts-ignore
        newMeds[index][field] = value;
        setOrdonnanceFormData({ ...ordonnanceFormData, medications: newMeds });
    };

    const handlePrintOrdonnance = (rx: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const medsHtml = rx.medications.map((m: any) => {
            const timingMap: Record<string, string> = {
                'avant': 'avant le repas',
                'apres': 'après le repas',
                'pendant': 'pendant le repas',
                'soir': 'le soir'
            };
            const hTiming = timingMap[m.timing] || m.timing || '';

            return `
            <div style="margin-bottom: 5mm; font-family: 'Lato', sans-serif; break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1mm;">
                    <span style="font-size: 13pt; font-weight: 700; color: #000; text-transform: uppercase;">
                        ${m.name}${m.frequency_unit ? ` (${m.frequency_unit.replace('(s)', '')})` : ''}
                    </span>
                    <span style="font-size: 10pt; font-weight: 400; color: #2a8bbf;">Qsp: ${m.duree || m.duration || '--'}</span>
                </div>
                <div style="font-size: 12pt; color: #333; font-weight: 400; padding-left: 4mm; line-height: 1.4; font-style: italic;">
                    ${m.dosage ? `${m.dosage} ` : ''}${m.frequency_count ? `${m.frequency_count} fois par jour ${hTiming}` : (m.instructions || '')}
                </div>
            </div>
        `;
        }).join('');

        const patientName = rx.patient_name || '';
        const nameParts = patientName.split(' ');
        const nom = nameParts[0] || '';
        const prenom = nameParts.slice(1).join(' ') || '';

        printWindow.document.write(`
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Ordonnance — ${rx.patient_name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400&family=Lato:wght@300;400;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: transparent;
    font-family: 'Lato', sans-serif;
  }

  .page {
    width: 210mm;
    height: 297mm;
    background: #fff;
    padding: 10mm 15mm;
    display: flex;
    flex-direction: column;
    margin: 0 auto;
    position: relative;
    overflow: hidden;
  }

  .clinic-brand {
    text-align: center;
    font-family: 'Playfair Display', serif;
    font-size: 32pt;
    font-weight: 700;
    color: #3a9fd1;
    margin-bottom: 8mm;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 5mm;
    border-bottom: 1px solid #f0f7fb;
    padding-bottom: 3mm;
  }

  .header {
    display: flex;
    align-items: flex-start;
    gap: 15px;
  }

  .logo-wrap {
    flex-shrink: 0;
    width: 50px;
    height: 55px;
  }

  .logo-wrap svg { width: 100%; height: 100%; }

  .clinic-name {
    font-size: 14pt;
    font-weight: 700;
    color: #2a8bbf;
    margin-bottom: 1mm;
  }

  .doctor-title {
    font-size: 11pt;
    font-weight: 700;
    color: #2a8bbf;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 2mm;
  }

  .clinic-address {
    font-size: 9pt;
    font-weight: 300;
    color: #5ab0d8;
    line-height: 1.4;
  }

  .clinic-phone {
    font-size: 9pt;
    color: #2a8bbf;
    font-weight: 400;
    margin-top: 1mm;
  }

  .patient-fields {
    display: flex;
    flex-direction: column;
    gap: 3mm;
    min-width: 70mm;
  }

  .field-line {
    display: flex;
    align-items: baseline;
    gap: 6px;
    white-space: nowrap;
  }

  .field-label {
    font-weight: 700;
    font-size: 11pt;
    color: #2a8bbf;
  }

  .field-dots {
    flex: 1;
    min-width: 40mm;
    margin-bottom: 2px;
    padding-left: 3mm;
    font-size: 11pt;
    color: #333;
    font-weight: 400;
  }

  .age-field {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .age-dots {
    width: 25mm;
    margin-bottom: 2px;
    padding-left: 3mm;
    font-size: 11pt;
    color: #333;
    font-weight: 400;
  }

  .ordonnance-title {
    text-align: center;
    font-size: 16pt;
    font-weight: 700;
    color: #1a6fa0;
    letter-spacing: 0.2em;
    text-decoration: underline;
    text-underline-offset: 5px;
    margin: 8mm 0 10mm 0;
  }

  .body-area {
    flex: 1;
    overflow: hidden;
    padding: 0 5mm;
  }

  .footer {
    border-top: 1px solid #f0f7fb;
    padding-top: 5mm;
    margin-top: 5mm;
    display: flex;
    justify-content: flex-end;
  }

  .sig-block {
    text-align: center;
    min-width: 50mm;
  }

  .sig-label {
    font-weight: 700;
    color: #2a8bbf;
    font-size: 10pt;
    margin-bottom: 15mm;
    display: block;
  }

  .sig-line {
    width: 100%;
  }

  @media print {
    body { background: white; }
    .page { margin: 0; box-shadow: none; }
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="clinic-brand">CD Dental Clinic</div>

  <div class="top-row">
    <div class="header-left">
      <div class="logo-wrap">
        <img src="/Dr hakim.png" alt="${doctorInfo?.name || 'Dr. Hakim'}" style="width: 100%; height: 100%; object-fit: contain;" />
      </div>
      <div class="clinic-info">
        <div class="clinic-name">${doctorInfo?.name || 'Dr. Hakim'}</div>
        <div class="doctor-title">Chirurgien Dentiste</div>
        <div class="clinic-address">
          Zone Aissat Mustapha<br>
          Cité 90 lgts " ENCG " Bt 8<br>
          N° 01 Réghaia Alger
        </div>
        <div class="clinic-phone">0796 66 73 49 / 020 25 49 12</div>
      </div>
    </div>

    <div class="patient-fields">
      <div class="field-line">
        <span class="field-label">Réghaia le :</span>
        <span class="field-dots">${new Date(rx.prescription_date || rx.created_at).toLocaleDateString('fr-FR')}</span>
      </div>
      <div class="field-line">
        <span class="field-label">Nom :</span>
        <span class="field-dots">${rx.patient_name}</span>
      </div>
      <div class="age-field">
        <span class="field-label">Age :</span>
        <span class="age-dots">${rx.age || '--'} ans</span>
      </div>
    </div>
  </div>

  <div class="ordonnance-title">ORDONNANCE</div>

  <div class="body-area">
    ${medsHtml}
    ${rx.notes ? `<div style="margin-top: 8mm; font-size: 10pt; color: #666; font-style: italic; border-top: 1px dashed #aad4eb; padding-top: 3mm;">Note : ${rx.notes}</div>` : ''}
  </div>

  <div class="footer">
  </div>

</div>
<script>
  window.onload = () => {
    window.print();
    setTimeout(() => { window.close(); }, 500);
  };
</script>
</body>
</html>
`);
        printWindow.document.close();
    };

    // LABO FUNCTIONS
    const fetchLaboOrders = async (showLoading = true) => {
        if (!doctorInfo) return;
        if (showLoading) setLaboLoading(true);
        // @ts-ignore
        let query = supabase
            .from('labo_orders')
            .select('*')
            .eq('doctor_id', doctorInfo.id)
            .gte('date_reception', dateFrom)
            .lte('date_reception', dateTo)
            .order('date_reception', { ascending: false });

        const { data, error } = await query;
        if (error) {
            toast.error('Erreur lors du chargement des commandes labo');
            console.error(error);
        } else {
            // Calculate reste on the fly
            const mapped = (data || []).map((o: any) => ({
                ...o,
                reste: (o.devis || 0) - (o.versement || 0)
            }));
            setOrders(mapped as LaboOrder[]);
        }
        if (showLoading) setLaboLoading(false);
    };

    useEffect(() => {
        if (doctorInfo) {
            fetchLaboOrders();
        }

        const channel = supabase
            .channel('labo_orders_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'labo_orders' }, () => {
                fetchLaboOrders(false);
            })
            .subscribe();

        const intervalId = setInterval(() => fetchLaboOrders(false), 500);

        return () => {
            clearInterval(intervalId);
            supabase.removeChannel(channel);
        };
    }, [dateFrom, dateTo, doctorInfo]);

    const filteredLaboOrders = useMemo(() => {
        return orders.filter(o => {
            const matchSearch = !laboSearchQuery ||
                o.client_name?.toLowerCase().includes(laboSearchQuery.toLowerCase()) ||
                o.type_travail?.toLowerCase().includes(laboSearchQuery.toLowerCase());
            // o.laboratoire?.toLowerCase().includes(laboSearchQuery.toLowerCase()) ||
            // o.n_fiche?.toLowerCase().includes(laboSearchQuery.toLowerCase());

            const matchStatus = laboStatusFilter === 'Tous' || o.status === laboStatusFilter;

            return matchSearch && matchStatus;
        });
    }, [orders, laboSearchQuery, laboStatusFilter]);

    const laboStats = useMemo(() => {
        let totalDevis = 0;
        let totalCashed = 0;
        let totalReste = 0;
        let waitingLabCount = 0;

        filteredLaboOrders.forEach(o => {
            totalDevis += (o.devis || 0);
            totalCashed += (o.versement || 0);
            totalReste += (o.reste || 0);
            if (o.status === 'Au labo') waitingLabCount++;
        });

        return { totalDevis, totalCashed, totalReste, waitingLabCount };
    }, [filteredLaboOrders]);

    const handleLaboSave = async () => {
        try {
            const payload = {
                date_reception: laboFormData.date_reception || format(new Date(), 'yyyy-MM-dd'),
                client_name: laboFormData.client_name || '',
                type_travail: laboFormData.type_travail || '',
                teinte: laboFormData.teinte || null,
                status: laboFormData.status || 'En cours',
                devis: laboFormData.devis || 0,
                versement: laboFormData.versement || 0,
                patient_phone: laboFormData.patient_phone || null,
                doctor_id: doctorInfo?.id
            };

            if (!payload.client_name || !payload.type_travail) {
                toast.error('Veuillez remplir les champs obligatoires (Nom, Type)');
                return;
            }

            if (editingLaboId) {
                const { error } = await supabase.from('labo_orders').update(payload).eq('id', editingLaboId);
                if (error) throw error;
                toast.success('Commande mise à jour');
            } else {
                const { error } = await supabase.from('labo_orders').insert([payload]);
                if (error) throw error;
                toast.success('Nouvelle commande ajoutée');
            }

            setShowLaboAddModal(false);
            resetLaboForm();
        } catch (error: any) {
            toast.error('Erreur: ' + error.message);
        }
    };

    const handleLaboDelete = async (id: string) => {
        try {
            const { error } = await supabase.from('labo_orders').delete().eq('id', id);
            if (error) throw error;
            toast.success('Commande supprimée');
        } catch (error: any) {
            toast.error('Erreur lors de la suppression');
        }
    };

    const handleLaboStatusChange = async (id: string, newStatus: string) => {
        try {
            // Optimistic update
            setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus as any } : o));
            const { error } = await supabase.from('labo_orders').update({ status: newStatus }).eq('id', id);
            if (error) throw error;
            toast.success('Statut mis à jour');
        } catch (error: any) {
            toast.error('Erreur: ' + error.message);
            fetchLaboOrders(); // rollback
        }
    };

    const handleLaboPaymentSubmit = async () => {
        if (!laboPaymentOrder || !laboPaymentAmount) return;
        try {
            const amount = parseFloat(laboPaymentAmount);
            if (isNaN(amount) || amount <= 0) {
                toast.error('Montant invalide');
                return;
            }

            const newVal = (laboPaymentOrder.versement || 0) + amount;

            // Optimistic update
            setOrders(orders.map(o => o.id === laboPaymentOrder.id ? {
                ...o,
                versement: newVal,
                reste: (o.devis || 0) - newVal
            } : o));

            const { error } = await supabase.from('labo_orders').update({ versement: newVal }).eq('id', laboPaymentOrder.id);
            if (error) throw error;

            toast.success('Versement ajouté');
            setShowLaboPaymentModal(false);
            setLaboPaymentOrder(null);
            setLaboPaymentAmount('');
        } catch (error: any) {
            toast.error('Erreur: ' + error.message);
            fetchLaboOrders(); // rollback
        }
    };

    const resetLaboForm = () => {
        setEditingLaboId(null);
        setCustomLabo(false);
        setLaboFormData({
            date_reception: format(new Date(), 'yyyy-MM-dd'),
            status: 'En cours',
            devis: 0,
            versement: 0,
            client_name: '',
            type_travail: '',
            teinte: '',
            patient_phone: '',
        });
    };

    const openLaboEdit = (order: LaboOrder) => {
        setEditingLaboId(order.id);
        setLaboFormData({
            date_reception: order.date_reception,
            client_name: order.client_name,
            type_travail: order.type_travail,
            teinte: order.teinte,
            status: order.status,
            devis: order.devis,
            versement: order.versement,
            patient_phone: order.patient_phone,
        });
        setShowLaboAddModal(true);
    };

    const getLaboRowClass = (order: LaboOrder) => {
        if (order.status === 'Livré' && order.reste === 0) {
            return 'bg-green-50/50 border-l-4 border-green-500';
        }
        if (order.status === 'Au labo') {
            return 'bg-yellow-50/50 border-l-4 border-yellow-400';
        }
        if (order.status === 'Problème' || (order.status === 'Livré' && order.reste > 0)) {
            return 'bg-red-50/50 border-l-4 border-red-500';
        }
        return '';
    };

    const getLaboStatutBadge = (status: string) => {
        switch (status) {
            case 'Livré':
                return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Livré</Badge>;
            case 'Au labo':
                return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200">Au labo</Badge>;
            case 'Problème':
                return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">daulirence</Badge>;
            default:
                return <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">En cours</Badge>;
        }
    };

    const handleSignOut = async () => {
        await signOut();
        toast.success('Déconnecté avec succès');
        navigate('/');
    };

    // FILTERED DATA
    const filteredPrescriptions = useMemo(() => {
        return prescriptions.filter(rx =>
            rx.patient_name.toLowerCase().includes(searchOrdonnance.toLowerCase()) ||
            JSON.stringify(rx.medications).toLowerCase().includes(searchOrdonnance.toLowerCase())
        );
    }, [prescriptions, searchOrdonnance]);

    const filteredPatientsList = useMemo(() => {
        return patients.filter(p => {
            const matchesSearch = p.client_name.toLowerCase().includes(searchPatient.toLowerCase()) || p.phone.includes(searchPatient);
            const matchesStatus = patientFilter === 'all' || (patientFilter === 'completed' ? p.state === 'fully_treated' : p.state !== 'fully_treated');
            return matchesSearch && matchesStatus;
        });
    }, [patients, searchPatient, patientFilter]);

    // ANALYTICS CALCULATIONS
    const [selectedRevenueDate, setSelectedRevenueDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    const selectedDayRevenue = useMemo(() => {
        const targetDate = new Date(selectedRevenueDate);
        targetDate.setHours(0, 0, 0, 0);
        const targetEnd = new Date(selectedRevenueDate);
        targetEnd.setHours(23, 59, 59, 999);

        return patients.reduce((acc, p) => {
            const pDate = new Date(p.completed_at);
            return (pDate >= targetDate && pDate <= targetEnd) ? acc + (p.tranche_paid || 0) : acc;
        }, 0);
    }, [patients, selectedRevenueDate]);

    const monthlyData = useMemo(() => {
        const last6Months = Array.from({ length: 6 }).map((_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() - (5 - i));
            return format(date, 'MMM', { locale: fr });
        });

        const revenuePerMonth = last6Months.map(month => {
            const total = patients.reduce((acc, p) => {
                const pMonth = format(new Date(p.completed_at), 'MMM', { locale: fr });
                return pMonth === month ? acc + (p.tranche_paid || 0) : acc;
            }, 0);
            return { month, revenue: total };
        });

        return revenuePerMonth;
    }, [patients]);


    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header following RendezVous.tsx style */}
            <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/80 backdrop-blur-md z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-xl">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-foreground italic">PasseVite Equipe</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Tableau de bord de soins</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex flex-col text-right">
                        <span className="text-sm font-bold text-slate-700">{doctorInfo ? doctorInfo.name : 'Chargement...'}</span>
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Session Active</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-9 w-9 text-rose-500 hover:bg-rose-50 rounded-full">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            <main className="p-4 lg:p-6 flex-1 space-y-6 lg:max-w-full mx-auto w-full">
                <Tabs defaultValue="ordonnances" className="w-full">
                    <TabsList className="grid w-full grid-cols-5 bg-muted/50 p-1 rounded-xl h-12">
                        <TabsTrigger value="ordonnances" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <FileText className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Ordonnances</span>
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <CalendarIcon className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Agenda</span>
                        </TabsTrigger>
                        <TabsTrigger value="patients" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <Users className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Patients</span>
                        </TabsTrigger>
                        <TabsTrigger value="labo" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <ToothIcon className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Labo</span>
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <PieChart className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Analyses</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* ORDONNANCES CONTENT */}
                    <TabsContent value="ordonnances" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <h1 className="text-2xl font-black italic text-slate-800">Historique Ordonnances</h1>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <div className="relative flex-1 sm:w-80">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            placeholder="Rechercher patient ou médicament..."
                                            value={searchOrdonnance}
                                            onChange={e => setSearchOrdonnance(e.target.value)}
                                            className="pl-10 h-11 border-slate-200 rounded-xl"
                                        />
                                    </div>
                                    <Button onClick={() => setShowOrdonnanceModal(true)} className="rounded-xl h-11 px-6 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90">
                                        <Plus className="h-4 w-4 mr-2" /> Nouvelle
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {loading ? (
                                    Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 bg-slate-100 animate-pulse rounded-3xl" />)
                                ) : filteredPrescriptions.length === 0 ? (
                                    <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border border-dashed">
                                        <FileText className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Aucune ordonnance trouvée</p>
                                    </div>
                                ) : (
                                    filteredPrescriptions.map(rx => (
                                        <Card key={rx.id} className="border-none shadow-premium bg-white group hover:shadow-xl transition-all">
                                            <CardContent className="p-6">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                                                            <FileText className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-slate-800 leading-tight">{rx.patient_name}</h3>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{format(new Date(rx.prescription_date || rx.created_at), 'dd MMMM yyyy', { locale: fr })}</p>
                                                        </div>
                                                    </div>
                                                    <div className="opacity-0 group-hover:opacity-100 transition-all flex gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:bg-indigo-50 rounded-lg" onClick={() => handlePrintOrdonnance(rx)}>
                                                            <Printer className="h-4 w-4" />
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-lg">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle className="font-black italic text-rose-500">Supprimer l'ordonnance ?</AlertDialogTitle>
                                                                    <AlertDialogDescription className="font-medium">Cette action est irréversible.</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel className="rounded-xl font-bold">Annuler</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={async () => {
                                                                        await supabase.from('prescriptions').delete().eq('id', rx.id);
                                                                        toast.success('Ordonnance supprimée');
                                                                        fetchDashboardData();
                                                                    }} className="bg-rose-500 hover:bg-rose-600 rounded-xl font-bold">Confirmer</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </div>
                                                <div className="space-y-1 mt-4">
                                                    {rx.medications.slice(0, 3).map((m: any, i: number) => (
                                                        <div key={i} className="flex justify-between items-center text-xs">
                                                            <span className="text-slate-600 font-medium">• {m.name}</span>
                                                            <span className="text-[10px] text-slate-400">{m.dosage}</span>
                                                        </div>
                                                    ))}
                                                    {rx.medications.length > 3 && (
                                                        <p className="text-[10px] text-primary font-bold mt-2">+{rx.medications.length - 3} autres médicaments</p>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* CALENDAR CONTENT */}
                    <TabsContent value="calendar" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                            <Card className="border-none shadow-premium bg-white rounded-3xl overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="p-6 border-b bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div>
                                            <h3 className="font-black italic text-xl text-primary">Emploi du Temps</h3>
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{format(calendarDate || new Date(), 'EEEE dd MMMM yyyy', { locale: fr })}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" className="h-10 px-4 text-xs font-bold uppercase tracking-widest rounded-xl" onClick={() => setCalendarDate(new Date())}>Aujourd'hui</Button>
                                        </div>
                                    </div>

                                    <div className="p-4 sm:p-8">
                                        <ScrollArea className="h-[750px] pr-4">
                                            <div className="grid grid-cols-[60px_1fr] gap-6">
                                                {/* Time labels */}
                                                <div className="space-y-[80px] pt-10 text-[10px] font-black text-slate-300 text-right pr-4 border-r border-slate-100">
                                                    {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'].map(t => (
                                                        <div key={t} className="h-0 flex items-center justify-end">{t}</div>
                                                    ))}
                                                </div>

                                                {/* Single Column for current Doctor */}
                                                <div className="relative bg-slate-50/30 rounded-3xl min-h-[1300px] border border-dashed border-slate-200">
                                                    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md p-4 border-b text-center font-black text-xs text-primary uppercase tracking-[0.2em] rounded-t-3xl">
                                                        Planning {doctorInfo?.name}
                                                    </div>

                                                    {/* Appointments for this doctor on selected current day */}
                                                    {parsedAppointments
                                                        .filter(a => a.status !== 'denied' && a.doctor_id === doctorInfo?.id && a.startOfDayTime === startOfDay(calendarDate || new Date()).getTime())
                                                        .map(appt => {
                                                            const date = parseISO(appt.appointment_at);
                                                            const hours = date.getHours();
                                                            const minutes = date.getMinutes();
                                                            const offset = (hours - 8) * 80 + (minutes / 60) * 80 + 64; // Adjusted offset for header

                                                            return (
                                                                <Card
                                                                    key={appt.id}
                                                                    className={cn(
                                                                        "absolute left-4 right-4 shadow-xl border-l-4 p-4 rounded-2xl cursor-pointer hover:scale-[1.02] transition-all z-20 group",
                                                                        appt.status === 'completed' ? 'border-l-emerald-500 bg-white' : 'border-l-primary bg-white'
                                                                    )}
                                                                    style={{ top: `${offset}px`, height: '80px' }}
                                                                    onClick={() => { setSelectedPatient(patients.find(p => p.phone === appt.client_phone)); setIsPatientDialogOpen(true); }}
                                                                >
                                                                    <div className="flex justify-between items-start">
                                                                        <div>
                                                                            <p className="text-[10px] font-black text-primary mb-1 uppercase tracking-widest">{format(date, 'HH:mm')}</p>
                                                                            <p className="text-sm font-black text-slate-800 leading-tight">{appt.client_name}</p>
                                                                        </div>
                                                                        <Badge className={cn("text-[8px] font-black rounded-full h-5",
                                                                            appt.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-primary/5 text-primary'
                                                                        )}>
                                                                            {appt.status.toUpperCase()}
                                                                        </Badge>
                                                                    </div>
                                                                </Card>
                                                            );
                                                        })
                                                    }
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-6">
                                <Card className="border-none shadow-premium bg-white rounded-3xl p-2">
                                    <Calendar
                                        mode="single"
                                        selected={calendarDate}
                                        onSelect={setCalendarDate}
                                        className="rounded-2xl"
                                        locale={fr}
                                    />
                                </Card>

                                <Card className="border-none shadow-premium bg-primary text-white p-6 rounded-[2rem]">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-10 w-10 bg-white/20 rounded-2xl flex items-center justify-center">
                                            <CalIcon className="h-5 w-5 text-white" />
                                        </div>
                                        <h4 className="font-black italic text-lg">Résumé Journée</h4>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">À venir</span>
                                            <span className="text-2xl font-black">
                                                {parsedAppointments.filter(a => a.doctor_id === doctorInfo?.id && a.status === 'scheduled' && a.startOfDayTime === startOfDay(calendarDate || new Date()).getTime()).length}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Terminés</span>
                                            <span className="text-2xl font-black">
                                                {parsedAppointments.filter(a => a.doctor_id === doctorInfo?.id && a.status === 'completed' && a.startOfDayTime === startOfDay(calendarDate || new Date()).getTime()).length}
                                            </span>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    {/* PATIENTS CONTENT */}
                    <TabsContent value="patients" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <h1 className="text-2xl font-black italic text-slate-800">Votre Fichier Patient</h1>
                                <div className="relative w-full sm:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Nom ou téléphone..."
                                        value={searchPatient}
                                        onChange={e => setSearchPatient(e.target.value)}
                                        className="pl-10 h-11 border-slate-200 rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredPatientsList.map(p => (
                                    <Card key={p.id} className="border-none shadow-premium bg-white hover:shadow-lg transition-all cursor-pointer group" onClick={() => { setSelectedPatient(p); setIsPatientDialogOpen(true); }}>
                                        <CardContent className="p-6">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black text-xl group-hover:bg-primary group-hover:text-white transition-all">
                                                    {p.client_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800">{p.client_name}</h3>
                                                    <p className="text-xs text-slate-400">{p.phone}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2 border-t pt-4">
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span className="text-slate-400 uppercase tracking-widest">Traitement</span>
                                                    <span className="text-slate-700">{p.treatment}</span>
                                                </div>
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span className="text-slate-400 uppercase tracking-widest">Dernière séance</span>
                                                    <span className="text-slate-700">{format(new Date(p.completed_at), 'dd/MM/yy')}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    {/* LABO CONTENT */}
                    <TabsContent value="labo" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <h1 className="text-2xl font-black italic text-slate-800">Suivi Travaux Labo</h1>
                                <Button onClick={() => { resetLaboForm(); setShowLaboAddModal(true); }} className="rounded-xl h-11 px-6 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90">
                                    <Plus className="h-4 w-4 mr-2" /> Nouvel Envoi
                                </Button>
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-2 gap-3">
                                <Card className="border-0 shadow-premium bg-white">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                            <Wallet className="h-4 w-4 text-primary" />
                                            <h3 className="text-xs font-bold uppercase tracking-widest">Total Devis</h3>
                                        </div>
                                        <p className="text-2xl font-black text-slate-800">{laboStats.totalDevis.toLocaleString()} <span className="text-xs font-normal">DA</span></p>
                                    </CardContent>
                                </Card>
                                <Card className="border-0 shadow-premium bg-amber-50/50">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 text-amber-700 mb-2">
                                            <Clock className="h-4 w-4" />
                                            <h3 className="text-xs font-bold uppercase tracking-widest">En attente</h3>
                                        </div>
                                        <p className="text-2xl font-black text-amber-700">{laboStats.waitingLabCount}</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Filters */}
                            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border">
                                <Tabs defaultValue="Tous" className="w-full md:w-auto" onValueChange={setLaboStatusFilter}>
                                    <TabsList className="bg-slate-100/50 h-10">
                                        <TabsTrigger value="Tous">Tous</TabsTrigger>
                                        <TabsTrigger value="Au labo">Au labo</TabsTrigger>
                                        <TabsTrigger value="Livré">Livré</TabsTrigger>
                                        <TabsTrigger value="Problème">daulirence</TabsTrigger>
                                    </TabsList>
                                </Tabs>

                                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                                    <div className="flex items-center gap-2">
                                        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-10 text-xs rounded-xl" />
                                        <span className="text-slate-300">-</span>
                                        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-10 text-xs rounded-xl" />
                                    </div>
                                    <div className="relative flex-1 min-w-[200px]">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            placeholder="Rechercher un envoi..."
                                            value={laboSearchQuery}
                                            onChange={(e) => setLaboSearchQuery(e.target.value)}
                                            className="pl-9 h-10 rounded-xl"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <Card className="border-none shadow-premium overflow-hidden bg-white">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-slate-100 hover:bg-transparent">
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Patient</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Travail</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statut</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Devis</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Reste</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {laboLoading ? (
                                                <TableRow><TableCell colSpan={7} className="text-center py-10 text-slate-300 font-bold uppercase text-[10px] tracking-widest animate-pulse">Chargement...</TableCell></TableRow>
                                            ) : filteredLaboOrders.length === 0 ? (
                                                <TableRow><TableCell colSpan={7} className="text-center py-10 text-slate-300 font-bold uppercase text-[10px] tracking-widest">Aucune commande</TableCell></TableRow>
                                            ) : (
                                                filteredLaboOrders.map(order => (
                                                    <TableRow key={order.id} className={cn("group transition-colors", getLaboRowClass(order))}>
                                                        <TableCell className="text-xs font-bold text-slate-500">{format(new Date(order.date_reception), 'dd/MM')}</TableCell>
                                                        <TableCell>
                                                            <p className="text-xs font-black text-slate-700">{order.client_name}</p>
                                                            {order.patient_phone && <p className="text-[9px] text-slate-400 font-bold">{order.patient_phone}</p>}
                                                        </TableCell>
                                                        <TableCell>
                                                            <p className="text-xs font-bold text-slate-600">{order.type_travail}</p>
                                                            {order.teinte && <span className="text-[9px] bg-primary/5 text-primary px-1.5 py-0.5 rounded font-black">{order.teinte}</span>}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Select value={order.status} onValueChange={(val) => handleLaboStatusChange(order.id, val)}>
                                                                <SelectTrigger className="h-7 w-24 text-[9px] font-black uppercase border-none bg-transparent shadow-none p-0 focus:ring-0">
                                                                    {getLaboStatutBadge(order.status)}
                                                                </SelectTrigger>
                                                                <SelectContent className="rounded-xl border-none shadow-xl">
                                                                    {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt} className="text-[10px] font-bold">{displayStatus(opt)}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs font-bold text-slate-600">{order.devis.toLocaleString()}</TableCell>
                                                        <TableCell className={cn("text-right text-xs font-black", order.reste > 0 ? 'text-rose-500' : 'text-emerald-600')}>
                                                            {order.reste.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button variant="ghost" size="icon" onClick={() => { setLaboPaymentOrder(order); setLaboPaymentAmount(''); setShowLaboPaymentModal(true); }} className="h-7 w-7 text-primary hover:bg-primary/5"><CreditCard className="h-3.5 w-3.5" /></Button>
                                                                <Button variant="ghost" size="icon" onClick={() => openLaboEdit(order)} className="h-7 w-7 text-slate-400 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /></Button>
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50">
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle className="font-black italic text-rose-500">Supprimer cet envoi ?</AlertDialogTitle>
                                                                            <AlertDialogDescription className="font-medium">Cette action est définitive et supprimera toutes les données liées.</AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel className="rounded-xl font-bold">Annuler</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => handleLaboDelete(order.id)} className="bg-rose-500 hover:bg-rose-600 rounded-xl font-bold">Confirmer</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* ANALYTICS CONTENT */}
                    <TabsContent value="analytics" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="border-none shadow-premium bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-3xl">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <DollarSign className="h-8 w-8 text-white/20" />
                                            <Input
                                                type="date"
                                                value={selectedRevenueDate}
                                                onChange={e => setSelectedRevenueDate(e.target.value)}
                                                className="w-auto h-7 text-[10px] font-bold bg-white/10 border-0 rounded-full text-white cursor-pointer"
                                            />
                                        </div>
                                        <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Revenu du Jour Choisi</p>
                                        <h3 className="text-3xl font-black">{selectedDayRevenue.toLocaleString()} DZD</h3>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-premium bg-white rounded-3xl">
                                    <CardContent className="p-6">
                                        <Users className="h-8 w-8 text-primary/20 mb-4" />
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Patients Actifs</p>
                                        <h3 className="text-3xl font-black text-slate-800">{patients.length}</h3>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 gap-8">
                                <Card className="border-none shadow-premium bg-white rounded-3xl">
                                    <CardHeader>
                                        <CardTitle className="text-lg font-black italic">Croissance du Revenu</CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={monthlyData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </main>

            {/* FICHE MALADE DIALOG */}
            <Dialog open={isPatientDialogOpen} onOpenChange={setIsPatientDialogOpen}>
                <DialogContent className="max-w-3xl overflow-hidden rounded-3xl p-0 border shadow-2xl bg-white animate-in zoom-in-95 duration-200">
                    {selectedPatient && (
                        <div className="flex flex-col h-[85vh]">
                            {/* Simple Header */}
                            <div className="p-6 border-b flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-primary/5 rounded-full flex items-center justify-center">
                                        <User className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">{selectedPatient.client_name}</h3>
                                        <p className="text-xs text-slate-400 font-medium">{selectedPatient.phone}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-slate-50/30 p-6 space-y-6">
                                {/* Quick Stats Row */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="bg-white p-4 rounded-2xl border shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dernier Traitement</span>
                                        <span className="font-bold text-slate-700">{selectedPatient.treatment || 'N/A'}</span>
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl border shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Payé</span>
                                        <span className="font-bold text-emerald-600">{(selectedPatient.tranche_paid || 0).toLocaleString()} DZD</span>
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl border shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dette Restante</span>
                                        <span className="font-bold text-rose-500">{(selectedPatient.total_amount - (selectedPatient.tranche_paid || 0)).toLocaleString()} DZD</span>
                                    </div>
                                </div>


                                {/* History Tabs */}
                                <Tabs defaultValue="rendezvous" className="w-full">
                                    <TabsList className="bg-slate-100/50 p-1 rounded-xl mb-4 h-auto flex-wrap w-full sm:w-auto">
                                        <TabsTrigger value="rendezvous" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 sm:px-6 py-2 text-xs font-bold uppercase tracking-wider">Agenda</TabsTrigger>
                                        <TabsTrigger value="ordonnances" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 sm:px-6 py-2 text-xs font-bold uppercase tracking-wider">Ordonnances</TabsTrigger>
                                        <TabsTrigger value="historique" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 sm:px-6 py-2 text-xs font-bold uppercase tracking-wider">Historique</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="rendezvous" className="mt-0 space-y-3">
                                        {isLoadingHistory ? (
                                            <div className="p-10 text-center text-slate-300 animate-pulse font-bold text-sm uppercase">Chargement...</div>
                                        ) : patientHistory?.appointments.length === 0 ? (
                                            <div className="p-8 text-center text-slate-300 border border-dashed rounded-2xl text-xs font-black uppercase">Aucune séance passée</div>
                                        ) : (
                                            patientHistory?.appointments.map((a: any, idx: number) => (
                                                <div key={idx} className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-8 w-8 bg-slate-50 flex items-center justify-center rounded-lg text-xs font-black text-slate-400 uppercase tracking-tighter">
                                                            {format(new Date(a.appointment_at), 'dd/MM')}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-700">Séance avec {a.doctor?.name || 'Généraliste'}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{format(new Date(a.appointment_at), 'HH:mm')}</p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-slate-200">{a.status}</Badge>
                                                </div>
                                            ))
                                        )}
                                    </TabsContent>

                                    <TabsContent value="ordonnances" className="mt-0 space-y-3">
                                        {isLoadingHistory ? (
                                            <div className="p-10 text-center text-slate-300 animate-pulse font-bold text-sm uppercase">Recherche...</div>
                                        ) : patientHistory?.ordonnances.length === 0 ? (
                                            <div className="p-8 text-center text-slate-300 border border-dashed rounded-2xl text-xs font-black uppercase">Aucune ordonnance émise</div>
                                        ) : (
                                            patientHistory?.ordonnances.map((o: any, idx: number) => (
                                                <div key={idx} className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between group cursor-pointer hover:border-primary transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <FileText className="h-5 w-5 text-slate-300" />
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-700">Ordonnance du {format(new Date(o.prescription_date), 'dd MMMM yyyy', { locale: fr })}</p>
                                                            <div className="flex gap-1 mt-1">
                                                                {o.medications.slice(0, 2).map((m: any, i: number) => (
                                                                    <Badge key={i} className="bg-slate-50 text-slate-400 border-none text-[8px] font-black">{m.name}</Badge>
                                                                ))}
                                                                {o.medications.length > 2 && <span className="text-[8px] font-bold text-slate-300">+{o.medications.length - 2}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Printer className="h-4 w-4 text-slate-200 group-hover:text-primary transition-colors" />
                                                </div>
                                            ))
                                        )}
                                    </TabsContent>

                                    <TabsContent value="historique" className="mt-0 space-y-4">
                                        <div className="border rounded-xl overflow-hidden shadow-sm">
                                            <Table>
                                                <TableHeader className="bg-muted/50">
                                                    <TableRow>
                                                        <TableHead className="text-xs h-9 font-bold text-center">Date</TableHead>
                                                        <TableHead className="text-xs h-9 font-bold text-center">Traitement</TableHead>
                                                        <TableHead className="text-xs h-9 font-bold text-center">Note</TableHead>
                                                        <TableHead className="text-xs h-9 font-bold text-center">Total (DZD)</TableHead>
                                                        <TableHead className="text-xs h-9 font-bold text-center">Payé (DZD)</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {patients.filter(p => p.phone === selectedPatient.phone && p.client_name === selectedPatient.client_name).length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="text-center py-6 text-slate-400 text-xs uppercase tracking-wider font-bold">
                                                                Aucun historique
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        patients.filter(p => p.phone === selectedPatient.phone && p.client_name === selectedPatient.client_name).map((h, idx) => (
                                                            <TableRow key={h.id || idx} className="bg-white hover:bg-slate-50 transition-colors">
                                                                <TableCell className="text-xs py-3 font-medium text-slate-600 text-center">{format(new Date(h.completed_at), 'dd/MM/yy')}</TableCell>
                                                                <TableCell className="text-xs py-3 text-slate-700 text-center">
                                                                    <div>{h.treatment || '-'}</div>
                                                                </TableCell>
                                                                <TableCell className="text-xs py-3 text-slate-500 max-w-[150px] truncate text-center mx-auto cursor-pointer hover:text-primary transition-all font-medium italic underline decoration-dotted underline-offset-2" onClick={() => h.notes && setViewingNote(h.notes)}>{h.notes || '-'}</TableCell>
                                                                <TableCell className="text-xs py-3 font-bold text-slate-800 text-center">{h.total_amount?.toLocaleString() || 0}</TableCell>
                                                                <TableCell className="text-xs py-3 font-bold text-emerald-600 text-center">{h.tranche_paid?.toLocaleString() || 0}</TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>

                            <div className="p-4 border-t bg-white flex justify-end">
                                <Button onClick={() => setIsPatientDialogOpen(false)} className="rounded-xl h-11 px-8 font-black uppercase text-xs tracking-widest">
                                    Fermer
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog >

            <Dialog open={!!viewingNote} onOpenChange={(open) => !open && setViewingNote(null)}>
                <DialogContent className="max-w-sm w-[90vw] rounded-2xl p-6 shadow-2xl border-none">
                    <DialogHeader className="pb-4 border-b border-border/10">
                        <DialogTitle className="text-xl font-bold italic text-primary flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" /> Note Complète
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-6">
                        <div className="p-4 bg-muted/40 rounded-2xl border border-border/50 shadow-inner">
                            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap font-medium">{viewingNote}</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setViewingNote(null)} className="w-full h-11 rounded-xl font-bold shadow-premium">
                            Fermer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ORDONNANCE CREATION MODAL */}
            <Dialog open={showOrdonnanceModal} onOpenChange={setShowOrdonnanceModal}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto rounded-[2rem] border-none shadow-2xl p-0">
                    <DialogHeader className="p-6 border-b bg-slate-50/50">
                        <DialogTitle className="text-xl font-black italic text-primary flex items-center gap-2">
                            <FileText className="h-6 w-6" /> Nouvelle Ordonnance
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</label>
                                <Input type="date" value={ordonnanceFormData.date} onChange={e => setOrdonnanceFormData({ ...ordonnanceFormData, date: e.target.value })} className="rounded-xl border-slate-200" />
                            </div>
                            <div className="md:col-span-1 space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Patient <span className="text-rose-500">*</span></label>
                                <Input placeholder="Nom Complet" value={ordonnanceFormData.patient_name} onChange={e => setOrdonnanceFormData({ ...ordonnanceFormData, patient_name: e.target.value })} className="rounded-xl border-slate-200" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Âge</label>
                                <Input type="number" placeholder="--" value={ordonnanceFormData.age} onChange={e => setOrdonnanceFormData({ ...ordonnanceFormData, age: e.target.value })} className="rounded-xl border-slate-200" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-black italic text-slate-400 uppercase tracking-widest">Médicaments</h3>
                                <Button variant="outline" size="sm" onClick={addMedication} className="rounded-lg text-[10px] font-black uppercase tracking-widest h-7">
                                    <Plus className="h-3 w-3 mr-1" /> Ajouter
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {ordonnanceFormData.medications.map((med, idx) => (
                                    <div key={idx} className="p-5 bg-white rounded-3xl space-y-4 border border-slate-100 shadow-sm relative group">
                                        {ordonnanceFormData.medications.length > 1 && (
                                            <Button variant="ghost" size="icon" onClick={() => removeMedication(idx)} className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-white shadow-md text-rose-500 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all z-10 border">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                            <div className="md:col-span-3 space-y-1">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Médicament</label>
                                                <Select
                                                    value={med.name}
                                                    onValueChange={(val) => {
                                                        const selectedMed = dbMedications.find(m => m.name === val);
                                                        if (selectedMed) {
                                                            const newMeds = [...ordonnanceFormData.medications];
                                                            newMeds[idx] = {
                                                                ...newMeds[idx],
                                                                name: selectedMed.name,
                                                                dosage: selectedMed.dosage || '',
                                                                duree: selectedMed.duree || '',
                                                                frequency_count: selectedMed.frequency_count || 1,
                                                                frequency_unit: selectedMed.frequency_unit || 'comprimé(s)',
                                                                timing: selectedMed.timing || 'apres'
                                                            };
                                                            setOrdonnanceFormData({ ...ordonnanceFormData, medications: newMeds });
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className="flex h-10 w-full rounded-xl border border-slate-200 bg-background px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30">
                                                        <SelectValue placeholder="Choisir..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-80 rounded-2xl border-slate-200 shadow-xl overflow-hidden p-0">
                                                        <div className="p-2 border-b bg-slate-50/50">
                                                            <Button
                                                                variant="outline"
                                                                className="w-full rounded-xl h-9 text-[10px] font-black uppercase tracking-widest border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setShowAddMedModal(true);
                                                                }}
                                                            >
                                                                <Plus className="h-3 w-3 mr-1" /> Nouveau
                                                            </Button>
                                                        </div>
                                                        <ScrollArea className="h-full max-h-60">
                                                            {dbMedications.map(m => (
                                                                <SelectItem
                                                                    key={m.id}
                                                                    value={m.name}
                                                                    className="cursor-pointer hover:bg-primary/5 text-sm font-medium text-slate-700 py-2.5"
                                                                >
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold">{m.name}</span>
                                                                        {(m.dosage || m.default_dosage) && <span className="text-[10px] text-slate-400 font-normal">{m.dosage || m.default_dosage}</span>}
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </ScrollArea>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="md:col-span-2 space-y-1">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Nb cp</label>
                                                <Input
                                                    placeholder="1cp..."
                                                    value={med.dosage}
                                                    onChange={e => updateMedication(idx, 'dosage', e.target.value)}
                                                    className="rounded-xl h-10 border-slate-200 text-xs font-bold"
                                                />
                                            </div>

                                            <div className="md:col-span-2 space-y-1">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Durée</label>
                                                <Input placeholder="7 jours" value={med.duree} onChange={e => updateMedication(idx, 'duree', e.target.value)} className="rounded-xl h-10 border-slate-200 text-xs font-bold" />
                                            </div>

                                            <div className="md:col-span-1 space-y-1">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Fréq.</label>
                                                <Input type="number" value={med.frequency_count} onChange={e => updateMedication(idx, 'frequency_count', e.target.value)} className="rounded-xl h-10 border-slate-200 text-xs font-bold" />
                                            </div>

                                            <div className="md:col-span-2 space-y-1">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Unité</label>
                                                <Select value={med.frequency_unit} onValueChange={(val) => updateMedication(idx, 'frequency_unit', val)}>
                                                    <SelectTrigger className="rounded-xl h-10 border-slate-200 text-xs font-bold"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="comprimé(s)">Comp.</SelectItem>
                                                        <SelectItem value="gélule(s)">Gél.</SelectItem>
                                                        <SelectItem value="sachet(s)">Sach.</SelectItem>
                                                        <SelectItem value="cuillère(s)">Cuil.</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="md:col-span-2 space-y-1">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Moment</label>
                                                <Select value={med.timing} onValueChange={(val) => updateMedication(idx, 'timing', val)}>
                                                    <SelectTrigger className="rounded-xl h-10 border-slate-200 text-xs font-bold"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="avant">Avant repas</SelectItem>
                                                        <SelectItem value="apres">Après repas</SelectItem>
                                                        <SelectItem value="pendant">Pendant repas</SelectItem>
                                                        <SelectItem value="soir">Soir</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-slate-50">
                                            <p className="text-[10px] font-bold text-indigo-400 italic">
                                                Prévisualisation : {med.dosage} — {formatFrequencyLine(med.frequency_count, med.timing)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>


                    </div>
                    <DialogFooter className="p-6 bg-slate-50/50 flex gap-2">
                        <Button variant="ghost" onClick={() => setShowOrdonnanceModal(false)} className="rounded-xl font-bold">Annuler</Button>
                        <Button variant="outline" onClick={() => handlePrintOrdonnance({ ...ordonnanceFormData, prescription_date: ordonnanceFormData.date })} className="rounded-xl font-bold border-primary text-primary hover:bg-primary/5">
                            <Printer className="h-4 w-4 mr-2" /> Imprimer (A3)
                        </Button>
                        <Button onClick={handleSaveOrdonnance} disabled={savingOrdonnance} className="rounded-xl font-black px-8 shadow-lg shadow-primary/20">
                            {savingOrdonnance ? 'Création...' : 'Enregistrer'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* NEW MEDICATION MODAL */}
            <Dialog open={showAddMedModal} onOpenChange={setShowAddMedModal}>
                <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b bg-slate-50/50">
                        <DialogTitle className="text-xl font-black italic text-primary flex items-center gap-2">
                            <Plus className="h-6 w-6" /> Nouveau Médicament
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom du médicament <span className="text-rose-500">*</span></label>
                            <Input
                                placeholder="ex: Amoxicilline"
                                value={newMedFormData.name}
                                onChange={e => setNewMedFormData({ ...newMedFormData, name: e.target.value })}
                                className="rounded-xl border-slate-200"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre de cp (défaut)</label>
                            <Input
                                placeholder="ex: 1cp"
                                value={newMedFormData.dosage}
                                onChange={e => setNewMedFormData({ ...newMedFormData, dosage: e.target.value })}
                                className="rounded-xl border-slate-200"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Durée par défaut</label>
                                <Input
                                    placeholder="ex: 7 jours"
                                    value={newMedFormData.duree}
                                    onChange={e => setNewMedFormData({ ...newMedFormData, duree: e.target.value })}
                                    className="rounded-xl border-slate-200"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fréquence par défaut (/j)</label>
                                <Input
                                    type="number"
                                    value={newMedFormData.frequency_count}
                                    onChange={e => setNewMedFormData({ ...newMedFormData, frequency_count: parseInt(e.target.value) || 1 })}
                                    className="rounded-xl border-slate-200"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unité</label>
                                <Select value={newMedFormData.frequency_unit} onValueChange={(val) => setNewMedFormData({ ...newMedFormData, frequency_unit: val })}>
                                    <SelectTrigger className="rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="comprimé(s)">Comp.</SelectItem>
                                        <SelectItem value="gélule(s)">Gél.</SelectItem>
                                        <SelectItem value="sachet(s)">Sach.</SelectItem>
                                        <SelectItem value="cuillère(s)">Cuil.</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Moment</label>
                                <Select value={newMedFormData.timing} onValueChange={(val) => setNewMedFormData({ ...newMedFormData, timing: val })}>
                                    <SelectTrigger className="rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="avant">Avant repas</SelectItem>
                                        <SelectItem value="apres">Après repas</SelectItem>
                                        <SelectItem value="pendant">Pendant repas</SelectItem>
                                        <SelectItem value="soir">Soir</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-slate-50/50 flex gap-2">
                        <Button variant="ghost" onClick={() => setShowAddMedModal(false)} className="rounded-xl font-bold">Annuler</Button>
                        <Button
                            onClick={handleSaveNewMed}
                            disabled={savingNewMed}
                            className="rounded-xl font-black px-8 shadow-lg shadow-primary/20 bg-primary"
                        >
                            {savingNewMed ? 'Enregistrement...' : 'Enregistrer'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* LABO ADD/EDIT MODAL */}
            <Dialog open={showLaboAddModal} onOpenChange={setShowLaboAddModal}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-[2rem] border-none shadow-2xl p-0">
                    <DialogHeader className="p-6 border-b bg-slate-50/50">
                        <DialogTitle className="text-xl font-black italic text-primary flex items-center gap-2">
                            <ToothIcon className="h-6 w-6" />
                            {editingLaboId ? 'Modifier la commande' : 'Nouvel envoi Labo'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</label>
                            <Input type="date" value={laboFormData.date_reception} onChange={e => setLaboFormData({ ...laboFormData, date_reception: e.target.value })} className="rounded-xl border-slate-200" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Patient <span className="text-rose-500">*</span></label>
                            <Input placeholder="Nom du patient" value={laboFormData.client_name} onChange={e => setLaboFormData({ ...laboFormData, client_name: e.target.value })} className="rounded-xl border-slate-200" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type de prothèse <span className="text-rose-500">*</span></label>
                            <Select value={laboFormData.type_travail} onValueChange={v => setLaboFormData({ ...laboFormData, type_travail: v })}>
                                <SelectTrigger className="rounded-xl border-slate-200"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-xl">
                                    {TYPE_SUGGESTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Teinte</label>
                            <Select value={laboFormData.teinte || 'Non spécifié'} onValueChange={v => setLaboFormData({ ...laboFormData, teinte: v === 'Non spécifié' ? '' : v })}>
                                <SelectTrigger className="rounded-xl border-slate-200"><SelectValue placeholder="-" /></SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-xl">
                                    <SelectItem value="Non spécifié">Non spécifié</SelectItem>
                                    {TEINTE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statut</label>
                            <Select value={laboFormData.status} onValueChange={v => setLaboFormData({ ...laboFormData, status: v as any })}>
                                <SelectTrigger className="rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-xl">
                                    {STATUS_OPTIONS.map(t => <SelectItem key={t} value={t}>{displayStatus(t)}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Téléphone</label>
                            <Input placeholder="05..." value={laboFormData.patient_phone || ''} onChange={e => setLaboFormData({ ...laboFormData, patient_phone: e.target.value })} className="rounded-xl border-slate-200" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Devis (DA)</label>
                            <Input type="number" min="0" value={laboFormData.devis} onChange={e => setLaboFormData({ ...laboFormData, devis: parseFloat(e.target.value) || 0 })} className="rounded-xl border-slate-200" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Versement (DA)</label>
                            <Input type="number" min="0" value={laboFormData.versement} onChange={e => setLaboFormData({ ...laboFormData, versement: parseFloat(e.target.value) || 0 })} className="rounded-xl border-slate-200" />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                            <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reste à payer</span>
                                <span className={cn("text-xl font-black", (laboFormData.devis || 0) - (laboFormData.versement || 0) > 0 ? 'text-rose-500' : 'text-emerald-600')}>
                                    {((laboFormData.devis || 0) - (laboFormData.versement || 0)).toLocaleString()} DA
                                </span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-slate-50/50 flex gap-2">
                        <Button variant="ghost" onClick={() => setShowLaboAddModal(false)} className="rounded-xl font-bold">Annuler</Button>
                        <Button onClick={handleLaboSave} className="rounded-xl font-black px-8 shadow-lg shadow-primary/20">Enregistrer</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* LABO PAYMENT MODAL */}
            <Dialog open={showLaboPaymentModal} onOpenChange={setShowLaboPaymentModal}>
                <DialogContent className="max-w-sm rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b bg-slate-50/50">
                        <DialogTitle className="text-xl font-black italic text-primary flex items-center gap-2">
                            <CreditCard className="h-6 w-6" />
                            Verser Labo
                        </DialogTitle>
                        <DialogDescription className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mt-1">Patient: {laboPaymentOrder?.client_name}</DialogDescription>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center p-4 bg-rose-50 rounded-2xl">
                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">Reste actuel</span>
                            <span className="font-black text-lg text-rose-600">{laboPaymentOrder?.reste?.toLocaleString()} DA</span>
                        </div>
                        <div className="space-y-2 mt-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Montant du versement (DA)</label>
                            <Input
                                type="number"
                                placeholder="Montant..."
                                value={laboPaymentAmount}
                                onChange={e => setLaboPaymentAmount(e.target.value)}
                                className="rounded-xl border-slate-200 h-12 text-lg font-black"
                                autoFocus
                            />
                            useQueue.ts:260 [addClient] error → null value in column "client_name" of relation "queue_entries" violates not-null constraint Failing row contains (a580c717-bcc7-411b-bfc6-feb6ab8cec03, 312142be-e787-484e-b23f-b19ecc0eacde, 2d01d5ec-9357-4404-854c-a6cefaf4d1d5, null, 0123456789, N1C, N, 1, 1, waiting, null, 2026-06-01 12:40:15.71355+00, 6, ismail test). null 23502
                            (anonymous)	@	useQueue.ts:260
                            await in (anonymous)
                            (anonymous)	@	Accueil.tsx:313
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-slate-50/50 flex gap-2">
                        <Button variant="ghost" onClick={() => setShowLaboPaymentModal(false)} className="rounded-xl font-bold">Annuler</Button>
                        <Button onClick={handleLaboPaymentSubmit} className="rounded-xl font-black flex-1 shadow-lg shadow-primary/20">Valider</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            <footer className="p-4 border-t bg-muted/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">&copy; PasseVite - Gestion Holistique des Soins</p>
            </footer>
        </div >
    );
};

export default MedecinDashboard;
