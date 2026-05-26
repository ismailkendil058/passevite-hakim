import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Package, Search, Download, Calendar, AlertTriangle, Filter, List, Plus, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, isBefore, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface InventoryItem {
    id: string;
    name: string;
    totalQuantity: number;
    lastPurchaseDate: string | null;
    nextExpiration: string | null;
    averagePrice: number;
    items: any[];
}

const Inventaire = () => {
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [inventory, setInventory] = useState<InventoryItem[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: productsData, error: productsError } = await supabase
                .from('products')
                .select(`
                    id, 
                    name,
                    invoice_items (
                        quantity,
                        unit_price,
                        expiration_date,
                        invoices (
                            date
                        )
                    )
                `);

            if (productsError) throw productsError;

            if (productsData) {
                const processed = productsData.map((p: any) => {
                    const items = p.invoice_items || [];
                    const totalQuantity = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
                    const totalCost = items.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
                    const averagePrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;

                    const dates = items
                        .map((item: any) => item.invoices?.date)
                        .filter(Boolean)
                        .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime());

                    const lastPurchaseDate = dates[0] || null;

                    const expeditions = items
                        .map((item: any) => item.expiration_date)
                        .filter(Boolean)
                        .sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime());

                    const nextExpiration = expeditions[0] || null;

                    return {
                        id: p.id,
                        name: p.name,
                        totalQuantity,
                        lastPurchaseDate,
                        nextExpiration,
                        averagePrice,
                        items
                    };
                }).filter(p => p.totalQuantity > 0); // Only show products with stock

                setInventory(processed);
            }
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredInventory = useMemo(() => {
        return inventory.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [inventory, searchQuery]);

    const stats = useMemo(() => {
        const totalItems = filteredInventory.length;
        const totalStock = filteredInventory.reduce((sum, item) => sum + item.totalQuantity, 0);
        const nearExpiry = filteredInventory.filter(item =>
            item.nextExpiration && isBefore(new Date(item.nextExpiration), addDays(new Date(), 30))
        ).length;

        return { totalItems, totalStock, nearExpiry };
    }, [filteredInventory]);

    const exportExcel = () => {
        const headers = ['Produit', 'Quantité Totale', 'Prix Moyen', 'Dernier Achat', 'Prochaine Péremption'];
        const rows = filteredInventory.map(item => [
            item.name,
            item.totalQuantity,
            item.averagePrice.toFixed(2),
            item.lastPurchaseDate ? format(new Date(item.lastPurchaseDate), 'dd/MM/yyyy') : '—',
            item.nextExpiration ? format(new Date(item.nextExpiration), 'dd/MM/yyyy') : '—',
        ]);

        const csvContent = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventaire-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-[100dvh] bg-background flex flex-col">
            <header className="flex items-center justify-between p-3 sm:p-4 border-b sticky top-0 bg-background z-10">
                <div className="flex items-center gap-3">
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                        <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold text-foreground italic leading-none">PasseVite</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Inventaire Stock</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="sm" className="h-8 sm:h-9 px-3 gap-1 rounded-full font-bold uppercase tracking-widest text-[10px] text-muted-foreground">
                        <Link to="/manager/factures">
                            <FileText className="h-3.5 w-3.5" /> Historique
                        </Link>
                    </Button>
                    <Button asChild variant="default" size="sm" className="h-8 sm:h-9 px-3 gap-1 rounded-full font-bold uppercase tracking-widest text-[10px]">
                        <Link to="/manager/factures/ajouter">
                            <Plus className="h-3.5 w-3.5" /> Facture
                        </Link>
                    </Button>
                    <Button onClick={fetchData} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground ml-1">
                        <List className="h-4 w-4" />
                    </Button>
                </div>
            </header>

            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                {/* Search & Export */}
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher un produit..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-9 sm:h-10"
                        />
                    </div>
                    <Button variant="outline" onClick={exportExcel} className="gap-1 h-9 sm:h-10 text-sm">
                        <Download className="h-4 w-4" /> <span className="hidden sm:inline text-xs uppercase font-bold">Exporter</span>
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Card className="border-0 shadow-sm bg-primary/5">
                        <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2 text-primary">
                                <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span className="text-[10px] sm:text-xs font-bold uppercase">Produits</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-black text-primary">{stats.totalItems}</p>
                            <p className="text-[9px] text-muted-foreground uppercase font-medium">En stock</p>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm bg-primary/10">
                        <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2 text-primary">
                                <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span className="text-[10px] sm:text-xs font-bold uppercase">Volume Total</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-black text-primary tabular-nums">{stats.totalStock}</p>
                            <p className="text-[9px] text-muted-foreground uppercase font-medium">Unités reçues</p>
                        </CardContent>
                    </Card>

                    <Card className={`border-0 shadow-sm ${stats.nearExpiry > 0 ? 'bg-destructive/10 ring-1 ring-destructive/20' : 'bg-muted/10'}`}>
                        <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2 text-destructive">
                                <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span className="text-[10px] sm:text-xs font-bold uppercase text-muted-foreground">Alertes</span>
                            </div>
                            <p className={`text-xl sm:text-2xl font-black ${stats.nearExpiry > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{stats.nearExpiry}</p>
                            <p className="text-[9px] text-muted-foreground uppercase font-medium">Péremptions {'<'} 30j</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Inventory List - Mobile */}
                <div className="sm:hidden space-y-2">
                    {loading ? (
                        <p className="text-center py-8 text-[10px] uppercase font-bold animate-pulse tracking-widest text-muted-foreground">Chargement...</p>
                    ) : filteredInventory.length === 0 ? (
                        <p className="text-center py-8 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Aucun produit trouvé</p>
                    ) : (
                        filteredInventory.map(item => (
                            <Card key={item.id} className="border-0 shadow-sm">
                                <CardContent className="p-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="min-w-0">
                                            <p className="font-black text-primary text-sm uppercase truncate tracking-tight">{item.name}</p>
                                            <p className="text-[9px] text-muted-foreground uppercase font-bold mt-0.5">Moy: {item.averagePrice.toLocaleString()} DZD/u</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-lg text-foreground tabular-nums">x{item.totalQuantity}</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-end border-t pt-2 mt-2">
                                        <div className="space-y-1">
                                            <p className="text-[8px] text-muted-foreground uppercase font-bold">Dernier achat</p>
                                            <p className="text-[10px] font-black">{item.lastPurchaseDate ? format(new Date(item.lastPurchaseDate), 'dd/MM/yyyy') : '—'}</p>
                                        </div>
                                        {item.nextExpiration && (
                                            <div className="text-right space-y-1">
                                                <p className="text-[8px] text-muted-foreground uppercase font-bold">Péremption</p>
                                                <p className={`text-[10px] font-black ${isBefore(new Date(item.nextExpiration), addDays(new Date(), 30)) ? 'text-destructive' : 'text-foreground'}`}>
                                                    {format(new Date(item.nextExpiration), 'dd/MM/yyyy')}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* Inventory Table - Desktop */}
                <Card className="border-0 shadow-sm hidden sm:block overflow-hidden rounded-xl">
                    <Table>
                        <TableHeader className="bg-muted/40">
                            <TableRow>
                                <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70 pl-6">Produit</TableHead>
                                <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70 text-center">En Stock</TableHead>
                                <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70 text-right">Prix Moyen</TableHead>
                                <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70">Dernier Achat</TableHead>
                                <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70 text-right pr-6">Péremption</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-xs uppercase font-bold animate-pulse">Chargement en cours...</TableCell>
                                </TableRow>
                            ) : filteredInventory.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-xs uppercase font-bold">Aucun produit</TableCell>
                                </TableRow>
                            ) : (
                                filteredInventory.map(item => (
                                    <TableRow key={item.id} className="group hover:bg-muted/10 transition-colors">
                                        <TableCell className="font-black uppercase tracking-tight text-sm pl-6">{item.name}</TableCell>
                                        <TableCell className="text-center">
                                            <span className="font-black text-primary text-base tabular-nums">x{item.totalQuantity}</span>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-muted-foreground tabular-nums">{item.averagePrice.toLocaleString()} DZD</TableCell>
                                        <TableCell className="text-xs font-semibold text-muted-foreground">
                                            {item.lastPurchaseDate ? format(new Date(item.lastPurchaseDate), 'dd/MM/yyyy') : '—'}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            {item.nextExpiration ? (
                                                <span className={`text-xs font-bold ${isBefore(new Date(item.nextExpiration), addDays(new Date(), 30)) ? 'text-destructive bg-destructive/5 px-2 py-1 rounded' : 'text-foreground'}`}>
                                                    {format(new Date(item.nextExpiration), 'dd/MM/yyyy')}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>
        </div>
    );
};

export default Inventaire;
