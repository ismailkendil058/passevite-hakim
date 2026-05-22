import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Monitor, ArrowLeft } from 'lucide-react';

const LoginAccueil = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);

    // Login using our new custom roles table logic
    const { error, data } = await signIn(username.trim(), password.trim());
    setLoading(false);

    if (error) {
      toast.error('Identifiants incorrects');
      return;
    }

    if (data?.user?.role === 'receptionist' || data?.user?.role === 'manager' || data?.user?.role === 'admin') {
      navigate('/accueil');
    } else {
      toast.error('Accès refusé. Ce portail est réservé au personnel autorisé.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF9FF] p-4 font-sans selection:bg-[#64409a]/30">
      <Card className="w-full max-w-md lg:max-w-lg shadow-2xl border-none rounded-[2.5rem] bg-white overflow-hidden">
        <CardHeader className="text-center space-y-6 lg:space-y-8 pt-10 lg:pt-14 pb-2 relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="absolute left-6 top-6 rounded-full hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="mx-auto block">
            <img src="/Dr hakim.png" alt="Logo" className="h-10 lg:h-14 w-auto brightness-0 opacity-80 mx-auto" />
            <h1 className="text-3xl lg:text-4xl font-serif font-bold tracking-tight text-[#2a1f3d] mt-4 uppercase">PasseVite</h1>
            <p className="text-[10px] lg:text-xs tracking-[0.4em] text-[#64409a] mt-1 font-bold">PORTAIL ACCUEIL</p>
          </div>
          <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-3xl bg-[#64409a]/10 flex items-center justify-center mx-auto shadow-sm">
            <Monitor className="h-8 w-8 lg:h-10 lg:w-10 text-[#64409a]" />
          </div>
          <CardTitle className="font-serif text-xl lg:text-2xl font-bold text-[#2a1f3d]">Espace Réception</CardTitle>
        </CardHeader>
        <CardContent className="p-8 lg:p-10 pb-10 lg:pb-12">
          <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-7">
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Nom d'utilisateur (ex: accueil)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-14 lg:h-16 lg:text-base rounded-2xl border-none bg-[#FBF9FF]/50 focus-visible:ring-[#64409a]/30 text-base"
                required
              />
              <Input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-14 lg:h-16 lg:text-base rounded-2xl border-none bg-[#FBF9FF]/50 focus-visible:ring-[#64409a]/30 text-base"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full h-14 lg:h-16 lg:text-base bg-[#2a1f3d] hover:bg-[#64409a] text-white rounded-full font-bold shadow-xl shadow-black/10 transition-all active:scale-95 text-base"
              disabled={loading}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>

            <div className="mt-8 p-6 rounded-[1.8rem] bg-[#64409a]/5 border border-[#64409a]/10 text-center">
              <p className="text-[10px] font-black text-[#64409a] uppercase tracking-widest mb-1">Accès Restreint</p>
              <p className="text-xs text-[#4A4A4A] italic font-light font-serif">Veuillez entrer vos identifiants de session pour ouvrir la file d'attente.</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginAccueil;
