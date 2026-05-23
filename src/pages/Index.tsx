import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Monitor, UserCog, UserCheck, FlaskConical } from 'lucide-react';

const Index = () => {
  const sections = [
    { title: 'Accueil', description: 'Gestion de la reception et de la file', icon: Monitor, href: '/accueil/login', variant: 'outline' as const },
    { title: 'Manager', description: 'Tableau de bord analytique', icon: UserCog, href: '/manager/login', variant: 'outline' as const },
    { title: 'Docteur', description: 'Tableau de bord de soins', icon: UserCheck, href: '/doctor/login', variant: 'outline' as const },
    { title: 'Laboratoire', description: 'Suivi des envois & prothèses', icon: FlaskConical, href: '/labo', variant: 'outline' as const },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden lg:[zoom:75%] xl:[zoom:70%]">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] animate-fade-in gpu" />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px] animate-fade-in gpu"
        style={{ animationDelay: '0.3s' }}
      />

      <div className="text-center mb-16 lg:mb-24 relative z-10 animate-fade-in gpu">
        <div className="inline-block mb-6 lg:mb-10 p-3 lg:p-5 rounded-[2rem] bg-white shadow-2xl shadow-primary/10 animate-float gpu border border-primary/5">
          <img src="/Dr hakim.png" alt="CD Dental Clinic Logo" className="h-14 w-14 lg:h-28 lg:w-28 object-contain" />
        </div>
        <h1 className="text-6xl lg:text-[10rem] font-black text-primary tracking-tighter italic leading-none">
          CD Dental Clinic
        </h1>
        <p className="text-[10px] lg:text-xl tracking-[0.3em] lg:tracking-[0.6em] text-muted-foreground mt-4 lg:mt-8 font-bold uppercase opacity-60">
          passevite
        </p>
        <div className="h-1.5 w-16 lg:w-32 bg-primary/20 mx-auto mt-10 lg:mt-16 rounded-full" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-10 w-full max-w-7xl relative z-10 justify-center px-4">
        {sections.map(({ title, description, icon: Icon, href }, index) => (
          <Link
            key={href}
            to={href}
            className="animate-slide-up gpu"
            style={{ animationDelay: `${0.1 * (index + 1)}s` }}
          >
            <Card className="border border-primary/5 shadow-2xl shadow-primary/5 hover:shadow-primary/20 transition-all duration-500 cursor-pointer group h-full bg-white/70 backdrop-blur-md rounded-[2rem] lg:rounded-[3rem] active:scale-95 hover:-translate-y-2">
              <CardContent className="p-6 lg:p-14 flex flex-col items-center text-center space-y-4 lg:space-y-8 h-full justify-center">
                <div className="w-14 h-14 lg:w-28 lg:h-28 rounded-[1.5rem] lg:rounded-[2.5rem] bg-primary/5 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 shadow-inner">
                  <Icon className="h-7 w-7 lg:h-14 lg:w-14 text-primary group-hover:text-primary-foreground transition-colors duration-500" />
                </div>
                <div className="space-y-2 lg:space-y-4">
                  <h2 className="font-black text-foreground text-base lg:text-3xl tracking-tight group-hover:text-primary transition-colors duration-500 italic uppercase">
                    {title}
                  </h2>
                  <p className="text-[10px] lg:text-sm text-muted-foreground leading-relaxed px-2 lg:px-4 font-medium opacity-70 group-hover:opacity-100 transition-opacity">
                    {description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p
        className="mt-12 text-[8px] sm:text-[10px] text-muted-foreground/50 uppercase tracking-widest sm:tracking-[0.2em] relative z-10 animate-fade-in text-center px-4"
        style={{ animationDelay: '1s' }}
      >
        &copy; {new Date().getFullYear()} passevite &bull; Excellence en Soins
      </p>
    </div>
  );
};

export default Index;
