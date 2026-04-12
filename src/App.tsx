import React, { useState, useEffect, useMemo } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useNavigate, 
  useLocation,
  Navigate
} from 'react-router-dom';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  setDoc,
  doc, 
  deleteDoc, 
  orderBy, 
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  updateProfile,
  User
} from 'firebase/auth';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Wallet, 
  FileText, 
  LogOut, 
  Plus, 
  Printer,
  Search, 
  Edit2, 
  Trash2, 
  ChevronRight,
  MessageCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Filter,
  Download,
  X,
  ChevronDown,
  UserCheck,
  BarChart3
} from 'lucide-react';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import imageCompression from 'browser-image-compression';

import { db, auth, storage } from './firebase';
import { cn, formatCurrency } from './lib/utils';

// --- Utils ---

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
testConnection();

const compressImage = async (file: File) => {
  const options = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
  };
  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.error('Compression error:', error);
    return file;
  }
};

const withTimeout = (promise: Promise<any>, timeoutMs: number) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Koneksi tidak stabil. Silakan coba lagi.')), timeoutMs)
    ),
  ]);
};

// --- Page Transition Component ---
const PageTransition = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ 
        duration: 0.3,
        ease: "easeOut"
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
};

// --- Types ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

interface CPMI {
  id: string;
  company: string;
  fullName: string;
  registrationNumber: string;
  registrationDate: string;
  phone: string;
  country: string;
  sponsorId: string;
  photo?: string;
  processStatus?: string;
  address: string;
  religion: string;
  age: number;
  pob: string;
  dob: string;
  height: number;
  weight: number;
  fatherName: string;
  motherName: string;
  spouseName: string;
  occupation: string;
  siblingsCount: number;
  birthOrder: number;
  education: string;
  maritalStatus: string;
  childrenCount: number;
  languages: {
    mandarin: boolean;
    english: boolean;
    cantonese: boolean;
  };
  documents: {
    ktp: boolean;
    kk: boolean;
    aktaLahir: boolean;
    bukuNikah: boolean;
    suratIjin: boolean;
    ijasah: boolean;
    aktaCerai: boolean;
    paspor: boolean;
  };
  workExperience: string;
  terms: {
    familyConsent: boolean;
    contractCompletion: boolean;
    returnCosts: boolean;
    holidayWork: boolean;
    eatPork: boolean;
    handlePork: boolean;
  };
  documentStatus: string;
  notes: string;
  pdfUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Sponsor {
  id: string;
  name: string;
  contactPerson: string;
  whatsapp: string;
  createdAt: Timestamp;
}

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  cpmiId?: string;
  date: Timestamp;
  createdAt: Timestamp;
}

// --- Error Handling ---

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      try {
        const parsed = JSON.parse(e.message);
        if (parsed.error) {
          setError(`Firestore Error: ${parsed.error} (${parsed.operationType} on ${parsed.path})`);
        }
      } catch {
        setError(e.message);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-red-500/5 rounded-full blur-[150px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-red-500/5 rounded-full blur-[150px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 bg-white p-8 sm:p-12 rounded-[2rem] shadow-2xl max-w-md w-full border border-slate-200 text-center"
        >
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-red-100 shadow-sm">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">System Error</h2>
          <p className="text-slate-500 mb-8 leading-relaxed font-medium text-sm break-words">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
          >
            Muat Ulang Aplikasi
          </button>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);

  const leftItems = [
    { path: '/', icon: LayoutDashboard, label: 'Beranda' },
    { path: '/cpmi', icon: Users, label: 'CPMI' },
  ];

  const rightItems = [
    { path: '/sponsors', icon: UserCheck, label: 'Sponsor' },
    { path: '/transactions', icon: Wallet, label: 'Keuangan' },
  ];

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <>
      {/* Quick Action Overlay */}
      <AnimatePresence>
        {isQuickActionOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsQuickActionOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95, x: '-50%' }}
              animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
              exit={{ opacity: 0, y: 20, scale: 0.95, x: '-50%' }}
              className="fixed bottom-32 left-1/2 z-[70] w-[90%] max-w-xs bg-slate-900 rounded-[2.5rem] border border-white/10 shadow-2xl p-4 flex flex-col gap-2"
            >
              <div className="px-4 py-2 mb-2 border-b border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Menu Cepat</p>
              </div>
              <button 
                onClick={() => { setIsQuickActionOpen(false); navigate('/cpmi'); }}
                className="w-full bg-slate-800 text-white px-6 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] flex items-center gap-4 hover:bg-slate-700 transition-all active:scale-[0.98] border border-white/5 shadow-sm group"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:rotate-12 transition-transform">
                  <Users size={20} />
                </div>
                <span>Tambah CPMI</span>
              </button>
              <button 
                onClick={() => { setIsQuickActionOpen(false); navigate('/transactions'); }}
                className="w-full bg-slate-800 text-white px-6 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] flex items-center gap-4 hover:bg-slate-700 transition-all active:scale-[0.98] border border-white/5 shadow-sm group"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:rotate-12 transition-transform">
                  <Wallet size={20} />
                </div>
                <span>Tambah Transaksi</span>
              </button>
              <button 
                onClick={() => { setIsQuickActionOpen(false); navigate('/reports'); }}
                className="w-full bg-slate-800 text-white px-6 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] flex items-center gap-4 hover:bg-slate-700 transition-all active:scale-[0.98] border border-white/5 shadow-sm group"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:rotate-12 transition-transform">
                  <FileText size={20} />
                </div>
                <span>Lihat Laporan</span>
              </button>
              <div className="h-px bg-white/5 my-2 mx-4" />
              <button 
                onClick={handleLogout}
                className="w-full bg-red-500/10 text-red-400 px-6 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] flex items-center gap-4 hover:bg-red-500/20 transition-all active:scale-[0.98] border border-red-500/20 group"
              >
                <div className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:rotate-12 transition-transform">
                  <LogOut size={20} />
                </div>
                <span>Keluar Sesi</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-lg h-24 bg-slate-900/90 backdrop-blur-md rounded-[3.5rem] border border-white/10 shadow-2xl flex items-center justify-between px-4">
        <div className="flex items-center flex-1 justify-around">
          {leftItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex flex-col items-center justify-center w-16 h-16 transition-all duration-700 rounded-[1.5rem]",
                  isActive ? "text-white" : "text-slate-500 hover:text-slate-300"
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 rounded-[1.5rem] border border-white/10 shadow-inner"
                    transition={{ type: 'spring', bounce: 0.3, duration: 0.8 }}
                  />
                )}
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} className={cn("z-10 transition-all duration-700", isActive && "scale-110 drop-shadow-lg")} />
                <span className={cn("text-[7px] font-black uppercase tracking-[0.25em] mt-2 z-10 transition-all duration-700", isActive ? "opacity-100 text-indigo-400" : "opacity-40")}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="nav-dot"
                    className="absolute -bottom-1.5 w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-md"
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Floating Action Button */}
        <div className="relative flex items-center justify-center w-28">
          <div className="absolute -top-14">
            <button
              onClick={() => setIsQuickActionOpen(!isQuickActionOpen)}
              className={cn(
                "w-20 h-20 rounded-[2.5rem] bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 border-[8px] border-slate-950 group relative overflow-hidden",
                isQuickActionOpen ? "rotate-[135deg] shadow-none" : "rotate-0"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Plus size={38} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300 drop-shadow-lg" />
            </button>
            {/* Subtle Glow behind button */}
            <div className="absolute inset-0 -z-10 bg-indigo-500/30 blur-[30px] rounded-full" />
          </div>
        </div>

        <div className="flex items-center flex-1 justify-around">
          {rightItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex flex-col items-center justify-center w-16 h-16 transition-all duration-700 rounded-[1.5rem]",
                  isActive ? "text-white" : "text-slate-500 hover:text-slate-300"
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 rounded-[1.5rem] border border-white/10 shadow-inner"
                    transition={{ type: 'spring', bounce: 0.3, duration: 0.8 }}
                  />
                )}
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} className={cn("z-10 transition-all duration-700", isActive && "scale-110 drop-shadow-lg")} />
                <span className={cn("text-[7px] font-black uppercase tracking-[0.25em] mt-2 z-10 transition-all duration-700", isActive ? "opacity-100 text-indigo-400" : "opacity-40")}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="nav-dot"
                    className="absolute -bottom-1.5 w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-md"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

const Dashboard = ({ cpmi, sponsors, transactions }: { cpmi: CPMI[], sponsors: Sponsor[], transactions: Transaction[] }) => {
  const stats = useMemo(() => {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const balance = totalIncome - totalExpense;

    return [
      { label: 'Total CPMI', value: cpmi.length, icon: Users, color: 'blue' },
      { label: 'Total Sponsor', value: sponsors.length, icon: Briefcase, color: 'purple' },
      { label: 'Total Pemasukan', value: formatCurrency(totalIncome), icon: Wallet, color: 'emerald' },
      { label: 'Saldo Kas', value: formatCurrency(balance), icon: FileText, color: 'amber' },
    ];
  }, [cpmi, sponsors, transactions]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Dashboard Overview</h2>
          <p className="text-slate-400 text-sm font-medium">Ringkasan data operasional P3MI</p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="group relative bg-slate-900 rounded-[2rem] p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-white/5 overflow-hidden hover:border-white/10"
          >
            {/* Decorative background gradient */}
            <div className={cn(
              "absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 blur-2xl",
              stat.color === 'blue' ? "bg-blue-600" :
              stat.color === 'purple' ? "bg-purple-600" :
              stat.color === 'emerald' ? "bg-emerald-600" :
              "bg-amber-600"
            )} />
            
            <div className="flex items-center justify-between mb-8">
              <div className={cn(
                "w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl transition-all duration-700 group-hover:scale-110 group-hover:rotate-6",
                stat.color === 'blue' ? "bg-blue-600/20 text-blue-400 border border-blue-500/20 shadow-blue-500/10" :
                stat.color === 'purple' ? "bg-purple-600/20 text-purple-400 border border-purple-500/20 shadow-purple-500/10" :
                stat.color === 'emerald' ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10" :
                "bg-amber-600/20 text-amber-400 border-amber-500/20 shadow-amber-500/10"
              )}>
                <stat.icon size={32} strokeWidth={2} />
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.25em] mb-2">{stat.label}</p>
              <h3 className="text-3xl font-black text-white tracking-tight group-hover:translate-x-1 transition-transform duration-500">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900 p-8 rounded-[2rem] border border-white/5 shadow-xl hover:border-white/10 transition-all duration-300">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-2xl text-white tracking-tight flex items-center gap-4">
              <div className="w-2.5 h-10 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full shadow-lg" />
              CPMI Terbaru
            </h3>
            <Link to="/cpmi" className="group/link text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] hover:text-blue-300 transition-all inline-flex items-center gap-3">
              Lihat Semua <ChevronRight size={16} className="group-hover/link:translate-x-1 transition-transform" />
            </Link>
          </div>
          <div className="space-y-4">
            {cpmi.slice(0, 5).map((person) => (
              <div key={person.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-2xl border border-white/5 hover:bg-slate-800/50 hover:shadow-lg transition-all duration-300 group cursor-pointer hover:border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-900 border border-white/10 rounded-xl flex items-center justify-center text-blue-400 font-black text-xl shadow-md overflow-hidden group-hover:scale-105 transition-transform duration-300">
                    {person.photo ? (
                      <img src={person.photo} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                    ) : person.fullName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-lg text-white group-hover:text-blue-400 transition-colors tracking-tight">{person.fullName}</p>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">{person.country} • {person.registrationNumber}</p>
                  </div>
                </div>
                <span className={cn(
                  "px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl border transition-all duration-500",
                  person.documentStatus === 'Lengkap' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20 group-hover:bg-amber-500/20"
                )}>
                  {person.documentStatus}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2rem] border border-white/5 shadow-xl hover:border-white/10 transition-all duration-300">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-2xl text-white tracking-tight flex items-center gap-4">
              <div className="w-2.5 h-10 bg-gradient-to-b from-purple-500 to-fuchsia-600 rounded-full shadow-lg" />
              Transaksi Terakhir
            </h3>
            <Link to="/transactions" className="group/link text-purple-400 text-[10px] font-black uppercase tracking-[0.3em] hover:text-purple-300 transition-all inline-flex items-center gap-3">
              Lihat Semua <ChevronRight size={16} className="group-hover/link:translate-x-1 transition-transform" />
            </Link>
          </div>
          <div className="space-y-4">
            {transactions.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-2xl border border-white/5 hover:bg-slate-800/50 hover:shadow-lg transition-all duration-300 group cursor-pointer hover:border-white/10">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-105",
                    t.type === 'income' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-red-500/20 text-red-400 border border-red-500/20"
                  )}>
                    {t.type === 'income' ? <TrendingUp size={28} strokeWidth={2} /> : <TrendingDown size={28} strokeWidth={2} />}
                  </div>
                  <div>
                    <p className="font-black text-lg text-white group-hover:text-purple-400 transition-colors tracking-tight">{t.description}</p>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">{t.category} • {format(t.date.toDate(), 'dd MMM yyyy')}</p>
                  </div>
                </div>
                <p className={cn(
                  "font-black text-xl tracking-tight",
                  t.type === 'income' ? "text-emerald-400" : "text-red-400"
                )}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const CPMIPage = ({ cpmi, sponsors, transactions, currentCompany }: { cpmi: CPMI[], sponsors: Sponsor[], transactions: Transaction[], currentCompany: string }) => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingCPMI, setEditingCPMI] = useState<CPMI | null>(null);
  const [selectedCPMI, setSelectedCPMI] = useState<CPMI | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const filteredCPMI = useMemo(() => {
    return cpmi.filter(p => 
      p.fullName.toLowerCase().includes(search.toLowerCase()) || 
      p.registrationNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.country.toLowerCase().includes(search.toLowerCase())
    );
  }, [cpmi, search]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setPhotoFile(compressed as File);
        setPhotoPreview(URL.createObjectURL(compressed));
      } catch (error) {
        console.error('Photo processing error:', error);
        alert('Gagal memproses foto. Silakan coba lagi.');
      }
    }
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Hanya file PDF yang diperbolehkan.');
        return;
      }
      if (file.size > 5000000) { // 5MB limit
        alert('Ukuran file PDF terlalu besar. Maksimal 5MB.');
        return;
      }
      setPdfFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    
    let pdfUrl = editingCPMI?.pdfUrl || '';
    let photoUrl = editingCPMI?.photo || '';

    try {
      if (pdfFile) {
        console.log('Uploading PDF...', pdfFile.name);
        const storageRef = ref(storage, `cpmi_docs/${Date.now()}_${pdfFile.name}`);
        const snapshot = await withTimeout(uploadBytes(storageRef, pdfFile), 60000) as any;
        pdfUrl = await getDownloadURL(snapshot.ref);
        console.log('PDF uploaded successfully:', pdfUrl);
      }

      if (photoFile) {
        console.log('Uploading Photo...', photoFile.name);
        const photoRef = ref(storage, `cpmi_photos/${Date.now()}_${photoFile.name}`);
        const snapshot = await withTimeout(uploadBytes(photoRef, photoFile), 60000) as any;
        photoUrl = await getDownloadURL(snapshot.ref);
        console.log('Photo uploaded successfully:', photoUrl);
      }

      const data = {
        company: currentCompany,
        fullName: formData.get('fullName') as string,
        registrationNumber: formData.get('registrationNumber') as string,
        registrationDate: formData.get('registrationDate') as string,
        phone: formData.get('phone') as string,
        country: formData.get('country') as string,
        sponsorId: formData.get('sponsorId') as string,
        processStatus: formData.get('processStatus') as string || 'Proses',
        photo: photoUrl,
        pdfUrl: pdfUrl,
        address: formData.get('address') as string,
        religion: formData.get('religion') as string,
        age: Number(formData.get('age')),
        pob: formData.get('pob') as string,
        dob: formData.get('dob') as string,
        height: Number(formData.get('height')),
        weight: Number(formData.get('weight')),
        fatherName: formData.get('fatherName') as string,
        motherName: formData.get('motherName') as string,
        spouseName: formData.get('spouseName') as string,
        occupation: formData.get('occupation') as string,
        siblingsCount: Number(formData.get('siblingsCount')),
        birthOrder: Number(formData.get('birthOrder')),
        education: formData.get('education') as string,
        maritalStatus: formData.get('maritalStatus') as string,
        childrenCount: Number(formData.get('childrenCount')),
        languages: {
          mandarin: formData.get('lang_mandarin') === 'on',
          english: formData.get('lang_english') === 'on',
          cantonese: formData.get('lang_cantonese') === 'on',
        },
        documents: {
          ktp: formData.get('doc_ktp') === 'on',
          kk: formData.get('doc_kk') === 'on',
          aktaLahir: formData.get('doc_aktaLahir') === 'on',
          bukuNikah: formData.get('doc_bukuNikah') === 'on',
          suratIjin: formData.get('doc_suratIjin') === 'on',
          ijasah: formData.get('doc_ijasah') === 'on',
          aktaCerai: formData.get('doc_aktaCerai') === 'on',
          paspor: formData.get('doc_paspor') === 'on',
        },
        workExperience: formData.get('workExperience') as string,
        terms: {
          familyConsent: formData.get('term_familyConsent') === 'on',
          contractCompletion: formData.get('term_contractCompletion') === 'on',
          returnCosts: formData.get('term_returnCosts') === 'on',
          holidayWork: formData.get('term_holidayWork') === 'on',
          eatPork: formData.get('term_eatPork') === 'on',
          handlePork: formData.get('term_handlePork') === 'on',
        },
        documentStatus: formData.get('documentStatus') as string,
        notes: formData.get('notes') as string,
        updatedAt: Timestamp.now(),
      };

      if (editingCPMI) {
        await updateDoc(doc(db, 'cpmi', editingCPMI.id), data);
      } else {
        await addDoc(collection(db, 'cpmi'), {
          ...data,
          createdAt: Timestamp.now(),
        });
      }
      setIsModalOpen(false);
      setEditingCPMI(null);
      setPhotoPreview(null);
      setPhotoFile(null);
      setPdfFile(null);
    } catch (error) {
      handleFirestoreError(error, editingCPMI ? OperationType.UPDATE : OperationType.CREATE, 'cpmi');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'cpmi', deleteId));
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'cpmi');
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Nama Lengkap', 'No Registrasi', 'No HP', 'Tanggal Daftar', 'Negara', 'Sponsor', 'Status Berkas', 'Proses',
      'Alamat', 'Agama', 'Umur', 'Tempat Lahir', 'Tanggal Lahir', 'Tinggi', 'Berat',
      'Nama Bapak', 'Nama Ibu', 'Nama Pasangan', 'Pekerjaan', 'Saudara', 'Anak Ke', 'Pendidikan', 'Status Nikah', 'Jumlah Anak',
      'Mandarin', 'English', 'Cantonese',
      'KTP', 'KK', 'Akta Lahir', 'Buku Nikah', 'Surat Ijin', 'Ijasah', 'Akta Cerai', 'Paspor',
      'Pengalaman Kerja',
      'Restu Keluarga', 'Selesai Kontrak', 'Biaya Pulang', 'Kerja Hari Libur', 'Makan Babi', 'Pegang Babi',
      'Catatan'
    ];
    
    const rows = filteredCPMI.map(p => [
      p.fullName,
      p.registrationNumber,
      p.phone || '-',
      p.registrationDate,
      p.country,
      sponsors.find(s => s.id === p.sponsorId)?.name || '-',
      p.documentStatus,
      p.processStatus || 'Proses',
      p.address || '-',
      p.religion || '-',
      p.age || '-',
      p.pob || '-',
      p.dob || '-',
      p.height || '-',
      p.weight || '-',
      p.fatherName || '-',
      p.motherName || '-',
      p.spouseName || '-',
      p.occupation || '-',
      p.siblingsCount || '-',
      p.birthOrder || '-',
      p.education || '-',
      p.maritalStatus || '-',
      p.childrenCount || '-',
      p.languages?.mandarin ? 'Ya' : 'Tidak',
      p.languages?.english ? 'Ya' : 'Tidak',
      p.languages?.cantonese ? 'Ya' : 'Tidak',
      p.documents?.ktp ? 'Ya' : 'Tidak',
      p.documents?.kk ? 'Ya' : 'Tidak',
      p.documents?.aktaLahir ? 'Ya' : 'Tidak',
      p.documents?.bukuNikah ? 'Ya' : 'Tidak',
      p.documents?.suratIjin ? 'Ya' : 'Tidak',
      p.documents?.ijasah ? 'Ya' : 'Tidak',
      p.documents?.aktaCerai ? 'Ya' : 'Tidak',
      p.documents?.paspor ? 'Ya' : 'Tidak',
      p.workExperience || '-',
      p.terms?.familyConsent ? 'Ya' : 'Tidak',
      p.terms?.contractCompletion ? 'Ya' : 'Tidak',
      p.terms?.returnCosts ? 'Ya' : 'Tidak',
      p.terms?.holidayWork ? 'Ya' : 'Tidak',
      p.terms?.eatPork ? 'Ya' : 'Tidak',
      p.terms?.handlePork ? 'Ya' : 'Tidak',
      p.notes || '-'
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `data_lengkap_cpmi_${currentCompany}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportFinancialHistory = (person: CPMI) => {
    const personTransactions = transactions.filter(t => t.cpmiId === person.id);
    if (personTransactions.length === 0) {
      alert('Belum ada data keuangan untuk CPMI ini.');
      return;
    }

    const headers = ['Tanggal', 'Tipe', 'Kategori', 'Deskripsi', 'Jumlah'];
    const rows = personTransactions.map(t => [
      format(t.date.toDate(), 'dd/MM/yyyy'),
      t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      t.category,
      t.description,
      t.amount
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `keuangan_${person.fullName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-1">Data CPMI</h2>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-md" />
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">{currentCompany}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={exportToCSV}
            className="flex-1 sm:flex-none bg-slate-900 text-slate-400 border border-white/5 px-6 py-3.5 rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-800 hover:text-white hover:border-white/10 transition-all font-black uppercase tracking-widest text-[10px] shadow-lg group"
          >
            <Download size={18} className="group-hover:-translate-y-0.5 transition-transform" />
            <span>Ekspor CSV</span>
          </button>
          <button 
            onClick={() => { setEditingCPMI(null); setPhotoPreview(null); setPhotoFile(null); setPdfFile(null); setIsModalOpen(true); }}
            className="flex-1 sm:flex-none bg-indigo-600 text-white px-6 py-3.5 rounded-2xl flex items-center justify-center gap-3 hover:bg-indigo-500 transition-all font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" />
            <span>Tambah CPMI</span>
          </button>
        </div>
      </header>

      <div className="bg-slate-900 rounded-[2rem] border border-white/5 shadow-xl overflow-hidden hover:border-white/10 transition-all duration-300">
        <div className="p-6 border-b border-white/5 bg-slate-950/50">
          <div className="relative max-w-xl group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Cari nama, no registrasi, atau negara..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-white/5 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-sm text-white placeholder:text-slate-500 font-medium"
            />
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950/50 text-slate-500 text-[10px] uppercase tracking-[0.3em] font-black border-b border-white/5">
              <tr>
                <th className="px-10 py-6">Nama Lengkap</th>
                <th className="px-10 py-6">No. Registrasi</th>
                <th className="px-10 py-6">Negara</th>
                <th className="px-10 py-6">Sponsor</th>
                <th className="px-10 py-6">Status Berkas</th>
                <th className="px-10 py-6">Proses</th>
                <th className="px-10 py-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCPMI.map((person) => (
                <tr key={person.id} className="hover:bg-white/[0.03] transition-all duration-500 group">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-5">
                      {person.photo ? (
                        <img src={person.photo} className="w-14 h-14 rounded-2xl object-cover border-2 border-white/5 shadow-2xl group-hover:scale-110 transition-transform duration-500" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-14 h-14 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center font-black text-lg border border-indigo-500/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
                          {person.fullName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <span className="font-black text-white block text-base tracking-tight group-hover:text-indigo-400 transition-colors">{person.fullName}</span>
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-0.5">{person.phone || '-'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-slate-400 font-mono text-xs tracking-widest">{person.registrationNumber}</td>
                  <td className="px-10 py-6">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 bg-slate-800/50 px-4 py-2 rounded-xl border border-white/5 shadow-inner">{person.country}</span>
                  </td>
                  <td className="px-10 py-6 text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
                    {sponsors.find(s => s.id === person.sponsorId)?.name || 'Tidak Diketahui'}
                  </td>
                  <td className="px-10 py-6">
                    <span className={cn(
                      "px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl border transition-all duration-500",
                      person.documentStatus === 'Lengkap' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500/20" : 
                      person.documentStatus === 'Proses' ? "bg-blue-500/10 text-blue-400 border-blue-500/20 group-hover:bg-blue-500/20" :
                      "bg-amber-500/10 text-amber-400 border-amber-500/20 group-hover:bg-amber-500/20"
                    )}>
                      {person.documentStatus}
                    </span>
                  </td>
                  <td className="px-10 py-6">
                    <span className="px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-500/20 shadow-2xl group-hover:bg-indigo-500/20 transition-all duration-500">
                      {person.processStatus || 'Proses'}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => { setSelectedCPMI(person); setIsDetailOpen(true); }}
                        className="p-3 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-2xl transition-all border border-transparent hover:border-indigo-500/20 shadow-sm active:scale-90"
                        title="Detail Biodata"
                      >
                        <FileText size={20} />
                      </button>
                      <button 
                        onClick={() => { setEditingCPMI(person); setPhotoPreview(person.photo || null); setPhotoFile(null); setPdfFile(null); setIsModalOpen(true); }}
                        className="p-3 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-2xl transition-all border border-transparent hover:border-emerald-500/20 shadow-sm active:scale-90"
                        title="Edit"
                      >
                        <Edit2 size={20} />
                      </button>
                      <button 
                        onClick={() => { setDeleteId(person.id); setIsConfirmOpen(true); }}
                        className="p-3 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-2xl transition-all border border-transparent hover:border-red-500/20 shadow-sm active:scale-90"
                        title="Hapus"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout */}
        <div className="lg:hidden grid grid-cols-1 gap-4 p-4">
          {filteredCPMI.map((person) => (
            <motion.div 
              key={person.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 p-6 rounded-[2rem] border border-white/5 shadow-lg hover:shadow-xl transition-all duration-300 space-y-4 relative overflow-hidden group hover:border-white/10"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-5">
                  {person.photo ? (
                    <img src={person.photo} className="w-18 h-18 rounded-2xl object-cover border-2 border-white/10 shadow-2xl group-hover:scale-110 transition-transform duration-700" alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-18 h-18 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center font-black text-3xl shadow-2xl shadow-indigo-500/20 group-hover:scale-110 transition-transform duration-700">
                      {person.fullName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h4 className="font-black text-white text-xl leading-tight mb-1 tracking-tight group-hover:text-indigo-400 transition-colors">{person.fullName}</h4>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{person.registrationNumber}</span>
                      <span className="w-1 h-1 bg-slate-200 rounded-full" />
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{person.country}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <span className={cn(
                  "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border",
                  person.documentStatus === 'Lengkap' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                  person.documentStatus === 'Proses' ? "bg-blue-50 text-blue-600 border-blue-100" :
                  "bg-amber-50 text-amber-600 border-amber-100"
                )}>
                  {person.documentStatus}
                </span>
                <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border border-indigo-100">
                  {person.processStatus || 'Proses'}
                </span>
              </div>

              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Sponsor</p>
                  <p className="text-[11px] font-black text-slate-300 uppercase tracking-tight">
                    {sponsors.find(s => s.id === person.sponsorId)?.name || '-'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setSelectedCPMI(person); setIsDetailOpen(true); }}
                    className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all active:scale-90 bg-slate-800 border border-white/5"
                  >
                    <FileText size={16} />
                  </button>
                  <button 
                    onClick={() => { setEditingCPMI(person); setPhotoPreview(person.photo || null); setPhotoFile(null); setPdfFile(null); setIsModalOpen(true); }}
                    className="p-2.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all active:scale-90 bg-slate-800 border border-white/5"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => { setDeleteId(person.id); setIsConfirmOpen(true); }}
                    className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all active:scale-90 bg-slate-800 border border-white/5"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Hapus Data CPMI"
        message="Apakah Anda yakin ingin menghapus data CPMI ini? Tindakan ini tidak dapat dibatalkan."
      />

      {/* Form Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative bg-slate-900 w-full max-w-5xl rounded-[2rem] shadow-2xl overflow-hidden my-4 sm:my-8 flex flex-col max-h-[90vh] border border-white/10"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-slate-950/50 sticky top-0 z-10">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight uppercase tracking-[0.1em]">
                    {editingCPMI ? 'Edit Data CPMI' : 'Formulir Biodata CPMI'}
                  </h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Lengkapi seluruh informasi biodata calon pekerja migran.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white p-3 hover:bg-white/5 rounded-2xl transition-all active:scale-90">
                  <X size={28} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 sm:p-12 space-y-14 overflow-y-auto custom-scrollbar bg-slate-900/50">
                {/* Section: Basic Info */}
                <div className="space-y-8">
                  <h4 className="font-black text-indigo-400 uppercase tracking-[0.3em] text-[11px] flex items-center gap-3">
                    <div className="w-2 h-6 bg-indigo-500 rounded-full shadow-md" />
                    Informasi Dasar
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    <div className="md:row-span-3 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] p-10 bg-white/[0.02] group hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all cursor-pointer relative overflow-hidden shadow-inner">
                      {photoPreview ? (
                        <div className="relative group/photo w-48 h-48">
                          <img src={photoPreview} className="w-full h-full object-cover rounded-[2.5rem] shadow-2xl ring-4 ring-slate-800 group-hover/photo:scale-105 transition-transform duration-700" alt="Preview" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-indigo-600/40 opacity-0 group-hover/photo:opacity-100 transition-all flex items-center justify-center rounded-[2.5rem] backdrop-blur-[2px]">
                            <div className="flex flex-col gap-3">
                              {editingCPMI && photoFile && (
                                <button 
                                  type="button" 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setIsUploading(true);
                                    try {
                                      const photoRef = ref(storage, `cpmi_photos/${Date.now()}_${photoFile.name}`);
                                      const snapshot = await withTimeout(uploadBytes(photoRef, photoFile), 60000) as any;
                                      const photoUrl = await getDownloadURL(snapshot.ref);
                                      await updateDoc(doc(db, 'cpmi', editingCPMI.id), { photo: photoUrl, updatedAt: Timestamp.now() });
                                      setPhotoFile(null);
                                      alert('Foto berhasil disimpan!');
                                    } catch (err) {
                                      console.error(err);
                                      alert('Gagal menyimpan foto.');
                                    } finally {
                                      setIsUploading(false);
                                    }
                                  }}
                                  className="bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest active:scale-90 hover:bg-emerald-600 transition-all"
                                >
                                  Simpan Foto
                                </button>
                              )}
                              <button 
                                type="button" 
                                onClick={() => { setPhotoPreview(null); setPhotoFile(null); }}
                                className="bg-red-500 text-white p-4 rounded-2xl shadow-2xl active:scale-90 hover:bg-red-600 transition-all mx-auto"
                              >
                                <Trash2 size={24} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="w-24 h-24 bg-slate-800/50 text-indigo-400 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 border border-white/5">
                            <Plus size={40} />
                          </div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Foto Profil CPMI</p>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={handlePhotoChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Nama Lengkap</label>
                        <input name="fullName" defaultValue={editingCPMI?.fullName} required className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">No. Registrasi</label>
                        <input name="registrationNumber" defaultValue={editingCPMI?.registrationNumber} required className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-mono text-sm shadow-inner tracking-widest" />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">No. HP CPMI</label>
                        <input name="phone" defaultValue={editingCPMI?.phone} required className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Tanggal Daftar</label>
                        <input type="date" name="registrationDate" defaultValue={editingCPMI?.registrationDate || format(new Date(), 'yyyy-MM-dd')} required className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Negara Tujuan</label>
                        <select name="country" defaultValue={editingCPMI?.country} required className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner appearance-none">
                          <option value="Taiwan">Taiwan</option>
                          <option value="Hong Kong">Hong Kong</option>
                          <option value="Singapura">Singapura</option>
                          <option value="Malaysia">Malaysia</option>
                          <option value="Jepang">Jepang</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sponsor</label>
                          <button 
                            type="button"
                            onClick={() => { setIsModalOpen(false); navigate('/sponsors'); }}
                            className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] hover:text-indigo-300 transition-colors"
                          >
                            + Tambah
                          </button>
                        </div>
                        <select name="sponsorId" defaultValue={editingCPMI?.sponsorId} required className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner appearance-none">
                          {sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Status Berkas</label>
                          <select name="documentStatus" defaultValue={editingCPMI?.documentStatus || 'Proses'} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner appearance-none">
                            <option value="Proses">Proses</option>
                            <option value="Lengkap">Lengkap</option>
                            <option value="Kurang">Kurang</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Update Proses CPMI</label>
                          <select name="processStatus" defaultValue={editingCPMI?.processStatus || 'Proses'} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner appearance-none">
                            <option value="Proses">Proses</option>
                            <option value="Medical Checkup">Medical Checkup</option>
                            <option value="LPK">LPK</option>
                            <option value="ID Paspor">ID Paspor</option>
                            <option value="MCU FULL">MCU FULL</option>
                            <option value="OPP">OPP</option>
                            <option value="Teto">Teto</option>
                            <option value="Terbang">Terbang</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Personal Details */}
                <div className="space-y-8">
                  <h4 className="font-black text-indigo-400 uppercase tracking-[0.3em] text-[11px] flex items-center gap-3">
                    <div className="w-2 h-6 bg-indigo-500 rounded-full shadow-md" />
                    Data Pribadi
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="sm:col-span-2 space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Alamat</label>
                      <input name="address" defaultValue={editingCPMI?.address} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Agama</label>
                      <input name="religion" defaultValue={editingCPMI?.religion} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Umur</label>
                      <input type="number" name="age" defaultValue={editingCPMI?.age} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Tempat Lahir</label>
                      <input name="pob" defaultValue={editingCPMI?.pob} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Tanggal Lahir</label>
                      <input type="date" name="dob" defaultValue={editingCPMI?.dob} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Tinggi (cm)</label>
                      <input type="number" name="height" defaultValue={editingCPMI?.height} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Berat (kg)</label>
                      <input type="number" name="weight" defaultValue={editingCPMI?.weight} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                    </div>
                  </div>
                </div>

                {/* Section: Family */}
                <div className="space-y-8">
                  <h4 className="font-black text-indigo-400 uppercase tracking-[0.3em] text-[11px] flex items-center gap-3">
                    <div className="w-2 h-6 bg-indigo-500 rounded-full shadow-md" />
                    Data Keluarga
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Nama Bapak</label>
                      <input name="fatherName" defaultValue={editingCPMI?.fatherName} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Nama Ibu</label>
                      <input name="motherName" defaultValue={editingCPMI?.motherName} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Nama Suami/Istri</label>
                      <input name="spouseName" defaultValue={editingCPMI?.spouseName} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Pekerjaan</label>
                      <input name="occupation" defaultValue={editingCPMI?.occupation} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Jumlah Saudara</label>
                      <input type="number" name="siblingsCount" defaultValue={editingCPMI?.siblingsCount} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Anak ke Berapa</label>
                      <input type="number" name="birthOrder" defaultValue={editingCPMI?.birthOrder} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Pendidikan Terakhir</label>
                      <input name="education" defaultValue={editingCPMI?.education} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Status Pernikahan</label>
                      <select name="maritalStatus" defaultValue={editingCPMI?.maritalStatus} className="w-full px-5 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-black text-sm shadow-inner appearance-none">
                        <option value="Single">Single</option>
                        <option value="Menikah">Menikah</option>
                        <option value="Cerai Hidup">Cerai Hidup</option>
                        <option value="Cerai Mati">Cerai Mati</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section: Skills & Docs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    <h4 className="font-black text-indigo-400 uppercase tracking-[0.3em] text-[11px] flex items-center gap-3">
                      <div className="w-2 h-6 bg-indigo-500 rounded-full shadow-md" />
                      Kemampuan Bahasa
                    </h4>
                    <div className="grid grid-cols-1 gap-3">
                      {['mandarin', 'english', 'cantonese'].map(lang => (
                        <label key={lang} className="flex items-center gap-4 p-5 bg-slate-800/50 rounded-2xl cursor-pointer hover:bg-slate-800 transition-all border border-white/5 group active:scale-[0.98]">
                          <input type="checkbox" name={`lang_${lang}`} defaultChecked={(editingCPMI?.languages as any)?.[lang]} className="w-6 h-6 rounded-lg text-indigo-500 focus:ring-indigo-500 bg-slate-950 border-white/10" />
                          <span className="capitalize font-black text-slate-300 text-sm tracking-widest group-hover:text-white transition-colors">{lang}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-8">
                    <h4 className="font-black text-indigo-400 uppercase tracking-[0.3em] text-[11px] flex items-center gap-3">
                      <div className="w-2 h-6 bg-indigo-500 rounded-full shadow-md" />
                      Kelengkapan Dokumen
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {['ktp', 'kk', 'aktaLahir', 'bukuNikah', 'suratIjin', 'ijasah', 'aktaCerai', 'paspor'].map(doc => (
                        <label key={doc} className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-2xl cursor-pointer hover:bg-slate-800 transition-all border border-white/5 group active:scale-[0.98]">
                          <input type="checkbox" name={`doc_${doc}`} defaultChecked={(editingCPMI?.documents as any)?.[doc]} className="w-5 h-5 rounded-lg text-indigo-500 focus:ring-indigo-500 bg-slate-950 border-white/10" />
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover:text-slate-300 transition-colors">{doc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section: Experience & Terms */}
                <div className="space-y-8">
                  <h4 className="font-black text-indigo-400 uppercase tracking-[0.3em] text-[11px] flex items-center gap-3">
                    <div className="w-2 h-6 bg-indigo-500 rounded-full shadow-md" />
                    Pengalaman Kerja & T&C
                  </h4>
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Input Pengalaman Kerja</label>
                      <textarea name="workExperience" defaultValue={editingCPMI?.workExperience} rows={4} className="w-full px-6 py-5 bg-slate-800/50 border border-white/5 rounded-[2rem] focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none text-white font-black text-sm shadow-inner placeholder:text-slate-600" placeholder="Ceritakan pengalaman kerja anda..." />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { id: 'familyConsent', label: 'Apakah anda mendapat restu dari keluarga?' },
                        { id: 'contractCompletion', label: 'Sanggupkah anda bekerja selama kontrak SELESAI?' },
                        { id: 'returnCosts', label: 'Anda setuju untuk menanggung sendiri biaya pulang jika kontrak belum selesai?' },
                        { id: 'holidayWork', label: 'Sanggupkah anda bekerja pada hari minggu dan hari libur?' },
                        { id: 'eatPork', label: 'Bolehkah anda makan daging babi?' },
                        { id: 'handlePork', label: 'Apakah anda bisa memegang dan memotong daging babi?' },
                        { id: 'dogCare', label: 'Bolehkah anda memelihara anjing?' },
                        { id: 'elderlyCare', label: 'Bolehkah anda merawat orang tua/jompo?' },
                        { id: 'disabledCare', label: 'Bolehkah anda merawat orang cacat?' },
                        { id: 'babyCare', label: 'Bolehkah anda merawat bayi?' },
                        { id: 'childCare', label: 'Bolehkah anda merawat anak kecil?' },
                        { id: 'cooking', label: 'Bolehkah anda memasak?' },
                        { id: 'cleaning', label: 'Bolehkah anda membersihkan rumah?' },
                        { id: 'washing', label: 'Bolehkah anda mencuci baju?' },
                        { id: 'ironing', label: 'Bolehkah anda menyetrika?' },
                        { id: 'carWash', label: 'Bolehkah anda mencuci mobil?' },
                        { id: 'noPhoneWork', label: 'Bolehkah anda tidak memegang HP saat bekerja?' }
                      ].map(item => (
                        <label key={item.id} className="flex items-center gap-4 p-5 bg-slate-800/50 rounded-2xl cursor-pointer hover:bg-slate-800 transition-all border border-white/5 group active:scale-[0.98]">
                          <input type="checkbox" name={`term_${item.id}`} defaultChecked={(editingCPMI?.terms as any)?.[item.id]} className="w-6 h-6 rounded-lg text-indigo-500 focus:ring-indigo-500 bg-slate-950 border-white/10" />
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-relaxed group-hover:text-slate-200 transition-colors">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Note / Keterangan Tambahan</label>
                  <textarea name="notes" defaultValue={editingCPMI?.notes} rows={4} className="w-full px-6 py-5 bg-slate-800/50 border border-white/5 rounded-[2rem] focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none text-white font-black text-sm shadow-inner placeholder:text-slate-600" placeholder="Catatan tambahan..." />
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Upload Berkas PDF</label>
                  <div className="flex items-center gap-6 p-6 bg-slate-800/50 border border-white/5 rounded-[2rem] shadow-inner">
                    <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center text-indigo-500 border border-white/5">
                      <FileText size={32} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-slate-200 tracking-widest uppercase">{pdfFile ? pdfFile.name : editingCPMI?.pdfUrl ? 'Berkas PDF sudah ada' : 'Belum ada berkas PDF'}</p>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Format: PDF (Maks. 5MB)</p>
                    </div>
                    <label className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-indigo-500 transition-all shadow-lg active:scale-95">
                      Pilih File
                      <input type="file" accept="application/pdf" onChange={handlePdfChange} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="flex gap-6 pt-10 border-t border-white/5 sticky bottom-0 bg-slate-900 pb-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-10 py-5 bg-white/5 border border-white/10 text-slate-400 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all active:scale-95"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={isUploading}
                    className="flex-[2] px-10 py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all shadow-lg disabled:opacity-50 active:scale-95 flex items-center justify-center gap-4"
                  >
                    {isUploading ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" /> : (editingCPMI ? 'Perbarui Data CPMI' : 'Simpan Data CPMI')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailOpen && selectedCPMI && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDetailOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden my-4 sm:my-8 flex flex-col max-h-[90vh] border border-white/10">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-900 sticky top-0 z-10 modal-header">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight leading-tight">{selectedCPMI.fullName}</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">{selectedCPMI.registrationNumber} • {selectedCPMI.company}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => window.print()}
                    className="p-2.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                    title="Cetak Biodata"
                  >
                    <Printer size={20} />
                  </button>
                  <button onClick={() => setIsDetailOpen(false)} className="text-slate-500 hover:text-white p-2.5 hover:bg-white/5 rounded-full transition-all">
                    <X size={24} />
                  </button>
                </div>
              </div>
              
              <div id="printable-biodata" className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-10 custom-scrollbar bg-slate-900">
                <style dangerouslySetInnerHTML={{ __html: `
                  @media print {
                    @page { size: A4; margin: 1.5cm; }
                    
                    /* Hide everything by default */
                    body * { visibility: hidden !important; }
                    
                    /* Show only the printable container and its children */
                    #printable-biodata, #printable-biodata * { 
                      visibility: visible !important; 
                    }
                    
                    /* Reset container positioning for print */
                    #printable-biodata { 
                      position: absolute !important; 
                      left: 0 !important; 
                      top: 0 !important; 
                      width: 100% !important; 
                      padding: 0 !important;
                      margin: 0 !important;
                      display: block !important;
                      height: auto !important;
                      overflow: visible !important;
                      background: white !important;
                      z-index: 9999 !important;
                    }

                    /* Hide UI elements that shouldn't be printed */
                    aside, header, .modal-header, .modal-footer, .no-print, button { 
                      display: none !important; 
                    }

                    /* Force colors and backgrounds */
                    * {
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                      color-adjust: exact !important;
                    }

                    /* Layout adjustments for print */
                    .bg-slate-50, .bg-slate-50\/50, .bg-white, .bg-amber-50\/50 { 
                      background-color: #f8fafc !important; 
                      border: 1px solid #e2e8f0 !important; 
                    }
                    .bg-amber-50\/50 { background-color: #fffbeb !important; }
                    .bg-indigo-600 { background-color: #4f46e5 !important; }
                    .text-indigo-600 { color: #4f46e5 !important; }
                    
                    .grid { display: grid !important; gap: 1.5rem !important; }
                    .md\:grid-cols-3 { grid-template-columns: 200px 1fr !important; }
                    .md\:col-span-2 { grid-column: span 2 !important; }
                    .sm\:grid-cols-2 { grid-template-columns: 1fr 1fr !important; }
                    
                    /* Prevent content cutting */
                    section { 
                      break-inside: avoid !important; 
                      page-break-inside: avoid !important;
                      margin-bottom: 2rem !important; 
                      display: block !important;
                    }
                    
                    img { 
                      max-width: 180px !important; 
                      height: auto !important; 
                      border-radius: 12px !important; 
                      display: block !important;
                    }

                    h3 { font-size: 24pt !important; margin-bottom: 8pt !important; }
                    h4 { font-size: 14pt !important; margin-bottom: 12pt !important; border-bottom: 2px solid #4f46e5 !important; padding-bottom: 4pt !important; }
                    p { font-size: 11pt !important; color: #1e293b !important; }
                    .text-slate-400 { color: #64748b !important; }
                  }
                `}} />
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-6">
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-slate-200 shadow-sm max-w-[240px] mx-auto md:max-w-none">
                      <img src={selectedCPMI.photo || `https://ui-avatars.com/api/?name=${selectedCPMI.fullName}&size=400`} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                    </div>
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status Berkas</p>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block",
                          selectedCPMI.documentStatus === 'Lengkap' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : 
                          selectedCPMI.documentStatus === 'Proses' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                          "bg-amber-50 text-amber-600 border border-amber-100"
                        )}>
                          {selectedCPMI.documentStatus}
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Proses Saat Ini</p>
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-indigo-100 inline-block">
                          {selectedCPMI.processStatus || 'Proses'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-8">
                    <section className="space-y-4">
                      <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-xs flex items-center gap-2">
                        <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                        Informasi Personal
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Agama</p><p className="font-semibold text-slate-700">{selectedCPMI.religion || '-'}</p></div>
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Umur</p><p className="font-semibold text-slate-700">{selectedCPMI.age || '-'} Tahun</p></div>
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">No. HP</p><p className="font-semibold text-slate-700">{selectedCPMI.phone || '-'}</p></div>
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tempat, Tgl Lahir</p><p className="font-semibold text-slate-700">{selectedCPMI.pob}, {selectedCPMI.dob ? format(new Date(selectedCPMI.dob), 'dd MMM yyyy') : '-'}</p></div>
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tinggi / Berat</p><p className="font-semibold text-slate-700">{selectedCPMI.height}cm / {selectedCPMI.weight}kg</p></div>
                        <div className="sm:col-span-2"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Alamat</p><p className="font-semibold text-slate-700 leading-relaxed">{selectedCPMI.address || '-'}</p></div>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-xs flex items-center gap-2">
                        <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                        Data Keluarga & Status
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bapak / Ibu</p><p className="font-semibold text-slate-700">{selectedCPMI.fatherName} / {selectedCPMI.motherName}</p></div>
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Suami/Istri</p><p className="font-semibold text-slate-700">{selectedCPMI.spouseName || '-'}</p></div>
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status / Anak</p><p className="font-semibold text-slate-700">{selectedCPMI.maritalStatus} / {selectedCPMI.childrenCount} Anak</p></div>
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pendidikan</p><p className="font-semibold text-slate-700">{selectedCPMI.education || '-'}</p></div>
                      </div>
                    </section>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-100">
                  <section className="space-y-4">
                    <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-xs flex items-center gap-2">
                      <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                      Kemampuan Bahasa
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedCPMI.languages || {}).map(([lang, val]) => (
                        val && <span key={lang} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600">{lang}</span>
                      ))}
                    </div>
                  </section>
                  <section className="space-y-4">
                    <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-xs flex items-center gap-2">
                      <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                      Dokumen Tersedia
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedCPMI.documents || {}).map(([doc, val]) => (
                        val && <span key={doc} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600">{doc}</span>
                      ))}
                    </div>
                  </section>
                </div>

                <section className="pt-8 border-t border-slate-100 space-y-4">
                  <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-xs flex items-center gap-2">
                    <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                    Pengalaman Kerja
                  </h4>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <p className="text-slate-600 font-medium leading-relaxed italic whitespace-pre-wrap">"{selectedCPMI.workExperience || 'Tidak ada data pengalaman.'}"</p>
                  </div>
                </section>

                <section className="pt-8 border-t border-slate-100 space-y-4">
                  <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-xs flex items-center gap-2">
                    <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                    Terms & Conditions
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'familyConsent', label: 'Restu Keluarga' },
                      { id: 'contractCompletion', label: 'Sanggup Selesai Kontrak' },
                      { id: 'returnCosts', label: 'Tanggung Biaya Pulang' },
                      { id: 'holidayWork', label: 'Kerja Hari Libur' },
                      { id: 'eatPork', label: 'Makan Babi' },
                      { id: 'handlePork', label: 'Pegang/Potong Babi' },
                    ].map(term => (
                      <div key={term.id} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{term.label}</span>
                        {(selectedCPMI.terms as any)?.[term.id] ? <CheckCircle2 className="text-emerald-500" size={18} /> : <X className="text-red-400" size={18} />}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="pt-8 border-t border-slate-100 space-y-4">
                  <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-xs flex items-center gap-2">
                    <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                    Catatan / Review Tambahan
                  </h4>
                  <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100">
                    <p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{selectedCPMI.notes || 'Tidak ada catatan tambahan.'}</p>
                  </div>
                </section>

                <section className="pt-8 border-t border-slate-100 space-y-4 no-print">
                  <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-xs flex items-center gap-2">
                    <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                    Riwayat Keuangan CPMI
                  </h4>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Data Transaksi</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total {transactions.filter(t => t.cpmiId === selectedCPMI.id).length} Transaksi</p>
                      </div>
                      <button 
                        onClick={() => exportFinancialHistory(selectedCPMI)}
                        className="bg-white text-emerald-600 border border-emerald-200 px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-50 transition-all flex items-center gap-2"
                      >
                        <Download size={14} />
                        Ekspor Keuangan
                      </button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {transactions.filter(t => t.cpmiId === selectedCPMI.id).map(t => (
                        <div key={t.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                          <div>
                            <p className="text-xs font-bold text-slate-900">{t.description}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{format(t.date.toDate(), 'dd MMM yyyy')} • {t.category}</p>
                          </div>
                          <p className={cn(
                            "text-xs font-bold",
                            t.type === 'income' ? "text-emerald-600" : "text-red-600"
                          )}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                          </p>
                        </div>
                      ))}
                      {transactions.filter(t => t.cpmiId === selectedCPMI.id).length === 0 && (
                        <p className="text-center py-4 text-xs text-slate-400 italic">Belum ada riwayat transaksi.</p>
                      )}
                    </div>
                  </div>
                </section>

                {selectedCPMI.pdfUrl && (
                  <section className="pt-8 border-t border-slate-100 space-y-4 no-print">
                    <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-xs flex items-center gap-2">
                      <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                      Berkas PDF Terlampir
                    </h4>
                    <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-50 text-red-600 rounded-lg flex items-center justify-center border border-red-100">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Berkas Dokumen CPMI</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Format: PDF</p>
                        </div>
                      </div>
                      <a 
                        href={selectedCPMI.pdfUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-all flex items-center gap-2"
                      >
                        <Download size={14} />
                        Unduh PDF
                      </a>
                    </div>
                  </section>
                )}
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 modal-footer">
                <button onClick={() => setIsDetailOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold text-sm hover:bg-slate-100 rounded-lg transition-all">Tutup</button>
                <button onClick={() => window.print()} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-sm">
                  <Download size={18} />
                  <span>Simpan PDF / Cetak</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SponsorsPage = ({ sponsors }: { sponsors: Sponsor[] }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      contactPerson: formData.get('contactPerson') as string,
      whatsapp: formData.get('whatsapp') as string,
      updatedAt: Timestamp.now(),
    };

    try {
      if (editingSponsor) {
        await updateDoc(doc(db, 'sponsors', editingSponsor.id), data);
      } else {
        await addDoc(collection(db, 'sponsors'), {
          ...data,
          createdAt: Timestamp.now(),
        });
      }
      setIsModalOpen(false);
      setEditingSponsor(null);
    } catch (error) {
      handleFirestoreError(error, editingSponsor ? OperationType.UPDATE : OperationType.CREATE, 'sponsors');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'sponsors', deleteId));
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'sponsors');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-1">Data Sponsor</h2>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shadow-md" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Kelola daftar sponsor dan agen penyalur.</p>
          </div>
        </div>
        <button 
          onClick={() => { setEditingSponsor(null); setIsModalOpen(true); }}
          className="bg-purple-600 text-white px-6 py-3.5 rounded-2xl flex items-center gap-3 hover:bg-purple-500 transition-all font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 group"
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" />
          <span>Tambah Sponsor</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sponsors.map((sponsor) => (
          <motion.div
            key={sponsor.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="group bg-slate-900 p-6 rounded-[2rem] border border-white/5 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden hover:border-white/10"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-2xl shadow-md group-hover:scale-105 transition-all duration-300 border-2 border-slate-800">
                {sponsor.name.charAt(0)}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setEditingSponsor(sponsor); setIsModalOpen(true); }}
                  className="p-2.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all border border-transparent hover:border-indigo-500/20 shadow-sm active:scale-90"
                  title="Edit"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => { setDeleteId(sponsor.id); setIsConfirmOpen(true); }}
                  className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20 shadow-sm active:scale-90"
                  title="Hapus"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight leading-tight group-hover:text-purple-400 transition-colors">{sponsor.name}</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Sponsor Agency</p>
              </div>
              
              <div className="space-y-2 pt-4 border-t border-white/5">
                <div className="flex items-center gap-3 text-slate-400 group/item">
                  <div className="w-8 h-8 bg-slate-800/50 rounded-lg flex items-center justify-center text-slate-500 group-hover/item:bg-indigo-500/10 group-hover/item:text-indigo-400 transition-all">
                    <Users size={14} />
                  </div>
                  <span className="text-sm font-bold tracking-tight">{sponsor.contactPerson || '-'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 group/item">
                  <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400 group-hover/item:bg-emerald-500/20 transition-all">
                    <MessageCircle size={14} />
                  </div>
                  <span className="text-sm font-bold tracking-tight">{sponsor.whatsapp || '-'}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Hapus Sponsor"
        message="Apakah Anda yakin ingin menghapus sponsor ini? Tindakan ini tidak dapat dibatalkan."
      />

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative bg-slate-900 border border-white/10 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-10 border-b border-white/5 flex items-center justify-between bg-slate-950/50">
                <h3 className="text-2xl font-black text-white tracking-tight uppercase tracking-[0.1em]">
                  {editingSponsor ? 'Edit Sponsor' : 'Tambah Sponsor'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white p-3 hover:bg-white/5 rounded-2xl transition-all active:scale-90">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-10 space-y-8 bg-slate-900/50">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Nama Sponsor</label>
                  <input 
                    name="name" 
                    defaultValue={editingSponsor?.name}
                    required 
                    className="w-full px-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-purple-500/50 outline-none font-black text-white transition-all text-sm shadow-inner placeholder:text-slate-600"
                    placeholder="Masukkan nama sponsor"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Kontak Person</label>
                  <input 
                    name="contactPerson" 
                    defaultValue={editingSponsor?.contactPerson}
                    className="w-full px-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-purple-500/50 outline-none font-black text-white transition-all text-sm shadow-inner placeholder:text-slate-600"
                    placeholder="Nama penanggung jawab"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">No. WhatsApp</label>
                  <input 
                    name="whatsapp" 
                    defaultValue={editingSponsor?.whatsapp}
                    className="w-full px-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-purple-500/50 outline-none font-black text-white transition-all text-sm shadow-inner placeholder:text-slate-600"
                    placeholder="Contoh: 08123456789"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-8 py-4 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all active:scale-95"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-[2] px-8 py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-purple-500 transition-all shadow-lg disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3"
                  >
                    {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (editingSponsor ? 'Simpan Perubahan' : 'Tambah Sponsor')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TransactionsPage = ({ transactions, cpmi }: { transactions: Transaction[], cpmi: CPMI[] }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [filterCpmiId, setFilterCpmiId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
    }
  }, [editingTransaction]);

  const filteredTransactions = useMemo(() => {
    if (!filterCpmiId) return transactions;
    return transactions.filter(t => t.cpmiId === filterCpmiId);
  }, [transactions, filterCpmiId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      type: type,
      amount: Number(formData.get('amount')),
      category: formData.get('category') as string,
      description: formData.get('description') as string,
      cpmiId: formData.get('cpmiId') as string || null,
      date: Timestamp.fromDate(new Date(formData.get('date') as string)),
      updatedAt: Timestamp.now(),
    };

    try {
      if (editingTransaction) {
        await updateDoc(doc(db, 'transactions', editingTransaction.id), data);
      } else {
        await addDoc(collection(db, 'transactions'), {
          ...data,
          createdAt: Timestamp.now(),
        });
      }
      setIsModalOpen(false);
      setEditingTransaction(null);
    } catch (error) {
      handleFirestoreError(error, editingTransaction ? OperationType.UPDATE : OperationType.CREATE, 'transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'transactions', deleteId));
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'transactions');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-1">Manajemen Keuangan</h2>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-md" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Catat pemasukan dan pengeluaran operasional secara digital.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <select 
              value={filterCpmiId}
              onChange={(e) => setFilterCpmiId(e.target.value)}
              className="bg-slate-900 border border-white/5 px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none pr-12 min-w-[220px] shadow-lg hover:bg-slate-800 transition-all cursor-pointer"
            >
              <option value="">Semua CPMI</option>
              {cpmi.map(p => (
                <option key={p.id} value={p.id}>{p.fullName}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-indigo-400 transition-colors" size={18} />
          </div>
          <button 
            onClick={() => { setEditingTransaction(null); setType('income'); setIsModalOpen(true); }}
            className="bg-emerald-600 text-white px-6 py-3.5 rounded-2xl flex items-center gap-3 hover:bg-emerald-500 transition-all duration-500 shadow-lg font-black uppercase tracking-widest text-[10px] active:scale-95 group"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" />
            <span>Tambah Transaksi</span>
          </button>
        </div>
      </header>

      <div className="bg-slate-900 rounded-[2rem] border border-white/5 shadow-xl overflow-hidden hover:border-white/10 transition-all duration-300">
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-white/5">
                <th className="px-10 py-6 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Tanggal</th>
                <th className="px-10 py-6 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Deskripsi</th>
                <th className="px-10 py-6 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Kategori</th>
                <th className="px-10 py-6 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">CPMI Terkait</th>
                <th className="px-10 py-6 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] text-right">Jumlah</th>
                <th className="px-10 py-6 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-white/[0.03] transition-all duration-500 group">
                  <td className="px-10 py-6 text-slate-400 font-mono text-xs tracking-widest">
                    {format(t.date.toDate(), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-10 py-6">
                    <p className="font-black text-white group-hover:text-indigo-400 transition-colors tracking-tight text-base">{t.description}</p>
                  </td>
                  <td className="px-10 py-6">
                    <span className="px-4 py-2 bg-slate-800/50 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 shadow-inner">
                      {t.category}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                    {cpmi.find(p => p.id === t.cpmiId)?.fullName || '-'}
                  </td>
                  <td className={cn(
                    "px-10 py-6 text-right font-black text-xl tracking-tight",
                    t.type === 'income' ? "text-emerald-400" : "text-red-400"
                  )}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => { setEditingTransaction(t); setIsModalOpen(true); }}
                        className="p-3 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-2xl transition-all border border-transparent hover:border-indigo-500/20 shadow-sm active:scale-90"
                        title="Edit"
                      >
                        <Edit2 size={20} />
                      </button>
                      <button 
                        onClick={() => { setDeleteId(t.id); setIsConfirmOpen(true); }}
                        className="p-3 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-2xl transition-all border border-transparent hover:border-red-500/20 shadow-sm active:scale-90"
                        title="Hapus"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden grid grid-cols-1 gap-4 p-4">
          {filteredTransactions.map((t) => (
            <motion.div 
              key={t.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 p-6 rounded-[2rem] border border-white/5 shadow-lg hover:shadow-xl transition-all duration-300 space-y-4 relative overflow-hidden group hover:border-white/10"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-5">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-700 group-hover:scale-110 group-hover:rotate-6",
                    t.type === 'income' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-red-500/20 text-red-400 border border-red-500/20"
                  )}>
                    {t.type === 'income' ? <TrendingUp size={28} strokeWidth={2} /> : <TrendingDown size={28} strokeWidth={2} />}
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">{format(t.date.toDate(), 'dd MMM yyyy')}</p>
                    <p className="font-black text-white uppercase tracking-tight leading-tight text-lg group-hover:text-indigo-400 transition-colors">{t.description}</p>
                  </div>
                </div>
                <div className={cn(
                  "font-black text-xl tracking-tight",
                  t.type === 'income' ? "text-emerald-400" : "text-red-400"
                )}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div className="flex flex-col gap-1.5">
                  <span className="px-3 py-1 bg-slate-800/50 text-slate-400 rounded-xl text-[8px] font-black uppercase tracking-widest border border-white/5 w-fit">
                    {t.category}
                  </span>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    CPMI: <span className="text-slate-300">{cpmi.find(p => p.id === t.cpmiId)?.fullName.split(' ')[0] || '-'}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setEditingTransaction(t); setIsModalOpen(true); }}
                    className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all active:scale-90 bg-slate-800 border border-white/5"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => { setDeleteId(t.id); setIsConfirmOpen(true); }}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all active:scale-90 bg-slate-800 border border-white/5"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredTransactions.length === 0 && (
          <div className="p-20 text-center text-slate-500 font-bold uppercase tracking-widest">Belum ada data transaksi.</div>
        )}
      </div>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Hapus Transaksi"
        message="Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan."
      />

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative bg-slate-900 border border-white/10 w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-10 border-b border-white/5 flex items-center justify-between bg-slate-950/50">
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight uppercase tracking-[0.1em]">
                    {editingTransaction ? 'Edit Transaksi' : 'Tambah Transaksi'}
                  </h3>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-2 opacity-60">Lengkapi detail transaksi keuangan di bawah ini.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white p-3 hover:bg-white/5 rounded-2xl transition-all active:scale-90">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar bg-slate-900/50">
                <div className="flex p-1.5 bg-slate-950 rounded-[1.5rem] border border-white/5 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={cn(
                      "flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500",
                      type === 'income' ? "bg-emerald-600 text-white shadow-md" : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    Pemasukan
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={cn(
                      "flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500",
                      type === 'expense' ? "bg-red-600 text-white shadow-md" : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    Pengeluaran
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Jumlah (Rp)</label>
                    <input 
                      name="amount" 
                      type="number" 
                      defaultValue={editingTransaction?.amount}
                      required 
                      className="w-full px-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-black text-white transition-all text-sm shadow-inner placeholder:text-slate-600"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Tanggal</label>
                    <input 
                      name="date" 
                      type="date" 
                      defaultValue={editingTransaction ? format(editingTransaction.date.toDate(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                      required 
                      className="w-full px-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-black text-white transition-all text-sm shadow-inner"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Kategori</label>
                  <div className="relative group">
                    <select 
                      name="category" 
                      defaultValue={editingTransaction?.category}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-black text-white transition-all appearance-none text-sm shadow-inner cursor-pointer"
                    >
                      <option value="Biaya MD">Biaya MD</option>
                      <option value="Fee Sponsor">Fee Sponsor</option>
                      <option value="ID Paspor">ID Paspor</option>
                      <option value="Living Cost">Living Cost</option>
                      <option value="Mcu Pra">Mcu Pra</option>
                      <option value="Royalti">Royalti</option>
                      <option value="Transport">Transport</option>
                      <option value="Keterangan Lain">Keterangan Lain</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-indigo-400 transition-colors" size={18} />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Keterangan</label>
                  <input 
                    name="description" 
                    defaultValue={editingTransaction?.description}
                    required 
                    className="w-full px-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-black text-white transition-all text-sm shadow-inner placeholder:text-slate-600"
                    placeholder="Contoh: Pembayaran Paspor"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">CPMI Terkait (Opsional)</label>
                  <div className="relative group">
                    <select 
                      name="cpmiId" 
                      defaultValue={editingTransaction?.cpmiId || ''}
                      className="w-full px-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-black text-white transition-all appearance-none text-sm shadow-inner cursor-pointer"
                    >
                      <option value="">Tidak Ada</option>
                      {cpmi.map(p => (
                        <option key={p.id} value={p.id}>{p.fullName}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-indigo-400 transition-colors" size={18} />
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-8 py-4 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all active:scale-95"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className={cn(
                      "flex-[2] px-8 py-4 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3",
                      type === 'income' ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30" : "bg-red-600 hover:bg-red-500 shadow-red-600/30",
                      loading && "opacity-50"
                    )}
                  >
                    {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (editingTransaction ? 'Simpan Perubahan' : 'Tambah Transaksi')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ReportsPage = ({ transactions }: { transactions: Transaction[] }) => {
  const reportData = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    
    const byCategory = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + (t.type === 'income' ? t.amount : -t.amount);
      return acc;
    }, {} as Record<string, number>);

    return { income, expense, balance: income - expense, byCategory };
  }, [transactions]);

  const exportToCSV = () => {
    const headers = ['Tanggal', 'Tipe', 'Kategori', 'Deskripsi', 'Jumlah'];
    const rows = transactions.map(t => [
      format(t.date.toDate(), 'dd/MM/yyyy'),
      t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      t.category,
      t.description,
      t.amount
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `laporan_keuangan_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-1">Laporan Keuangan</h2>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-md" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Analisis performa keuangan dan operasional perusahaan.</p>
          </div>
        </div>
        <button 
          onClick={exportToCSV}
          className="bg-slate-800 text-white px-6 py-3.5 rounded-2xl flex items-center gap-3 hover:bg-slate-700 transition-all duration-300 border border-white/10 font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 group"
        >
          <Download size={20} className="group-hover:translate-y-0.5 transition-transform" />
          <span>Ekspor CSV</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 p-8 rounded-[2rem] border border-white/5 shadow-xl hover:border-white/10 transition-all duration-300 group">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3 group-hover:text-emerald-400 transition-colors">Total Pemasukan</p>
          <p className="text-3xl font-black text-emerald-400 tracking-tight">{formatCurrency(reportData.income)}</p>
        </div>
        <div className="bg-slate-900 p-8 rounded-[2rem] border border-white/5 shadow-xl hover:border-white/10 transition-all duration-300 group">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3 group-hover:text-red-400 transition-colors">Total Pengeluaran</p>
          <p className="text-3xl font-black text-red-400 tracking-tight">{formatCurrency(reportData.expense)}</p>
        </div>
        <div className="bg-slate-900 p-8 rounded-[2rem] border border-white/5 shadow-xl hover:border-white/10 transition-all duration-300 group">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3 group-hover:text-indigo-400 transition-colors">Saldo Saat Ini</p>
          <p className="text-3xl font-black text-indigo-400 tracking-tight">{formatCurrency(reportData.balance)}</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-[2rem] shadow-lg border border-white/10 group hover:scale-[1.02] transition-all duration-300">
          <p className="text-indigo-100/60 text-[10px] font-black uppercase tracking-[0.2em] mb-3">Grand Total (Laba/Rugi)</p>
          <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(reportData.balance)}</p>
        </div>
      </div>

      <div className="bg-slate-900 p-10 rounded-[2rem] border border-white/5 shadow-xl hover:border-white/10 transition-all duration-300">
        <h3 className="font-black text-2xl text-white tracking-tight mb-10 flex items-center gap-4">
          <div className="w-2 h-8 bg-indigo-500 rounded-full shadow-md" />
          Ringkasan per Kategori
        </h3>
        <div className="space-y-10">
          {Object.entries(reportData.byCategory).map(([cat, amount]) => {
            const val = amount as number;
            const percentage = Math.abs(val) / (reportData.income + reportData.expense) * 100 || 0;
            return (
              <div key={cat} className="group">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-black text-slate-400 uppercase tracking-[0.2em] text-[11px] group-hover:text-indigo-400 transition-colors">{cat}</span>
                  <span className={cn(
                    "font-black tracking-tight text-lg",
                    val >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {val >= 0 ? '+' : ''}{formatCurrency(val)}
                  </span>
                </div>
                <div className="h-3 bg-slate-950 rounded-full overflow-hidden border border-white/5 shadow-inner p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(percentage, 100)}%` }}
                    className={cn(
                      "h-full rounded-full transition-all duration-1000 shadow-lg",
                      val >= 0 ? "bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-emerald-500/20" : "bg-gradient-to-r from-red-600 to-red-400 shadow-red-500/20"
                    )}
                  />
                </div>
              </div>
            );
          })}
          {Object.keys(reportData.byCategory).length === 0 && (
            <div className="py-20 text-center">
              <div className="w-20 h-20 bg-slate-800/50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-slate-600 border border-white/5">
                <BarChart3 size={40} />
              </div>
              <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs">Belum ada data kategori.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ===============================================================
// Components
// ===============================================================

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title: string; 
  message: string; 
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="relative bg-slate-900 border border-white/10 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-12 text-center"
          >
            <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-red-500/20 shadow-2xl group">
              <Trash2 size={48} className="group-hover:scale-110 transition-transform duration-500" />
            </div>
            <h3 className="text-3xl font-black text-white mb-3 tracking-tight uppercase tracking-[0.1em]">Hapus Data</h3>
            <p className="text-slate-400 mb-10 leading-relaxed font-bold text-sm uppercase tracking-[0.15em]">{message}</p>
            <div className="flex gap-4">
              <button 
                onClick={onClose}
                className="flex-1 px-8 py-4 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all active:scale-95"
              >
                Batal
              </button>
              <button 
                onClick={() => { onConfirm(); onClose(); }}
                className="flex-1 px-8 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500 transition-all shadow-lg active:scale-95"
              >
                Hapus
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const ProfileModal = ({ 
  isOpen, 
  onClose, 
  user,
  userProfile
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  user: User;
  userProfile: any;
}) => {
  const [displayName, setDisplayName] = useState(userProfile?.displayName || user.displayName || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || user.photoURL || '');
  const [logoURL, setLogoURL] = useState(userProfile?.logoURL || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(userProfile?.displayName || user.displayName || '');
      setPhotoURL(userProfile?.photoURL || user.photoURL || '');
      setLogoURL(userProfile?.logoURL || '');
    }
  }, [isOpen, userProfile, user]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'logo') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'photo') setPhotoURL(reader.result as string);
        else setLogoURL(reader.result as string);
      };
      reader.readAsDataURL(compressed);
    } catch (err) {
      setError('Gagal memproses gambar.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Update Auth display name
      await updateProfile(user, {
        displayName
      });

      // Update Firestore profile
      await setDoc(doc(db, 'users', user.uid), {
        displayName,
        photoURL,
        logoURL,
        updatedAt: Timestamp.now()
      }, { merge: true });

      onClose();
    } catch (err) {
      setError('Gagal memperbarui profil. Silakan coba lagi.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="relative bg-slate-900 border border-white/10 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden"
          >
            <div className="p-10 border-b border-white/5 flex items-center justify-between bg-slate-950/50">
              <h3 className="text-2xl font-black text-white tracking-tight uppercase tracking-[0.1em]">Edit Profil</h3>
              <button onClick={onClose} className="text-slate-500 hover:text-white p-3 hover:bg-white/5 rounded-2xl transition-all active:scale-90">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-10 space-y-8 bg-slate-900/50">
              <div className="grid grid-cols-2 gap-8">
                <div className="flex flex-col items-center gap-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Foto Profil</p>
                  <div className="relative group">
                    <img 
                      src={photoURL || `https://ui-avatars.com/api/?name=${displayName}`} 
                      className="w-28 h-28 rounded-[2rem] object-cover border-4 border-slate-800 shadow-2xl group-hover:scale-105 transition-transform duration-500" 
                      alt="Profile" 
                    />
                    <label className="absolute inset-0 flex items-center justify-center bg-indigo-600/40 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-[2px]">
                      <Plus className="text-white drop-shadow-lg" size={32} />
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'photo')} />
                    </label>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Logo Instansi</p>
                  <div className="relative group">
                    <div className="w-28 h-28 rounded-[2rem] bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center border-4 border-slate-800 shadow-2xl overflow-hidden group-hover:scale-105 transition-transform duration-500">
                      {logoURL ? (
                        <img src={logoURL} className="w-full h-full object-cover" alt="Logo" />
                      ) : (
                        <span className="text-white font-black text-3xl drop-shadow-lg">P3</span>
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-purple-600/40 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-[2px]">
                      <Plus className="text-white drop-shadow-lg" size={32} />
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'logo')} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="w-full px-6 py-4 bg-slate-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none font-black text-white transition-all text-sm shadow-inner placeholder:text-slate-600"
                  placeholder="Masukkan nama lengkap"
                />
              </div>

              {error && (
                <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-500 text-[10px] font-black uppercase tracking-widest shadow-lg">
                  <AlertCircle size={20} />
                  {error}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="flex-1 px-8 py-4 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all active:scale-95"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-500 transition-all shadow-lg disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3"
                >
                  {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const LoginPage = () => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-indigo-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-blue-500/10 rounded-full blur-[150px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-md p-12 sm:p-16 bg-slate-900/90 backdrop-blur-md rounded-[3rem] shadow-2xl border border-white/10 text-center group"
      >
        <div className="w-28 h-28 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-12 shadow-lg overflow-hidden border-4 border-slate-900 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700">
          <span className="text-white font-black text-5xl drop-shadow-2xl">P3</span>
        </div>
        
        <h1 className="text-5xl font-black text-white mb-4 tracking-tight leading-none">P3MI Digital</h1>
        <p className="text-indigo-400 font-black text-[11px] uppercase tracking-[0.4em] mb-8">Management Ecosystem</p>
        <p className="text-slate-400 mb-14 font-bold leading-relaxed text-sm px-6 uppercase tracking-widest opacity-60">Sistem Manajemen Terintegrasi untuk Penyaluran Pekerja Migran Indonesia.</p>
        
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-white text-slate-900 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-4 hover:bg-indigo-50 transition-all duration-500 shadow-2xl active:scale-95 disabled:opacity-50 group/btn"
        >
          {loading ? (
            <div className="w-6 h-6 border-3 border-slate-900 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/button/google.svg" className="w-6 h-6 group-hover/btn:scale-110 transition-transform" alt="Google" />
              <span>Masuk dengan Google</span>
            </>
          )}
        </button>

        <div className="mt-14 pt-10 border-t border-white/5 flex items-center justify-center gap-10">
          <div className="text-center">
            <p className="text-white font-black text-xl leading-none mb-1">100%</p>
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Secure</p>
          </div>
          <div className="w-[1px] h-8 bg-white/5" />
          <div className="text-center">
            <p className="text-white font-black text-xl leading-none mb-1">Cloud</p>
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Sync</p>
          </div>
        </div>

        <p className="mt-12 text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Version 2.0.0 Hybrid Edition</p>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentCompany, setCurrentCompany] = useState<string>('PT Trias Insan Madani Cirebon');

  const [cpmi, setCpmi] = useState<CPMI[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const filteredCpmi = useMemo(() => cpmi.filter(p => p.company === currentCompany), [cpmi, currentCompany]);
  const filteredTransactions = useMemo(() => transactions.filter(t => {
    if (!t.cpmiId) return true;
    const p = cpmi.find(x => x.id === t.cpmiId);
    return p?.company === currentCompany;
  }), [transactions, cpmi, currentCompany]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubCpmi = onSnapshot(
      query(collection(db, 'cpmi'), orderBy('createdAt', 'desc')),
      (snap) => setCpmi(snap.docs.map(d => ({ id: d.id, ...d.data() } as CPMI))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'cpmi')
    );

    const unsubSponsors = onSnapshot(
      query(collection(db, 'sponsors'), orderBy('createdAt', 'desc')),
      (snap) => setSponsors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sponsor))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'sponsors')
    );

    const unsubTransactions = onSnapshot(
      query(collection(db, 'transactions'), orderBy('date', 'desc')),
      (snap) => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    );

    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data());
        }
      }
    );

    return () => {
      unsubCpmi();
      unsubSponsors();
      unsubTransactions();
      unsubProfile();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full shadow-md"
          />
          <p className="text-sm font-black text-slate-400 animate-pulse uppercase tracking-[0.2em]">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100 selection:bg-indigo-500/30">
        <BottomNav />
        
        <main className="flex-1 min-h-screen flex flex-col pb-32">
          <header className="h-24 bg-slate-900/90 backdrop-blur-md border-b border-white/5 px-6 sm:px-12 flex items-center justify-between sticky top-0 z-30 shadow-lg">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-md overflow-hidden border border-white/10 group hover:scale-110 transition-transform duration-500">
                {userProfile?.logoURL ? (
                  <img src={userProfile.logoURL} className="w-full h-full object-cover" alt="Logo" />
                ) : (
                  <span className="font-black text-xl text-white drop-shadow-lg">P3</span>
                )}
              </div>
              <div className="hidden sm:block">
                <h1 className="font-black text-lg tracking-tight text-white uppercase leading-none mb-1">P3MI Digital</h1>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] leading-none opacity-80">Management Ecosystem</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6 sm:gap-10 ml-auto">
            <div className="hidden md:block relative group">
              <select 
                value={currentCompany}
                onChange={(e) => setCurrentCompany(e.target.value)}
                className="bg-slate-800/30 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 px-6 py-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer hover:bg-slate-800/50 appearance-none pr-14 shadow-2xl"
              >
                <option value="PT Trias Insan Madani Cirebon">PT Trias Insan Madani Cirebon</option>
                <option value="PT HARCOSELARAS SENTOSAJAYA">PT HARCOSELARAS SENTOSAJAYA</option>
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-indigo-400 transition-colors">
                <ChevronDown size={16} />
              </div>
            </div>
            
            <div className="text-right hidden sm:block border-l border-white/10 pl-10">
              <p className="text-sm font-black text-white leading-none mb-1.5 tracking-tight">{userProfile?.displayName || user.displayName}</p>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.25em] opacity-60">{user.email?.split('@')[0]}</p>
            </div>
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="relative group transition-transform active:scale-90"
            >
              <div className="w-12 h-12 rounded-[1.2rem] p-0.5 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/20 group-hover:rotate-6 transition-all duration-700">
                <img 
                  src={userProfile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${userProfile?.displayName || user.displayName}`} 
                  className="w-full h-full rounded-[1rem] border-2 border-slate-900 object-cover" 
                  alt="Avatar" 
                />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full shadow-lg" />
            </button>
          </div>
        </header>

        <ProfileModal 
          isOpen={isProfileOpen} 
          onClose={() => setIsProfileOpen(false)} 
          user={user} 
          userProfile={userProfile}
        />

        <div className="p-6 sm:p-12 max-w-7xl mx-auto w-full flex-1">
          <div className="md:hidden mb-10">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 px-1 opacity-60">Pilih Perusahaan</label>
            <div className="relative group">
              <select 
                value={currentCompany}
                onChange={(e) => setCurrentCompany(e.target.value)}
                className="w-full bg-slate-800/30 border border-white/10 text-xs font-black uppercase tracking-widest text-white px-6 py-4 rounded-2xl outline-none shadow-2xl appearance-none transition-all focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="PT Trias Insan Madani Cirebon">PT Trias Insan Madani Cirebon</option>
                <option value="PT HARCOSELARAS SENTOSAJAYA">PT HARCOSELARAS SENTOSAJAYA</option>
              </select>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 transition-colors">
                <ChevronDown size={20} />
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* @ts-ignore */}
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<PageTransition><Dashboard cpmi={filteredCpmi} sponsors={sponsors} transactions={filteredTransactions} /></PageTransition>} />
              <Route path="/cpmi" element={<PageTransition><CPMIPage cpmi={filteredCpmi} sponsors={sponsors} transactions={filteredTransactions} currentCompany={currentCompany} /></PageTransition>} />
              <Route path="/sponsors" element={<PageTransition><SponsorsPage sponsors={sponsors} /></PageTransition>} />
              <Route path="/transactions" element={<PageTransition><TransactionsPage transactions={filteredTransactions} cpmi={filteredCpmi} /></PageTransition>} />
              <Route path="/reports" element={<PageTransition><ReportsPage transactions={filteredTransactions} /></PageTransition>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </div>
      </main>
    </div>
    </ErrorBoundary>
  );
}
