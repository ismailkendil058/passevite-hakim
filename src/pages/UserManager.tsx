import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, UserPlus, Trash2, ShieldCheck, Key, User as UserIcon, Stethoscope, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface UserRole {
    id: string;
    username: string;
    password: string;
    role: 'manager' | 'receptionist' | 'doctor' | 'admin';
    initial?: string;
    created_at: string;
    source: 'roles' | 'doctors';
}

const UserManager = () => {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editUsername, setEditUsername] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editRole, setEditRole] = useState<'manager' | 'receptionist' | 'doctor' | 'admin'>('receptionist');
    const [originalUsername, setOriginalUsername] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data: rolesData, error: rolesError } = await (supabase as any).from('roles').select('*');
            const { data: doctorsData, error: doctorsError } = await (supabase as any).from('doctors').select('*');

            if (rolesError) throw rolesError;
            if (doctorsError) throw doctorsError;

            const combined: UserRole[] = [
                ...(rolesData || []).map((r: any) => ({ ...r, id: r.id || r.username, source: 'roles' })),
                ...(doctorsData || []).map((d: any) => ({
                    id: d.id,
                    username: d.name,
                    password: d.password,
                    role: 'doctor',
                    initial: d.initial,
                    created_at: d.created_at,
                    source: 'doctors'
                }))
            ];

            setUsers(combined.sort((a, b) => a.username.localeCompare(b.username)));
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Erreur lors du chargement des accès');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);



    const startEditing = (user: UserRole) => {
        setEditingId(user.id);
        setEditUsername(user.username);
        setEditPassword(user.password);
        setEditRole(user.role);
        setOriginalUsername(user.username);
    };

    const handleUpdateUser = async (user: UserRole) => {
        if (!editUsername.trim() || !editPassword.trim()) {
            toast.error('Champs requis');
            return;
        }

        setIsUpdating(true);
        try {
            if (user.source === 'doctors') {
                const { error } = await (supabase as any).from('doctors').update({
                    name: editUsername.trim(),
                    password: editPassword.trim()
                }).eq('id', user.id);
                if (error) throw error;
            } else {
                const { error } = await (supabase as any).from('roles').update({
                    username: editUsername.trim().toLowerCase(),
                    password: editPassword.trim(),
                    role: editRole
                }).eq('username', originalUsername);

                if (error) throw error;
            }

            toast.success('Accès mis à jour');
            setEditingId(null);
            fetchUsers();
        } catch (error: any) {
            console.error('Error updating user:', error);
            toast.error(error.code === '23505' ? 'Utilisateur déjà existant' : 'Erreur lors de la mise à jour');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-background flex flex-col">
            {/* Exactly matching Manager Header */}
            <header className="flex items-center justify-between p-3 sm:p-4 border-b sticky top-0 bg-background z-10 font-sans">
                <div className="flex items-center gap-3">
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold text-foreground italic leading-none">PasseVite</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gestion des Accès</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="sm" className="h-9">
                        <Link to="/manager">
                            <ShieldCheck className="h-4 w-4 mr-1 text-primary" />
                            <span className="hidden sm:inline">Dashboard</span>
                        </Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8"><LogOut className="h-4 w-4" /></Button>
                </div>
            </header>

            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 font-sans">

                {/* Users List - Card view on mobile, table on desktop */}
                <div className="sm:hidden space-y-2">
                    {loading ? (
                        <p className="text-center py-8 text-[10px] uppercase font-bold text-muted-foreground animate-pulse">Chargement...</p>
                    ) : (
                        users.map(u => (
                            <Card key={`${u.source}-${u.id}`} className="border-0 shadow-sm">
                                <CardContent className="p-3">
                                    {editingId === u.id ? (
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Nom / Login</label>
                                                <Input
                                                    value={editUsername}
                                                    onChange={e => setEditUsername(e.target.value)}
                                                    className="h-8 text-sm bg-white"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Mot de Passe</label>
                                                <Input
                                                    value={editPassword}
                                                    onChange={e => setEditPassword(e.target.value)}
                                                    className="h-8 text-sm bg-white"
                                                />
                                            </div>
                                            {u.source === 'roles' && (
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Rôle</label>
                                                    <Select value={editRole as any} onValueChange={(v: any) => setEditRole(v)}>
                                                        <SelectTrigger className="h-8 text-sm bg-white"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="receptionist">Accueil</SelectItem>
                                                            <SelectItem value="manager">Manager</SelectItem>
                                                            <SelectItem value="admin">Admin</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                            <div className="flex gap-2 justify-end pt-1">
                                                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-8 text-[10px] font-bold">ANNULER</Button>
                                                <Button size="sm" onClick={() => handleUpdateUser(u)} disabled={isUpdating} className="h-8 text-[10px] font-bold">ENREGISTRER</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${u.role === 'doctor' ? 'bg-blue-100 text-blue-600' : 'bg-primary/10 text-primary'
                                                    }`}>
                                                    {u.role === 'doctor' ? <Stethoscope className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-foreground uppercase tracking-tight leading-none">{u.username}</p>
                                                    <span className="text-[9px] font-black opacity-40 uppercase">
                                                        {u.role === 'receptionist' ? 'Accueil' : u.role === 'manager' ? 'Manager' : u.role === 'admin' ? 'Admin' : 'Médecin'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-right">
                                                    <p className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{u.password}</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-primary hover:bg-primary/10 rounded-full"
                                                    onClick={() => startEditing(u)}
                                                >
                                                    <Key className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                <Card className="border-0 shadow-sm overflow-hidden hidden sm:block rounded-xl">
                    <Table>
                        <TableHeader className="bg-muted/40">
                            <TableRow>
                                <TableHead className="text-[10px] uppercase font-black pl-6">Utilisateur</TableHead>
                                <TableHead className="text-[10px] uppercase font-black">Rôle</TableHead>
                                <TableHead className="text-[10px] uppercase font-black">Mot de Passe</TableHead>
                                <TableHead className="text-[10px] uppercase font-black">Détails</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-12 text-[10px] uppercase font-bold text-muted-foreground animate-pulse tracking-widest">Récupération des accès...</TableCell></TableRow>
                            ) : (
                                users.map(u => (
                                    <TableRow key={`${u.source}-${u.id}`} className="group hover:bg-muted/10 transition-colors">
                                        <TableCell className="pl-6">
                                            {editingId === u.id ? (
                                                <Input
                                                    value={editUsername}
                                                    onChange={e => setEditUsername(e.target.value)}
                                                    className="h-8 text-sm bg-white"
                                                />
                                            ) : (
                                                <span className="font-bold uppercase tracking-tight text-sm">{u.username}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {editingId === u.id && u.source === 'roles' ? (
                                                <Select value={editRole as any} onValueChange={(v: any) => setEditRole(v)}>
                                                    <SelectTrigger className="h-8 text-sm bg-white"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="receptionist">Accueil</SelectItem>
                                                        <SelectItem value="manager">Manager</SelectItem>
                                                        <SelectItem value="admin">Admin</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ring-1 ring-inset ${u.role === 'manager' || u.role === 'admin' ? 'bg-amber-50 text-amber-600 ring-amber-500/20' :
                                                    u.role === 'doctor' ? 'bg-blue-50 text-blue-600 ring-blue-500/20' :
                                                        'bg-emerald-50 text-emerald-600 ring-emerald-500/20'
                                                    }`}>
                                                    {u.role === 'manager' ? 'Manager' : u.role === 'admin' ? 'Admin' : u.role === 'doctor' ? 'Médecin' : 'Accueil'}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {editingId === u.id ? (
                                                <Input
                                                    value={editPassword}
                                                    onChange={e => setEditPassword(e.target.value)}
                                                    className="h-8 text-sm bg-white font-mono"
                                                />
                                            ) : (
                                                <code className="text-xs bg-muted px-2 py-1 rounded select-all font-mono">{u.password}</code>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">
                                            {u.role === 'doctor' && `Init: ${u.initial}`}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {editingId === u.id ? (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 px-2 text-[10px] font-bold"
                                                            onClick={() => setEditingId(null)}
                                                        >
                                                            ANNULER
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="h-8 px-2 text-[10px] font-bold"
                                                            disabled={isUpdating}
                                                            onClick={() => handleUpdateUser(u)}
                                                        >
                                                            SAUVER
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                                                            onClick={() => startEditing(u)}
                                                        >
                                                            <Key className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
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

export default UserManager;
