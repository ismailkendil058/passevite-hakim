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
    Calendar as CalIcon, MessageSquare, XCircle, FlaskConical, Pencil, CreditCard, Wallet, ChevronLeft
} from 'lucide-react';
import { format, parseISO, startOfToday, endOfToday, startOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { cn, getPersistentAuth } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface LaboOrder {
    id: string;
    date: string;
    nom_prenom: string;
    type_prothese: string;
    teinte: string;
    laboratoire: string;
    n_fiche: string;
    statut: 'En cours' | 'Au labo' | 'Livré' | 'Problème';
    devis: number;
    versement: number;
    reste: number;
    telephone: string;
    observation: string;
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
        date: format(new Date(), 'yyyy-MM-dd'),
        statut: 'En cours',
        devis: 0,
        versement: 0
    });
    const [laboPaymentAmount, setLaboPaymentAmount] = useState('');
    const [laboPaymentOrder, setLaboPaymentOrder] = useState<LaboOrder | null>(null);

    // ORDONNANCE MODAL STATE
    const [showOrdonnanceModal, setShowOrdonnanceModal] = useState(false);
    const [ordonnanceFormData, setOrdonnanceFormData] = useState({
        patient_name: '',
        age: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        medications: [{ name: '', dosage: '', duration: '', instructions: '' }],
        notes: ''
    });
    const [savingOrdonnance, setSavingOrdonnance] = useState(false);


    // Fetch Patient History (Appointments & Ordonnances)
    const { data: patientHistory, isLoading: isLoadingHistory } = useQuery({
        queryKey: ['patient-history', selectedPatient?.phone, selectedPatient?.client_name],
        enabled: !!selectedPatient,
        queryFn: async () => {
            const [appts, ords] = await Promise.all([
                supabase.from('appointments').select('*, doctor:doctors(*)').eq('client_phone', selectedPatient.phone).order('appointment_at', { ascending: false }),
                supabase.from('prescriptions').select('*').eq('patient_name', selectedPatient.client_name).order('prescription_date', { ascending: false })
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
                .order('prescription_date', { ascending: false });
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
                age: ordonnanceFormData.age ? parseInt(ordonnanceFormData.age) : null,
                prescription_date: ordonnanceFormData.date,
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
                medications: [{ name: '', dosage: '', duration: '', instructions: '' }],
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
            medications: [...ordonnanceFormData.medications, { name: '', dosage: '', duration: '', instructions: '' }]
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

        const medsHtml = rx.medications.map((m: any) => `
            <div style="margin-bottom: 30px; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <div style="font-weight: 900; font-size: 28px; color: #0f172a; text-transform: uppercase;">${m.name}</div>
                    <div style="font-weight: 700; font-size: 20px; color: #334155;">${m.dosage}</div>
                </div>
                <div style="font-size: 18px; color: #64748b; margin-top: 8px; font-weight: 500;">
                    ${m.instructions ? `<span style="font-style: italic;">${m.instructions}</span>` : ''}
                    ${m.duration ? `<span style="margin-left: 20px; border-left: 2px solid #e2e8f0; padding-left: 20px;">Pendant ${m.duration}</span>` : ''}
                </div>
            </div>
        `).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Ordonnance - ${rx.patient_name}</title>
                    <style>
                        @page { 
                            size: A3 portrait; 
                            margin: 2cm; 
                        }
                        body { 
                            font-family: 'Inter', system-ui, sans-serif; 
                            margin: 0; 
                            padding: 0; 
                            color: #1a202c; 
                            background: white;
                        }
                        .container { 
                            max-width: 1000px; 
                            margin: 0 auto; 
                            padding: 50px;
                        }
                        .header { 
                            text-align: center; 
                            margin-bottom: 80px; 
                            border-bottom: 4px solid #3b82f6; 
                            padding-bottom: 30px; 
                        }
                        .clinic-name { font-size: 48px; font-weight: 900; color: #1e40af; margin: 0; }
                        .doctor-name { font-size: 24px; font-weight: 700; color: #64748b; margin-top: 10px; }
                        .info-grid { 
                            display: grid; 
                            grid-template-cols: 1fr 1fr; 
                            gap: 30px; 
                            margin-bottom: 60px; 
                            font-size: 20px;
                        }
                        .prescription-title { 
                            font-size: 40px; 
                            font-weight: 900; 
                            text-align: center; 
                            margin-bottom: 60px; 
                            text-transform: uppercase; 
                            letter-spacing: 5px;
                            color: #3b82f6;
                        }
                        .medications { margin-bottom: 100px; }
                        .footer { 
                            text-align: center; 
                            margin-top: 100px; 
                            font-size: 14px; 
                            color: #94a3b8; 
                            border-top: 1px solid #e2e8f0; 
                            padding-top: 20px; 
                        }
                        .signature {
                             text-align: right;
                             margin-top: 50px;
                             font-weight: bold;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 class="clinic-name">CD DENTAL CLINIC</h1>
                            <div class="doctor-name">Dr. ${doctorInfo?.name || ''}</div>
                            <div style="font-size: 16px; color: #94a3b8; margin-top: 10px;">Chirurgien Dentiste</div>
                        </div>
                        
                        <div class="info-grid">
                            <div><strong>Patient:</strong> ${rx.patient_name}</div>
                            <div style="text-align: right;"><strong>Date:</strong> ${new Date(rx.prescription_date).toLocaleDateString('fr-FR')}</div>
                            ${rx.age ? `<div><strong>Âge:</strong> ${rx.age} ans</div>` : ''}
                        </div>

                        <div class="prescription-title">Ordonnance</div>

                        <div class="medications">
                            ${medsHtml}
                        </div>

                        ${rx.notes ? `<div style="margin-top: 40px; padding: 20px; background: #f8fafc; border-radius: 15px; font-size: 18px;"><strong>Note:</strong> ${rx.notes}</div>` : ''}

                        <div class="signature">
                            <p>Cachet et Signature</p>
                            <div style="height: 100px;"></div>
                        </div>

                        <div class="footer">
                             CD DENTAL CLINIC - Votre sourire, notre engagement.
                        </div>
                    </div>
                    <script>
                        window.onload = () => {
                            window.print();
                            // window.close();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    // LABO FUNCTIONS
    const fetchLaboOrders = async () => {
        if (!doctorInfo) return;
        setLaboLoading(true);
        // @ts-ignore
        let query = supabase
            .from('labo_orders')
            .select('*')
            .eq('doctor_id', doctorInfo.id)
            .gte('date', dateFrom)
            .lte('date', dateTo)
            .order('date', { ascending: false });

        const { data, error } = await query;
        if (error) {
            toast.error('Erreur lors du chargement des commandes labo');
            console.error(error);
        } else {
            // @ts-ignore
            setOrders(data as LaboOrder[]);
        }
        setLaboLoading(false);
    };

    useEffect(() => {
        if (doctorInfo) {
            fetchLaboOrders();
        }

        const channel = supabase
            .channel('labo_orders_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'labo_orders' }, () => {
                fetchLaboOrders();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [dateFrom, dateTo, doctorInfo]);

    const filteredLaboOrders = useMemo(() => {
        return orders.filter(o => {
            const matchSearch = !laboSearchQuery ||
                o.nom_prenom?.toLowerCase().includes(laboSearchQuery.toLowerCase()) ||
                o.type_prothese?.toLowerCase().includes(laboSearchQuery.toLowerCase()) ||
                o.laboratoire?.toLowerCase().includes(laboSearchQuery.toLowerCase()) ||
                o.n_fiche?.toLowerCase().includes(laboSearchQuery.toLowerCase());

            const matchStatus = laboStatusFilter === 'Tous' || o.statut === laboStatusFilter;

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
            if (o.statut === 'Au labo') waitingLabCount++;
        });

        return { totalDevis, totalCashed, totalReste, waitingLabCount };
    }, [filteredLaboOrders]);

    const handleLaboSave = async () => {
        try {
            const finalLaboratoire = laboFormData.laboratoire;
            const payload = {
                date: laboFormData.date || format(new Date(), 'yyyy-MM-dd'),
                nom_prenom: laboFormData.nom_prenom || '',
                type_prothese: laboFormData.type_prothese || '',
                teinte: laboFormData.teinte || null,
                laboratoire: finalLaboratoire || '',
                n_fiche: laboFormData.n_fiche || null,
                statut: laboFormData.statut || 'En cours',
                devis: laboFormData.devis || 0,
                versement: laboFormData.versement || 0,
                telephone: laboFormData.telephone || null,
                observation: laboFormData.observation || null,
                doctor_id: doctorInfo?.id
            };

            if (!payload.nom_prenom || !payload.type_prothese || !payload.laboratoire) {
                toast.error('Veuillez remplir les champs obligatoires (Nom, Type, Laboratoire)');
                return;
            }

            if (editingLaboId) {
                // @ts-ignore
                const { error } = await supabase.from('labo_orders').update(payload).eq('id', editingLaboId);
                if (error) throw error;
                toast.success('Commande mise à jour');
            } else {
                // @ts-ignore
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
            // @ts-ignore
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
            setOrders(orders.map(o => o.id === id ? { ...o, statut: newStatus as any } : o));
            // @ts-ignore
            const { error } = await supabase.from('labo_orders').update({ statut: newStatus }).eq('id', id);
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

            const newVersement = (laboPaymentOrder.versement || 0) + amount;

            // Optimistic update
            setOrders(orders.map(o => o.id === laboPaymentOrder.id ? {
                ...o,
                versement: newVersement,
                reste: (o.devis || 0) - newVersement
            } : o));

            // @ts-ignore
            const { error } = await supabase.from('labo_orders').update({ versement: newVersement }).eq('id', laboPaymentOrder.id);
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
            date: format(new Date(), 'yyyy-MM-dd'),
            statut: 'En cours',
            devis: 0,
            versement: 0,
            nom_prenom: '',
            type_prothese: '',
            teinte: '',
            laboratoire: '',
            n_fiche: '',
            telephone: '',
            observation: ''
        });
    };

    const openLaboEdit = (order: LaboOrder) => {
        setEditingLaboId(order.id);
        if (!DEFAULT_LABOS.includes(order.laboratoire)) {
            setCustomLabo(true);
        } else {
            setCustomLabo(false);
        }
        setLaboFormData({
            ...order
        });
        setShowLaboAddModal(true);
    };

    const getLaboRowClass = (order: LaboOrder) => {
        if (order.statut === 'Livré' && order.reste === 0) {
            return 'bg-green-50/50 border-l-4 border-green-500';
        }
        if (order.statut === 'Au labo') {
            return 'bg-yellow-50/50 border-l-4 border-yellow-400';
        }
        if (order.statut === 'Problème' || (order.statut === 'Livré' && order.reste > 0)) {
            return 'bg-red-50/50 border-l-4 border-red-500';
        }
        return '';
    };

    const getLaboStatutBadge = (statut: string) => {
        switch (statut) {
            case 'Livré':
                return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Livré</Badge>;
            case 'Au labo':
                return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200">Au labo</Badge>;
            case 'Problème':
                return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Problème</Badge>;
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
                            <FlaskConical className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Labo</span>
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <PieChart className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Analyses</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* ORDONNANCES CONTENT */}
                    <TabsContent value="ordonnances" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-3xl border-2 border-dashed border-muted">
                            <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
                            <h2 className="text-xl font-bold text-muted-foreground">Pas encore prêt</h2>
                            <p className="text-sm text-muted-foreground/60 font-medium">Cette section est en cours de développement.</p>
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
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <Card className="border-0 shadow-premium bg-white">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                            <Wallet className="h-4 w-4 text-primary" />
                                            <h3 className="text-xs font-bold uppercase tracking-widest">Total Devis</h3>
                                        </div>
                                        <p className="text-2xl font-black text-slate-800">{laboStats.totalDevis.toLocaleString()} <span className="text-xs font-normal">DA</span></p>
                                    </CardContent>
                                </Card>
                                <Card className="border-0 shadow-premium bg-emerald-50/50">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 text-emerald-700 mb-2">
                                            <DollarSign className="h-4 w-4" />
                                            <h3 className="text-xs font-bold uppercase tracking-widest">Total Encaissé</h3>
                                        </div>
                                        <p className="text-2xl font-black text-emerald-700">{laboStats.totalCashed.toLocaleString()} <span className="text-xs font-normal">DA</span></p>
                                    </CardContent>
                                </Card>
                                <Card className="border-0 shadow-premium bg-rose-50/50">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 text-rose-700 mb-2">
                                            <TrendingUp className="h-4 w-4" />
                                            <h3 className="text-xs font-bold uppercase tracking-widest">Total Reste</h3>
                                        </div>
                                        <p className="text-2xl font-black text-rose-700">{laboStats.totalReste.toLocaleString()} <span className="text-xs font-normal">DA</span></p>
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
                                        <TabsTrigger value="Problème">Problème</TabsTrigger>
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
                                <div className="overflow-x-auto min-h-[400px]">
                                    <Table>
                                        <TableHeader className="bg-slate-50/50">
                                            <TableRow>
                                                <TableHead className="font-bold text-xs text-center">Date</TableHead>
                                                <TableHead className="font-bold text-xs text-center">Patient</TableHead>
                                                <TableHead className="font-bold text-xs text-center">Type / Teinte</TableHead>
                                                <TableHead className="font-bold text-xs text-center">Labo / Réf.</TableHead>
                                                <TableHead className="font-bold text-xs text-center">Statut</TableHead>
                                                <TableHead className="font-bold text-xs text-center">Total (DA)</TableHead>
                                                <TableHead className="font-bold text-xs text-center">Versé (DA)</TableHead>
                                                <TableHead className="font-bold text-xs text-center">Reste (DA)</TableHead>
                                                <TableHead className="font-bold text-xs text-center">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {laboLoading ? (
                                                <TableRow><TableCell colSpan={9} className="text-center py-12 text-slate-300 uppercase font-black tracking-widest text-xs">Chargement...</TableCell></TableRow>
                                            ) : filteredLaboOrders.length === 0 ? (
                                                <TableRow><TableCell colSpan={9} className="text-center py-12 text-slate-300 uppercase font-black tracking-widest text-xs">Aucun envoi trouvé</TableCell></TableRow>
                                            ) : (
                                                filteredLaboOrders.map(order => (
                                                    <TableRow key={order.id} className={cn("hover:bg-slate-50 transition-colors", getLaboRowClass(order))}>
                                                        <TableCell className="text-xs font-medium text-center">{format(new Date(order.date), 'dd/MM/yy')}</TableCell>
                                                        <TableCell className="text-center">
                                                            <p className="font-bold text-sm text-slate-800">{order.nom_prenom}</p>
                                                            {order.telephone && <p className="text-[10px] text-slate-400 font-medium">{order.telephone}</p>}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <p className="text-sm font-medium text-slate-700">{order.type_prothese}</p>
                                                            {order.teinte && <Badge variant="secondary" className="bg-primary/5 text-primary text-[9px] font-black h-4 border-none mx-auto">{order.teinte}</Badge>}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <p className="text-sm font-bold text-slate-800">{order.laboratoire}</p>
                                                            {order.n_fiche && <p className="text-[10px] text-slate-400"># {order.n_fiche}</p>}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex justify-center">
                                                                <Select value={order.statut} onValueChange={(val) => handleLaboStatusChange(order.id, val)}>
                                                                    <SelectTrigger className="h-8 w-[110px] text-[10px] border-none shadow-none bg-transparent p-0 justify-center">
                                                                        {getLaboStatutBadge(order.statut)}
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold text-sm text-slate-600">
                                                            {order.devis?.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold text-sm text-emerald-600/80">
                                                            {order.versement?.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className={cn("text-center font-black text-sm", order.reste > 0 ? "text-rose-500" : "text-emerald-600")}>
                                                            {order.reste?.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" onClick={() => { setLaboPaymentOrder(order); setShowLaboPaymentModal(true); }}>
                                                                    <CreditCard className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-slate-50" onClick={() => openLaboEdit(order)}>
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
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
            </Dialog>

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
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] border-none shadow-2xl p-0">
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
                                    <div key={idx} className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100 relative group">
                                        {ordonnanceFormData.medications.length > 1 && (
                                            <Button variant="ghost" size="icon" onClick={() => removeMedication(idx)} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white shadow-sm text-rose-500 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all">
                                                <X className="h-3 w-3" />
                                            </Button>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <Input placeholder="Nom du médicament..." value={med.name} onChange={e => updateMedication(idx, 'name', e.target.value)} className="rounded-xl border-slate-200 text-sm font-bold h-9" />
                                            <Input placeholder="Posologie (Ex: 1 comp x 3 / j)" value={med.dosage} onChange={e => updateMedication(idx, 'dosage', e.target.value)} className="rounded-xl border-slate-200 text-sm h-9" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <Input placeholder="Durée (Ex: 5 jours)" value={med.duration} onChange={e => updateMedication(idx, 'duration', e.target.value)} className="rounded-xl border-slate-200 text-sm h-9" />
                                            <Input placeholder="Instructions..." value={med.instructions} onChange={e => updateMedication(idx, 'instructions', e.target.value)} className="rounded-xl border-slate-200 text-sm h-9" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes (Optionnel)</label>
                            <Input placeholder="Observations générales..." value={ordonnanceFormData.notes} onChange={e => setOrdonnanceFormData({ ...ordonnanceFormData, notes: e.target.value })} className="rounded-xl border-slate-200" />
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

            {/* LABO ADD/EDIT MODAL */}
            <Dialog open={showLaboAddModal} onOpenChange={setShowLaboAddModal}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-[2rem] border-none shadow-2xl p-0">
                    <DialogHeader className="p-6 border-b bg-slate-50/50">
                        <DialogTitle className="text-xl font-black italic text-primary flex items-center gap-2">
                            <FlaskConical className="h-6 w-6" />
                            {editingLaboId ? 'Modifier la commande' : 'Nouvel envoi Labo'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</label>
                            <Input type="date" value={laboFormData.date} onChange={e => setLaboFormData({ ...laboFormData, date: e.target.value })} className="rounded-xl border-slate-200" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Patient <span className="text-rose-500">*</span></label>
                            <Input placeholder="Nom du patient" value={laboFormData.nom_prenom} onChange={e => setLaboFormData({ ...laboFormData, nom_prenom: e.target.value })} className="rounded-xl border-slate-200" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type de prothèse <span className="text-rose-500">*</span></label>
                            <Select value={laboFormData.type_prothese} onValueChange={v => setLaboFormData({ ...laboFormData, type_prothese: v })}>
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
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Laboratoire <span className="text-rose-500">*</span></label>
                            {!customLabo ? (
                                <Select value={laboFormData.laboratoire} onValueChange={v => {
                                    if (v === 'autre') {
                                        setCustomLabo(true);
                                        setLaboFormData({ ...laboFormData, laboratoire: '' });
                                    } else {
                                        setLaboFormData({ ...laboFormData, laboratoire: v });
                                    }
                                }}>
                                    <SelectTrigger className="rounded-xl border-slate-200"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-xl">
                                        {DEFAULT_LABOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        <SelectItem value="autre" className="font-bold text-primary">Autre (Nouveau)</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Nom du laboratoire..."
                                        value={laboFormData.laboratoire || ''}
                                        onChange={e => setLaboFormData({ ...laboFormData, laboratoire: e.target.value })}
                                        className="rounded-xl border-slate-200"
                                        autoFocus
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => {
                                        setCustomLabo(false);
                                        setLaboFormData({ ...laboFormData, laboratoire: '' });
                                    }} className="rounded-xl">
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">N° Fiche (Réf)</label>
                            <Input placeholder="..." value={laboFormData.n_fiche || ''} onChange={e => setLaboFormData({ ...laboFormData, n_fiche: e.target.value })} className="rounded-xl border-slate-200" />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statut</label>
                            <Select value={laboFormData.statut} onValueChange={v => setLaboFormData({ ...laboFormData, statut: v as any })}>
                                <SelectTrigger className="rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-xl">
                                    {STATUS_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Téléphone</label>
                            <Input placeholder="05..." value={laboFormData.telephone || ''} onChange={e => setLaboFormData({ ...laboFormData, telephone: e.target.value })} className="rounded-xl border-slate-200" />
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

                        <div className="space-y-1 md:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observations</label>
                            <Input placeholder="..." value={laboFormData.observation || ''} onChange={e => setLaboFormData({ ...laboFormData, observation: e.target.value })} className="rounded-xl border-slate-200" />
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
                        <DialogDescription className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mt-1">Patient: {laboPaymentOrder?.nom_prenom}</DialogDescription>
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
        </div>
    );
};

export default MedecinDashboard;
