import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
    Search, Plus, Trash2, Pencil, CreditCard,
    Wallet, DollarSign, Clock, LayoutDashboard, ChevronLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ToothIcon } from '@/components/icons/ToothIcon';

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

const displayStatus = (s: string) => s === 'Problème' ? 'Doléance' : s;
const DEFAULT_LABOS = ['NewSmile', 'MEDDOUR', 'Youcef', 'new smille'];

export default function LaboPage() {
    const [orders, setOrders] = useState<LaboOrder[]>([]);
    const [customTypes, setCustomTypes] = useState<string[]>([]);
    const [customTeintes, setCustomTeintes] = useState<string[]>([]);

    const [loading, setLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('Tous');
    const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Form state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [customLabo, setCustomLabo] = useState(false);
    const [formData, setFormData] = useState<Partial<LaboOrder>>({
        date_reception: format(new Date(), 'yyyy-MM-dd'),
        status: 'En cours',
        devis: 0,
        versement: 0
    });

    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentOrder, setPaymentOrder] = useState<LaboOrder | null>(null);

    // Subscriptions & Fetching
    useEffect(() => {
        fetchOrders();

        // Load custom suggestions
        const storedTypes = localStorage.getItem('labo_types');
        if (storedTypes) setCustomTypes(JSON.parse(storedTypes));
        const storedTeintes = localStorage.getItem('labo_teintes');
        if (storedTeintes) setCustomTeintes(JSON.parse(storedTeintes));

        const channel = supabase
            .channel('labo_orders_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'labo_orders' }, () => {
                fetchOrders();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [dateFrom, dateTo]);

    const allTypeSuggestions = useMemo(() => {
        const fromOrders = orders.map(o => o.type_travail).filter(Boolean);
        return Array.from(new Set([...TYPE_SUGGESTIONS, ...customTypes, ...fromOrders]));
    }, [orders, customTypes]);

    const allTeinteSuggestions = useMemo(() => {
        const fromOrders = orders.map(o => o.teinte).filter(Boolean);
        return Array.from(new Set([...TEINTE_OPTIONS, ...customTeintes, ...fromOrders]));
    }, [orders, customTeintes]);


    const fetchOrders = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        // @ts-ignore
        let query = supabase
            .from('labo_orders')
            .select('id, client_name, type_travail, teinte, date_reception, status, devis, versement')
            .gte('date_reception', dateFrom)
            .lte('date_reception', dateTo)
            .order('date_reception', { ascending: false });

        const { data, error } = await query.limit(200);
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
        if (showLoading) setLoading(false);
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            const matchSearch = !searchQuery ||
                o.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.type_travail?.toLowerCase().includes(searchQuery.toLowerCase());
            // o.laboratoire?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            // o.n_fiche?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchStatus = statusFilter === 'Tous' || o.status === statusFilter;

            return matchSearch && matchStatus;
        });
    }, [orders, searchQuery, statusFilter]);

    const stats = useMemo(() => {
        let totalDevis = 0;
        let totalCashed = 0;
        let totalReste = 0;
        let waitingLabCount = 0;

        filteredOrders.forEach(o => {
            totalDevis += (o.devis || 0);
            totalCashed += (o.versement || 0);
            totalReste += (o.reste || 0);
            if (o.status === 'Au labo') waitingLabCount++;
        });

        return { totalDevis, totalCashed, totalReste, waitingLabCount };
    }, [filteredOrders]);

    const handleSave = async () => {
        try {
            const payload = {
                date_reception: formData.date_reception || format(new Date(), 'yyyy-MM-dd'),
                client_name: formData.client_name || '',
                type_travail: formData.type_travail || '',
                teinte: formData.teinte || null,
                status: formData.status || 'En cours',
                devis: formData.devis || 0,
                versement: formData.versement || 0,
                patient_phone: formData.patient_phone || null,
            };

            if (!payload.client_name || !payload.type_travail) {
                toast.error('Veuillez remplir les champs obligatoires (Nom, Type)');
                return;
            }

            if (editingId) {
                // @ts-ignore
                const { error } = await supabase.from('labo_orders').update(payload).eq('id', editingId);
                if (error) throw error;
                toast.success('Commande mise à jour');
            } else {
                // @ts-ignore
                const { error } = await supabase.from('labo_orders').insert([payload]);
                if (error) throw error;
                toast.success('Nouvelle commande ajoutée');
            }

            // Save new suggestions to localStorage
            if (payload.type_travail && !allTypeSuggestions.includes(payload.type_travail)) {
                const newTypes = Array.from(new Set([...customTypes, payload.type_travail]));
                setCustomTypes(newTypes);
                localStorage.setItem('labo_types', JSON.stringify(newTypes));
            }
            if (payload.teinte && !allTeinteSuggestions.includes(payload.teinte)) {
                const newTeintes = Array.from(new Set([...customTeintes, payload.teinte]));
                setCustomTeintes(newTeintes);
                localStorage.setItem('labo_teintes', JSON.stringify(newTeintes));
            }


            setShowAddModal(false);
            resetForm();
            await fetchOrders();
        } catch (error: any) {
            toast.error('Erreur: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            // @ts-ignore
            const { error } = await supabase.from('labo_orders').delete().eq('id', id);
            if (error) throw error;
            toast.success('Commande supprimée');
            await fetchOrders();
        } catch (error: any) {
            toast.error('Erreur lors de la suppression');
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            // Optimistic update
            setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus as any } : o));
            // @ts-ignore
            const { error } = await supabase.from('labo_orders').update({ status: newStatus }).eq('id', id);
            if (error) throw error;
            toast.success('Statut mis à jour');
        } catch (error: any) {
            toast.error('Erreur: ' + error.message);
            fetchOrders(); // rollback
        }
    };

    const handlePaymentSubmit = async () => {
        if (!paymentOrder || !paymentAmount) return;
        try {
            const amount = parseFloat(paymentAmount);
            if (isNaN(amount) || amount <= 0) {
                toast.error('Montant invalide');
                return;
            }

            const newVersement = (paymentOrder.versement || 0) + amount;

            // Optimistic update
            setOrders(orders.map(o => o.id === paymentOrder.id ? {
                ...o,
                versement: newVersement,
                reste: (o.devis || 0) - newVersement
            } : o));

            // @ts-ignore
            const { error } = await supabase.from('labo_orders').update({ versement: newVersement }).eq('id', paymentOrder.id);
            if (error) throw error;

            toast.success('Versement ajouté');
            setShowPaymentModal(false);
            setPaymentOrder(null);
            setPaymentAmount('');
        } catch (error: any) {
            toast.error('Erreur: ' + error.message);
            fetchOrders(); // rollback
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setCustomLabo(false);
        setFormData({
            date_reception: format(new Date(), 'yyyy-MM-dd'),
            status: 'En cours',
            devis: 0,
            versement: 0,
            client_name: '',
            type_travail: '',
            teinte: '',
            // laboratoire: '',
            // n_fiche: '',
            patient_phone: '',
            // observation: ''
        });
    };

    const openEdit = (order: LaboOrder) => {
        setEditingId(order.id);
        setFormData({
            date_reception: order.date_reception,
            client_name: order.client_name,
            type_travail: order.type_travail,
            teinte: order.teinte,
            status: order.status,
            devis: order.devis,
            versement: order.versement,
            patient_phone: order.patient_phone,
        });
        setShowAddModal(true);
    };

    const getRowClass = (order: LaboOrder) => {
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

    const getStatutBadge = (status: string) => {
        switch (status) {
            case 'Livré':
                return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Livré</Badge>;
            case 'Au labo':
                return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200">Au labo</Badge>;
            case 'Problème':
                return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Doléance</Badge>;
            default:
                return <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">En cours</Badge>;
        }
    };

    return (
        <div className="min-h-[100dvh] bg-background flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between p-3 sm:p-4 border-b sticky top-0 bg-background z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8 mb-1">
                        <Link to="/">
                            <ChevronLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-primary">
                            <ToothIcon className="h-5 w-5" />
                            Suivi Labo
                        </h1>
                        <p className="text-xs text-muted-foreground">Gestion des prothèses et travaux</p>
                    </div>
                </div>
                <Button onClick={() => { resetForm(); setShowAddModal(true); }} className="gap-2 h-9">
                    <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nouvel envoi</span>
                </Button>
            </header>

            <div className="p-3 sm:p-4 space-y-4 flex-1">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <Card className="border-0 shadow-sm bg-muted/30">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                <Wallet className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-medium">Total Devis (Mois)</h3>
                            </div>
                            <p className="text-2xl font-bold">{stats.totalDevis.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">DA</span></p>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm bg-yellow-50/50">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-yellow-700 mb-2">
                                <Clock className="h-4 w-4" />
                                <h3 className="text-sm font-medium">En attente (Au labo)</h3>
                            </div>
                            <p className="text-2xl font-bold text-yellow-700">{stats.waitingLabCount}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters Top Bar */}
                <div className="flex flex-col md:flex-row gap-3 justify-between">
                    <Tabs defaultValue="Tous" className="w-full md:w-auto" onValueChange={setStatusFilter}>
                        <TabsList className="w-full justify-start h-10">
                            <TabsTrigger value="Tous">Tous</TabsTrigger>
                            <TabsTrigger value="Au labo">Au labo</TabsTrigger>
                            <TabsTrigger value="Livré">Livré</TabsTrigger>
                            <TabsTrigger value="Problème">Doléance</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex flex-wrap items-center gap-2 flex-col md:flex-row">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-10 text-sm" />
                            <span className="text-muted-foreground">-</span>
                            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-10 text-sm" />
                        </div>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Chercher (nom, type...)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-10"
                            />
                        </div>
                    </div>
                </div>

                {/* Desktop Table View */}
                <Card className="border-0 shadow-sm overflow-hidden hidden sm:block">
                    <div className="overflow-x-auto min-h-[400px]">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[100px]">Date</TableHead>
                                    <TableHead>Patient / Téléphone</TableHead>
                                    <TableHead>Type / Teinte</TableHead>
                                    <TableHead>Laboratoire / Réf.</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead className="text-right">Devis (DA)</TableHead>
                                    <TableHead className="text-right">Versé (DA)</TableHead>
                                    <TableHead className="text-right">Reste (DA)</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Chargement...</TableCell>
                                    </TableRow>
                                ) : filteredOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucune commande trouvée</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredOrders.map(order => (
                                        <TableRow key={order.id} className={`${getRowClass(order)}`}>
                                            <TableCell className="text-xs whitespace-nowrap">{format(new Date(order.date_reception), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell>
                                                <p className="font-semibold text-sm">{order.client_name}</p>
                                                {order.patient_phone && <p className="text-xs text-muted-foreground">{order.patient_phone}</p>}
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-sm">{order.type_travail}</p>
                                                {order.teinte && <span className="text-xs text-muted-foreground bg-primary/10 px-1 rounded">{order.teinte}</span>}
                                            </TableCell>
                                            <TableCell>
                                                {/* <p className="text-sm font-medium">{order.laboratoire}</p> */}
                                                {/* {order.n_fiche && <p className="text-xs text-muted-foreground">Réf: {order.n_fiche}</p>} */}
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={order.status}
                                                    onValueChange={(val) => handleStatusChange(order.id, val)}
                                                >
                                                    <SelectTrigger className="h-8 w-[120px] text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 p-0 text-left justify-start gap-2">
                                                        {getStatutBadge(order.status)}
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {STATUS_OPTIONS.map(opt => (
                                                            <SelectItem key={opt} value={opt} className="text-xs">{displayStatus(opt)}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">{order.devis?.toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-green-600 font-medium">{order.versement?.toLocaleString()}</TableCell>
                                            <TableCell className={`text-right font-bold ${order.reste > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                {order.reste?.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => { setPaymentOrder(order); setShowPaymentModal(true); }} title="Ajouter versement">
                                                        <CreditCard className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openEdit(order)} title="Modifier">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" title="Supprimer">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Supprimer ?</AlertDialogTitle>
                                                                <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDelete(order.id)} className="bg-red-500 hover:bg-red-600">Supprimer</AlertDialogAction>
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

                {/* Mobile View */}
                <div className="sm:hidden space-y-2">
                    {loading ? (
                        <p className="text-center py-8 text-muted-foreground text-sm">Chargement...</p>
                    ) : filteredOrders.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground text-sm">Aucune commande</p>
                    ) : (
                        filteredOrders.map(order => (
                            <Card key={order.id} className={`border-0 shadow-sm ${getRowClass(order)}`}>
                                <CardContent className="p-3">
                                    <div className="flex justify-between items-start mb-2 border-b pb-2">
                                        <div>
                                            <p className="font-bold text-sm">{order.client_name}</p>
                                            <p className="text-xs text-muted-foreground">{order.type_travail}</p>
                                        </div>
                                        <div className="text-right">
                                            {getStatutBadge(order.status)}
                                            <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(order.date_reception), 'dd/MM/yyyy')}</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center text-sm mb-2">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Devis</p>
                                            <p className="font-medium">{order.devis?.toLocaleString()} DA</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Versé</p>
                                            <p className="font-medium text-green-600">{order.versement?.toLocaleString()} DA</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">Reste</p>
                                            <p className={`font-bold ${order.reste > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                {order.reste?.toLocaleString()} DA
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 justify-end mt-3">
                                        <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={() => { setPaymentOrder(order); setShowPaymentModal(true); }}>
                                            <CreditCard className="h-3.5 w-3.5 mr-1" /> Payer
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => openEdit(order)}>
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* Add / Edit Modal */}
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Modifier la commande' : 'Nouvel envoi Labo'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium">Date</label>
                            <Input type="date" value={formData.date_reception} onChange={e => setFormData({ ...formData, date_reception: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium">Patient <span className="text-red-500">*</span></label>
                            <Input placeholder="Nom du patient" value={formData.client_name} onChange={e => setFormData({ ...formData, client_name: e.target.value })} />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium">Type de prothèse <span className="text-red-500">*</span></label>
                            <Input
                                placeholder="Sélectionner ou écrire..."
                                value={formData.type_travail}
                                onChange={e => setFormData({ ...formData, type_travail: e.target.value })}
                                list="labo-type-suggestions"
                            />
                            <datalist id="labo-type-suggestions">
                                {allTypeSuggestions.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium">Teinte</label>
                            <Input
                                placeholder="Ex: A1, A2..."
                                value={formData.teinte || ''}
                                onChange={e => setFormData({ ...formData, teinte: e.target.value })}
                                list="labo-teinte-suggestions"
                            />
                            <datalist id="labo-teinte-suggestions">
                                {allTeinteSuggestions.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium">Statut</label>
                            <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v as any })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map(t => <SelectItem key={t} value={t}>{displayStatus(t)}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium">Téléphone</label>
                            <Input placeholder="05..." value={formData.patient_phone || ''} onChange={e => setFormData({ ...formData, patient_phone: e.target.value })} />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium">Devis (DA)</label>
                            <Input type="number" min="0" value={formData.devis} onChange={e => setFormData({ ...formData, devis: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium">Versement (DA)</label>
                            <Input type="number" min="0" value={formData.versement} onChange={e => setFormData({ ...formData, versement: parseFloat(e.target.value) || 0 })} />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                            <div className="p-3 bg-muted/50 rounded-md flex justify-between items-center text-sm">
                                <span className="font-medium">Reste à payer :</span>
                                <span className={`font-bold text-lg ${(formData.devis || 0) - (formData.versement || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    {((formData.devis || 0) - (formData.versement || 0)).toLocaleString()} DA
                                </span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddModal(false)}>Annuler</Button>
                        <Button onClick={handleSave}>Enregistrer</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Payment Modal */}
            <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Ajouter un versement</DialogTitle>
                        <DialogDescription>Patient: <span className="font-bold text-foreground">{paymentOrder?.client_name}</span></DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="flex justify-between items-center text-sm bg-muted/50 p-2 rounded">
                            <span>Reste actuel:</span>
                            <span className="font-bold text-red-500">{paymentOrder?.reste?.toLocaleString()} DA</span>
                        </div>
                        <div className="space-y-1 mt-2">
                            <label className="text-xs font-medium">Montant du versement (DA)</label>
                            <Input
                                type="number"
                                placeholder="Montant..."
                                value={paymentAmount}
                                onChange={e => setPaymentAmount(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Annuler</Button>
                        <Button onClick={handlePaymentSubmit}>Valider le paiement</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
