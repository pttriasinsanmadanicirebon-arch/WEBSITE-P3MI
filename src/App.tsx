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
  AlertCircle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Filter,
  Download,
  Menu,
  X,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

import { db, auth } from './firebase';
import { cn, formatCurrency } from './lib/utils';

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

const Sidebar = ({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (v: boolean) => void }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/cpmi', icon: Users, label: 'Data CPMI' },
    { path: '/sponsors', icon: Briefcase, label: 'Data Sponsor' },
    { path: '/transactions', icon: Wallet, label: 'Keuangan' },
    { path: '/reports', icon: FileText, label: 'Laporan' },
  ];

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white text-slate-900 transition-transform duration-500 transform lg:translate-x-0 border-r border-slate-200 shadow-sm",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <span className="font-bold text-xl text-white">P3</span>
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-900">P3MI <span className="text-indigo-600">APP</span></h1>
          </div>

          <nav className="flex-1 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                  location.pathname === item.path 
                    ? "bg-indigo-50 text-indigo-600 font-semibold" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <item.icon size={20} className={cn(
                  "transition-colors",
                  location.pathname === item.path ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                )} />
                <span className="text-sm">{item.label}</span>
                {location.pathname === item.path && (
                  <motion.div 
                    layoutId="active-pill"
                    className="absolute right-0 w-1 h-5 bg-indigo-600 rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </nav>

          <div className="pt-6 border-t border-slate-100">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-slate-500 hover:text-red-600 transition-all duration-200 rounded-xl hover:bg-red-50 group"
            >
              <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Keluar</span>
            </button>
          </div>
        </div>
      </aside>
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
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h2>
          <p className="text-slate-500 text-sm">Ringkasan data operasional P3MI</p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="card-saas p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm",
                stat.color === 'blue' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                stat.color === 'purple' ? "bg-purple-50 text-purple-600 border border-purple-100" :
                stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                "bg-amber-50 text-amber-600 border border-amber-100"
              )}>
                <stat.icon size={24} />
              </div>
            </div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card-saas p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-xl text-slate-900 tracking-tight flex items-center gap-3">
              <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
              CPMI Terbaru
            </h3>
            <Link to="/cpmi" className="text-blue-600 text-xs font-bold uppercase tracking-wider hover:text-blue-700 transition-colors">Lihat Semua</Link>
          </div>
          <div className="space-y-4">
            {cpmi.slice(0, 5).map((person) => (
              <div key={person.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all duration-300 group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-blue-600 font-bold text-lg shadow-sm overflow-hidden">
                    {person.photo ? (
                      <img src={person.photo} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                    ) : person.fullName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{person.fullName}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{person.country} • {person.registrationNumber}</p>
                  </div>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm",
                  person.documentStatus === 'Lengkap' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                )}>
                  {person.documentStatus}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-saas p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-xl text-slate-900 tracking-tight flex items-center gap-3">
              <div className="w-1.5 h-6 bg-purple-600 rounded-full" />
              Transaksi Terakhir
            </h3>
            <Link to="/transactions" className="text-purple-600 text-xs font-bold uppercase tracking-wider hover:text-purple-700 transition-colors">Lihat Semua</Link>
          </div>
          <div className="space-y-4">
            {transactions.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all duration-300 group">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border",
                    t.type === 'income' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                  )}>
                    {t.type === 'income' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 group-hover:text-purple-600 transition-colors">{t.description}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t.category} • {format(t.date.toDate(), 'dd MMM yyyy')}</p>
                  </div>
                </div>
                <p className={cn(
                  "font-bold text-lg tracking-tight",
                  t.type === 'income' ? "text-emerald-600" : "text-red-600"
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

const CPMIPage = ({ cpmi, sponsors, currentCompany }: { cpmi: CPMI[], sponsors: Sponsor[], currentCompany: string }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingCPMI, setEditingCPMI] = useState<CPMI | null>(null);
  const [selectedCPMI, setSelectedCPMI] = useState<CPMI | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const filteredCPMI = useMemo(() => {
    return cpmi.filter(p => 
      p.fullName.toLowerCase().includes(search.toLowerCase()) || 
      p.registrationNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.country.toLowerCase().includes(search.toLowerCase())
    );
  }, [cpmi, search]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { // 500KB limit for base64 in Firestore
        alert('Ukuran foto terlalu besar. Maksimal 500KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      company: currentCompany,
      fullName: formData.get('fullName') as string,
      registrationNumber: formData.get('registrationNumber') as string,
      registrationDate: formData.get('registrationDate') as string,
      phone: formData.get('phone') as string,
      country: formData.get('country') as string,
      sponsorId: formData.get('sponsorId') as string,
      processStatus: formData.get('processStatus') as string || 'Proses',
      photo: photoPreview || editingCPMI?.photo || '',
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

    try {
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
    } catch (error) {
      handleFirestoreError(error, editingCPMI ? OperationType.UPDATE : OperationType.CREATE, 'cpmi');
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
    const headers = ['Nama Lengkap', 'No Registrasi', 'No HP', 'Negara', 'Sponsor', 'Status', 'Proses'];
    const rows = filteredCPMI.map(p => [
      p.fullName,
      p.registrationNumber,
      p.phone || '-',
      p.country,
      sponsors.find(s => s.id === p.sponsorId)?.name || '-',
      p.documentStatus,
      p.processStatus || 'Proses'
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `data_cpmi_${currentCompany}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Data CPMI</h2>
          <p className="text-sm font-medium text-slate-500">{currentCompany}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            className="flex-1 sm:flex-none bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-50 transition-all font-semibold text-sm shadow-sm"
          >
            <Download size={18} />
            <span>Ekspor CSV</span>
          </button>
          <button 
            onClick={() => { setEditingCPMI(null); setPhotoPreview(null); setIsModalOpen(true); }}
            className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all font-semibold text-sm shadow-sm"
          >
            <Plus size={18} />
            <span>Tambah CPMI</span>
          </button>
        </div>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari nama, no registrasi, atau negara..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm text-slate-900 placeholder:text-slate-400 font-medium"
            />
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Nama Lengkap</th>
                <th className="px-6 py-4">No. Registrasi</th>
                <th className="px-6 py-4">Negara</th>
                <th className="px-6 py-4">Sponsor</th>
                <th className="px-6 py-4">Status Berkas</th>
                <th className="px-6 py-4">Proses</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCPMI.map((person) => (
                <tr key={person.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {person.photo ? (
                        <img src={person.photo} className="w-10 h-10 rounded-lg object-cover border border-slate-200" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-xs border border-indigo-100">
                          {person.fullName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-slate-900 block text-sm">{person.fullName}</span>
                        <span className="text-xs text-slate-500 font-medium">{person.phone || '-'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">{person.registrationNumber}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">{person.country}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                    {sponsors.find(s => s.id === person.sponsorId)?.name || 'Tidak Diketahui'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      person.documentStatus === 'Lengkap' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : 
                      person.documentStatus === 'Proses' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                      "bg-amber-50 text-amber-600 border border-amber-100"
                    )}>
                      {person.documentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-indigo-100">
                      {person.processStatus || 'Proses'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => { setSelectedCPMI(person); setIsDetailOpen(true); }}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Detail Biodata"
                      >
                        <FileText size={18} />
                      </button>
                      <button 
                        onClick={() => { setEditingCPMI(person); setPhotoPreview(person.photo || null); setIsModalOpen(true); }}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => { setDeleteId(person.id); setIsConfirmOpen(true); }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Hapus"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout */}
        <div className="lg:hidden divide-y divide-slate-100">
          {filteredCPMI.map((person) => (
            <div key={person.id} className="p-5 space-y-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {person.photo ? (
                        <img src={person.photo} className="w-12 h-12 rounded-xl object-cover border border-slate-200" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-base border border-indigo-100">
                          {person.fullName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-slate-900 text-base leading-tight mb-1">{person.fullName}</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{person.registrationNumber}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                        person.documentStatus === 'Lengkap' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : 
                        person.documentStatus === 'Proses' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                        "bg-amber-50 text-amber-600 border border-amber-100"
                      )}>
                        {person.documentStatus}
                      </span>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-bold uppercase tracking-wider border border-indigo-100">
                        {person.processStatus || 'Proses'}
                      </span>
                    </div>
                  </div>
              
              <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Negara</p>
                  <p className="text-xs font-semibold text-slate-700">{person.country}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Sponsor</p>
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {sponsors.find(s => s.id === person.sponsorId)?.name || '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button 
                  onClick={() => { setSelectedCPMI(person); setIsDetailOpen(true); }}
                  className="flex-1 bg-slate-50 text-indigo-600 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold uppercase text-[10px] tracking-wider hover:bg-indigo-50 transition-all border border-slate-200"
                >
                  <FileText size={14} />
                  Detail
                </button>
                <button 
                  onClick={() => { setEditingCPMI(person); setPhotoPreview(person.photo || null); setIsModalOpen(true); }}
                  className="flex-1 bg-slate-50 text-slate-600 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold uppercase text-[10px] tracking-wider hover:bg-slate-100 transition-all border border-slate-200"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
                <button 
                  onClick={() => { setDeleteId(person.id); setIsConfirmOpen(true); }}
                  className="w-10 bg-red-50 text-red-600 py-2.5 rounded-lg flex items-center justify-center hover:bg-red-100 transition-all border border-red-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden my-4 sm:my-8 flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  {editingCPMI ? 'Edit Data CPMI' : 'Formulir Biodata CPMI'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition-all">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-10 overflow-y-auto custom-scrollbar bg-white">
                {/* Section: Basic Info */}
                <div className="space-y-6">
                  <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-xs flex items-center gap-2">
                    <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                    Informasi Dasar
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:row-span-3 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50 group hover:border-indigo-300 transition-all cursor-pointer relative overflow-hidden">
                      {photoPreview ? (
                        <div className="relative group/photo w-full aspect-[3/4]">
                          <img src={photoPreview} className="w-full h-full object-cover rounded-xl shadow-md" alt="Preview" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                            <button 
                              type="button" 
                              onClick={() => setPhotoPreview(null)}
                              className="bg-red-500 text-white p-2 rounded-lg shadow-lg active:scale-95"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                            <Plus size={24} />
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Upload Foto CPMI</p>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={handlePhotoChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Nama Lengkap</label>
                        <input name="fullName" defaultValue={editingCPMI?.fullName} required className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">No. Registrasi</label>
                        <input name="registrationNumber" defaultValue={editingCPMI?.registrationNumber} required className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-mono text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">No. HP CPMI</label>
                        <input name="phone" defaultValue={editingCPMI?.phone} required className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Tanggal Daftar</label>
                        <input type="date" name="registrationDate" defaultValue={editingCPMI?.registrationDate || format(new Date(), 'yyyy-MM-dd')} required className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Negara Tujuan</label>
                        <select name="country" defaultValue={editingCPMI?.country} required className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm">
                          <option value="Taiwan">Taiwan</option>
                          <option value="Hong Kong">Hong Kong</option>
                          <option value="Singapura">Singapura</option>
                          <option value="Malaysia">Malaysia</option>
                          <option value="Jepang">Jepang</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Sponsor</label>
                        <select name="sponsorId" defaultValue={editingCPMI?.sponsorId} required className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm">
                          {sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Status Berkas</label>
                          <select name="documentStatus" defaultValue={editingCPMI?.documentStatus || 'Proses'} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm">
                            <option value="Proses">Proses</option>
                            <option value="Lengkap">Lengkap</option>
                            <option value="Kurang">Kurang</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Update Proses CPMI</label>
                          <select name="processStatus" defaultValue={editingCPMI?.processStatus || 'Proses'} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm">
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
                <div className="space-y-6">
                  <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-xs flex items-center gap-2">
                    <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                    Data Pribadi
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Alamat</label>
                      <input name="address" defaultValue={editingCPMI?.address} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Agama</label>
                      <input name="religion" defaultValue={editingCPMI?.religion} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Umur</label>
                      <input type="number" name="age" defaultValue={editingCPMI?.age} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Tempat Lahir</label>
                      <input name="pob" defaultValue={editingCPMI?.pob} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Tanggal Lahir</label>
                      <input type="date" name="dob" defaultValue={editingCPMI?.dob} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Tinggi (cm)</label>
                      <input type="number" name="height" defaultValue={editingCPMI?.height} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Berat (kg)</label>
                      <input type="number" name="weight" defaultValue={editingCPMI?.weight} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                    </div>
                  </div>
                </div>

                {/* Section: Family */}
                <div className="space-y-6">
                  <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-xs flex items-center gap-2">
                    <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                    Data Keluarga
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Nama Bapak</label>
                      <input name="fatherName" defaultValue={editingCPMI?.fatherName} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Nama Ibu</label>
                      <input name="motherName" defaultValue={editingCPMI?.motherName} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Nama Suami/Istri</label>
                      <input name="spouseName" defaultValue={editingCPMI?.spouseName} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Pekerjaan</label>
                      <input name="occupation" defaultValue={editingCPMI?.occupation} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Jumlah Saudara</label>
                      <input type="number" name="siblingsCount" defaultValue={editingCPMI?.siblingsCount} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Anak ke Berapa</label>
                      <input type="number" name="birthOrder" defaultValue={editingCPMI?.birthOrder} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Pendidikan Terakhir</label>
                      <input name="education" defaultValue={editingCPMI?.education} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Status Pernikahan</label>
                      <select name="maritalStatus" defaultValue={editingCPMI?.maritalStatus} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm">
                        <option value="Single">Single</option>
                        <option value="Menikah">Menikah</option>
                        <option value="Cerai Hidup">Cerai Hidup</option>
                        <option value="Cerai Mati">Cerai Mati</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Jumlah Anak</label>
                      <input type="number" name="childrenCount" defaultValue={editingCPMI?.childrenCount} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-semibold text-sm" />
                    </div>
                  </div>
                </div>

                {/* Section: Skills & Docs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-xs flex items-center gap-2">
                      <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                      Kemampuan Bahasa
                    </h4>
                    <div className="grid grid-cols-1 gap-2.5">
                      {['mandarin', 'english', 'cantonese'].map(lang => (
                        <label key={lang} className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-all border border-slate-100 group">
                          <input type="checkbox" name={`lang_${lang}`} defaultChecked={(editingCPMI?.languages as any)?.[lang]} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 bg-white border-slate-200" />
                          <span className="capitalize font-semibold text-slate-700 text-sm">{lang}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-xs flex items-center gap-2">
                      <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                      Kelengkapan Dokumen
                    </h4>
                    <div className="grid grid-cols-2 gap-2.5">
                      {['ktp', 'kk', 'aktaLahir', 'bukuNikah', 'suratIjin', 'ijasah', 'aktaCerai', 'paspor'].map(doc => (
                        <label key={doc} className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-all border border-slate-100 group">
                          <input type="checkbox" name={`doc_${doc}`} defaultChecked={(editingCPMI?.documents as any)?.[doc]} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-white border-slate-200" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-700">{doc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section: Experience & Terms */}
                <div className="space-y-6">
                  <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-xs flex items-center gap-2">
                    <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                    Pengalaman Kerja & T&C
                  </h4>
                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Input Pengalaman Kerja</label>
                      <textarea name="workExperience" defaultValue={editingCPMI?.workExperience} rows={3} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-700 font-medium text-sm" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { id: 'familyConsent', label: 'Apakah anda mendapat restu dari keluarga?' },
                        { id: 'contractCompletion', label: 'Sanggupkah anda bekerja selama kontrak SELESAI?' },
                        { id: 'returnCosts', label: 'Anda setuju untuk menanggung sendiri biaya pulang jika kontrak belum selesai?' },
                        { id: 'holidayWork', label: 'Sanggupkah anda bekerja pada hari minggu dan hari libur?' },
                        { id: 'eatPork', label: 'Bolehkah anda makan daging babi?' },
                        { id: 'handlePork', label: 'Apakah anda bisa memegang dan memotong daging babi?' },
                      ].map(term => (
                        <label key={term.id} className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-all border border-slate-100 group">
                          <input type="checkbox" name={`term_${term.id}`} defaultChecked={(editingCPMI?.terms as any)?.[term.id]} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 bg-white border-slate-200" />
                          <span className="text-xs font-semibold text-slate-600 leading-snug group-hover:text-slate-900">{term.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Note / Keterangan Tambahan</label>
                  <textarea name="notes" defaultValue={editingCPMI?.notes} rows={3} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-700 font-medium text-sm" />
                </div>

                <div className="pt-6 flex flex-col sm:flex-row gap-3 sticky bottom-0 bg-white pb-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">Batal</button>
                  <button type="submit" className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-sm">Simpan Data Biodata</button>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDetailOpen(false)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden my-4 sm:my-8 flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">{selectedCPMI.fullName}</h3>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">{selectedCPMI.registrationNumber} • {selectedCPMI.company}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => window.print()}
                    className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    title="Cetak Biodata"
                  >
                    <Printer size={20} />
                  </button>
                  <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-600 p-2.5 hover:bg-slate-50 rounded-full transition-all">
                    <X size={24} />
                  </button>
                </div>
              </div>
              
              <div id="printable-biodata" className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-10 custom-scrollbar bg-white">
                <style dangerouslySetInnerHTML={{ __html: `
                  @media print {
                    @page { size: A4; margin: 1cm; }
                    body { visibility: hidden; background: white !important; }
                    #printable-biodata { 
                      visibility: visible !important; 
                      position: absolute !important; 
                      left: 0 !important; 
                      top: 0 !important; 
                      width: 100% !important; 
                      padding: 0 !important;
                      margin: 0 !important;
                      display: block !important;
                      height: auto !important;
                      overflow: visible !important;
                    }
                    #printable-biodata * { visibility: visible !important; color: black !important; }
                    .no-print { display: none !important; }
                    .bg-slate-50, .bg-slate-50\/50, .bg-white { background: white !important; border: 1px solid #e2e8f0 !important; }
                    .text-indigo-600 { color: #4f46e5 !important; }
                    .rounded-2xl, .rounded-3xl, .rounded-xl { border-radius: 8px !important; }
                    .shadow-sm, .shadow-md, .shadow-lg, .shadow-2xl { shadow: none !important; box-shadow: none !important; }
                    img { max-width: 180px !important; height: auto !important; border-radius: 4px !important; }
                    .grid { display: grid !important; gap: 1rem !important; }
                    .md\:grid-cols-3 { grid-template-columns: 1fr 2fr !important; }
                    .md\:col-span-2 { grid-column: span 2 !important; }
                    .sm\:grid-cols-2 { grid-template-columns: 1fr 1fr !important; }
                    section { break-inside: avoid !important; margin-bottom: 1.5rem !important; }
                    .p-6, .p-10 { padding: 0.5rem !important; }
                    .gap-8, .gap-10 { gap: 1rem !important; }
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
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Data Sponsor</h2>
          <p className="text-slate-500">Kelola daftar sponsor dan agen penyalur.</p>
        </div>
        <button 
          onClick={() => { setEditingSponsor(null); setIsModalOpen(true); }}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/20"
        >
          <Plus size={20} />
          <span>Tambah Sponsor</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sponsors.map((sponsor) => (
          <motion.div
            key={sponsor.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-saas p-6 group relative"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 border border-purple-100 rounded-xl flex items-center justify-center font-bold text-xl shadow-sm">
                {sponsor.name.charAt(0)}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => { setEditingSponsor(sponsor); setIsModalOpen(true); }}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => { setDeleteId(sponsor.id); setIsConfirmOpen(true); }}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Hapus"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <h3 className="font-bold text-lg text-slate-900">{sponsor.name}</h3>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Users size={14} className="text-slate-400" />
                <span>{sponsor.contactPerson || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Wallet size={14} className="text-slate-400" />
                <span>{sponsor.whatsapp || '-'}</span>
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingSponsor ? 'Edit Sponsor' : 'Tambah Sponsor Baru'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nama Sponsor</label>
                  <input 
                    name="name" 
                    defaultValue={editingSponsor?.name}
                    required 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Kontak Person</label>
                  <input 
                    name="contactPerson" 
                    defaultValue={editingSponsor?.contactPerson}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">No. WhatsApp</label>
                  <input 
                    name="whatsapp" 
                    defaultValue={editingSponsor?.whatsapp}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/20"
                  >
                    {editingSponsor ? 'Simpan Perubahan' : 'Tambah Sponsor'}
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

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
    }
  }, [editingTransaction]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Keuangan</h2>
          <p className="text-slate-500 text-sm">Catat pemasukan dan pengeluaran operasional secara digital.</p>
        </div>
        <button 
          onClick={() => { setEditingTransaction(null); setType('income'); setIsModalOpen(true); }}
          className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-emerald-700 transition-all duration-300 shadow-lg shadow-emerald-600/20 font-bold"
        >
          <Plus size={20} />
          <span>Tambah Transaksi</span>
        </button>
      </header>

      <div className="card-saas overflow-hidden">
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-slate-500 text-[10px] font-bold uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-4 text-slate-500 text-[10px] font-bold uppercase tracking-wider">Deskripsi</th>
                <th className="px-6 py-4 text-slate-500 text-[10px] font-bold uppercase tracking-wider">Kategori</th>
                <th className="px-6 py-4 text-slate-500 text-[10px] font-bold uppercase tracking-wider">CPMI Terkait</th>
                <th className="px-6 py-4 text-slate-500 text-[10px] font-bold uppercase tracking-wider text-right">Jumlah</th>
                <th className="px-6 py-4 text-slate-500 text-[10px] font-bold uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-all duration-300 group">
                  <td className="px-6 py-4 text-slate-600 text-sm font-medium">
                    {format(t.date.toDate(), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{t.description}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                      {t.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm font-medium">
                    {cpmi.find(p => p.id === t.cpmiId)?.fullName || '-'}
                  </td>
                  <td className={cn(
                    "px-6 py-4 text-right font-bold text-lg tracking-tight",
                    t.type === 'income' ? "text-emerald-600" : "text-red-600"
                  )}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => { setEditingTransaction(t); setIsModalOpen(true); }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-300"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => { setDeleteId(t.id); setIsConfirmOpen(true); }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-300"
                        title="Hapus"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden p-4 space-y-4">
          {transactions.map((t) => (
            <div key={t.id} className="bg-slate-50 rounded-2xl border border-slate-100 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{format(t.date.toDate(), 'dd MMM yyyy')}</p>
                  <p className="font-bold text-slate-900 uppercase tracking-tight">{t.description}</p>
                </div>
                <div className={cn(
                  "font-bold text-lg tracking-tight",
                  t.type === 'income' ? "text-emerald-600" : "text-red-600"
                )}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div className="flex flex-col gap-1">
                  <span className="px-2 py-0.5 bg-white text-slate-600 rounded-full text-[8px] font-bold uppercase tracking-widest border border-slate-200 w-fit">
                    {t.category}
                  </span>
                  <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                    CPMI: {cpmi.find(p => p.id === t.cpmiId)?.fullName || '-'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setEditingTransaction(t); setIsModalOpen(true); }}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => { setDeleteId(t.id); setIsConfirmOpen(true); }}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {transactions.length === 0 && (
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {editingTransaction ? 'Edit Transaksi' : 'Tambah Transaksi Baru'}
                  </h3>
                  <p className="text-slate-500 text-xs font-medium mt-1">Lengkapi detail transaksi keuangan di bawah ini.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="flex p-1 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300",
                      type === 'income' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Pemasukan
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300",
                      type === 'expense' ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Pengeluaran
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 ml-1">Jumlah (Rp)</label>
                    <input 
                      name="amount" 
                      type="number" 
                      defaultValue={editingTransaction?.amount}
                      required 
                      className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 ml-1">Tanggal</label>
                    <input 
                      name="date" 
                      type="date" 
                      defaultValue={editingTransaction ? format(editingTransaction.date.toDate(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                      required 
                      className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 ml-1">Kategori</label>
                  <select 
                    name="category" 
                    defaultValue={editingTransaction?.category}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none text-sm"
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
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 ml-1">Keterangan</label>
                  <input 
                    name="description" 
                    defaultValue={editingTransaction?.description}
                    required 
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 text-sm"
                    placeholder="Contoh: Pembayaran Paspor"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 ml-1">CPMI Terkait (Opsional)</label>
                  <select 
                    name="cpmiId" 
                    defaultValue={editingTransaction?.cpmiId || ''}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none text-sm"
                  >
                    <option value="">Tidak Ada</option>
                    {cpmi.map(p => (
                      <option key={p.id} value={p.id}>{p.fullName}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3.5 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 text-sm"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className={cn(
                      "flex-1 px-4 py-3.5 text-white rounded-2xl font-bold transition-all shadow-lg active:scale-95 text-sm",
                      type === 'income' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20" : "bg-red-600 hover:bg-red-700 shadow-red-600/20"
                    )}
                  >
                    {editingTransaction ? 'Simpan Perubahan' : 'Tambah Transaksi'}
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Laporan Keuangan</h2>
          <p className="text-slate-500 text-sm font-medium">Analisis performa keuangan operasional Anda secara digital.</p>
        </div>
        <button 
          onClick={exportToCSV}
          className="bg-white text-slate-700 px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-50 transition-all duration-300 border border-slate-200 font-bold shadow-sm"
        >
          <Download size={20} />
          <span>Ekspor CSV</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card-saas p-6">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Total Pemasukan</p>
          <p className="text-2xl font-bold text-emerald-600 tracking-tight">{formatCurrency(reportData.income)}</p>
        </div>
        <div className="card-saas p-6">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Total Pengeluaran</p>
          <p className="text-2xl font-bold text-red-600 tracking-tight">{formatCurrency(reportData.expense)}</p>
        </div>
        <div className="card-saas p-6">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Saldo Saat Ini</p>
          <p className="text-2xl font-bold text-blue-600 tracking-tight">{formatCurrency(reportData.balance)}</p>
        </div>
        <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-600/20">
          <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-wider mb-2">Grand Total (Laba/Rugi)</p>
          <p className="text-2xl font-bold text-white tracking-tight">{formatCurrency(reportData.balance)}</p>
        </div>
      </div>

      <div className="card-saas p-8">
        <h3 className="font-bold text-xl text-slate-900 tracking-tight mb-8 flex items-center gap-3">
          <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
          Ringkasan per Kategori
        </h3>
        <div className="space-y-8">
          {Object.entries(reportData.byCategory).map(([cat, amount]) => {
            const val = amount as number;
            const percentage = Math.abs(val) / (reportData.income + reportData.expense) * 100 || 0;
            return (
              <div key={cat} className="group">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-xs group-hover:text-indigo-600 transition-colors">{cat}</span>
                  <span className={cn(
                    "font-bold tracking-tight",
                    val >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {val >= 0 ? '+' : ''}{formatCurrency(val)}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(percentage, 100)}%` }}
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      val >= 0 ? "bg-emerald-500" : "bg-red-500"
                    )}
                  />
                </div>
              </div>
            );
          })}
          {Object.keys(reportData.byCategory).length === 0 && (
            <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest">Belum ada data kategori.</div>
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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white border border-slate-100 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden p-10 text-center"
          >
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-100 shadow-sm">
              <Trash2 size={40} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Hapus Data</h3>
            <p className="text-slate-500 mb-10 leading-relaxed font-medium text-sm">{message}</p>
            <div className="flex gap-4">
              <button 
                onClick={onClose}
                className="flex-1 px-6 py-3.5 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 text-sm"
              >
                Batal
              </button>
              <button 
                onClick={() => { onConfirm(); onClose(); }}
                className="flex-1 px-6 py-3.5 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 active:scale-95 text-sm"
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
  user 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  user: User;
}) => {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran file maksimal 5MB');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoURL(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await updateProfile(user, {
        displayName,
        photoURL
      });
      onClose();
      window.location.reload(); // Refresh to show changes
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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white border border-slate-100 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden"
          >
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Edit Profil</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="flex flex-col items-center gap-4 mb-4">
                <div className="relative group">
                  <img 
                    src={photoURL || `https://ui-avatars.com/api/?name=${displayName}`} 
                    className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-xl" 
                    alt="Profile" 
                  />
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Plus className="text-white" size={24} />
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Klik foto untuk ganti (Maks 5MB)</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-700 transition-all"
                  placeholder="Masukkan nama lengkap"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="flex-1 px-6 py-3.5 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all text-sm"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                >
                  {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Simpan'}
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-indigo-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-blue-500/5 rounded-full blur-[150px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md p-8 sm:p-12 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 text-center"
      >
        <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-10 shadow-xl shadow-indigo-200">
          <span className="text-white font-bold text-3xl">P3</span>
        </div>
        
        <h1 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">P3MI Digital</h1>
        <p className="text-slate-500 mb-10 font-medium leading-relaxed">Sistem Manajemen Terintegrasi untuk Penyaluran Pekerja Migran Indonesia.</p>
        
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-4 px-6 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50 active:scale-95 group"
        >
          {loading ? (
            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="" />
              <span>Masuk dengan Google</span>
            </>
          )}
        </button>
        
        <div className="mt-10 pt-10 border-t border-slate-100 flex items-center justify-center gap-8">
          <div className="text-center">
            <p className="text-slate-900 font-bold text-lg">100%</p>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Secure</p>
          </div>
          <div className="w-[1px] h-6 bg-slate-200" />
          <div className="text-center">
            <p className="text-slate-900 font-bold text-lg">Real-time</p>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Sync</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

    return () => {
      unsubCpmi();
      unsubSponsors();
      unsubTransactions();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full shadow-sm"
          />
          <p className="text-sm font-semibold text-slate-500 animate-pulse">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <ErrorBoundary>
      <Router>
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <main className="flex-1 lg:ml-72 min-h-screen flex flex-col">
        <header className="h-20 bg-white border-b border-slate-200 px-6 sm:px-10 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="font-bold text-sm text-white">P3</span>
              </div>
              <h1 className="font-bold text-lg tracking-tight text-slate-900 uppercase">P3MI</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-6 ml-auto">
            <div className="hidden md:block relative group">
              <select 
                value={currentCompany}
                onChange={(e) => setCurrentCompany(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer hover:bg-slate-100 appearance-none pr-10"
              >
                <option value="PT Trias Insan Madani Cirebon">PT Trias Insan Madani Cirebon</option>
                <option value="PT HARCOSELARAS SENTOSAJAYA">PT HARCOSELARAS SENTOSAJAYA</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-slate-600 transition-colors">
                <ChevronDown size={14} />
              </div>
            </div>
            
            <div className="text-right hidden sm:block border-l border-slate-200 pl-6">
              <p className="text-sm font-bold text-slate-900 leading-none mb-1">{user.displayName}</p>
              <p className="text-[11px] text-slate-500 font-medium">{user.email}</p>
            </div>
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="relative group transition-transform active:scale-95"
            >
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                className="w-10 h-10 rounded-xl border border-slate-200 shadow-sm object-cover group-hover:ring-2 group-hover:ring-indigo-500 transition-all" 
                alt="Avatar" 
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
            </button>
          </div>
        </header>

        <ProfileModal 
          isOpen={isProfileOpen} 
          onClose={() => setIsProfileOpen(false)} 
          user={user} 
        />

        <div className="p-6 sm:p-10 max-w-7xl mx-auto w-full flex-1">
          <div className="md:hidden mb-8">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Pilih Perusahaan</label>
            <div className="relative group">
              <select 
                value={currentCompany}
                onChange={(e) => setCurrentCompany(e.target.value)}
                className="w-full bg-white border border-slate-200 text-sm font-semibold text-slate-700 px-5 py-3 rounded-xl outline-none shadow-sm appearance-none transition-all focus:ring-2 focus:ring-indigo-500"
              >
                <option value="PT Trias Insan Madani Cirebon">PT Trias Insan Madani Cirebon</option>
                <option value="PT HARCOSELARAS SENTOSAJAYA">PT HARCOSELARAS SENTOSAJAYA</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 transition-colors">
                <ChevronDown size={18} />
              </div>
            </div>
          </div>

          <Routes>
            <Route path="/" element={<Dashboard cpmi={filteredCpmi} sponsors={sponsors} transactions={filteredTransactions} />} />
            <Route path="/cpmi" element={<CPMIPage cpmi={filteredCpmi} sponsors={sponsors} currentCompany={currentCompany} />} />
            <Route path="/sponsors" element={<SponsorsPage sponsors={sponsors} />} />
            <Route path="/transactions" element={<TransactionsPage transactions={filteredTransactions} cpmi={filteredCpmi} />} />
            <Route path="/reports" element={<ReportsPage transactions={filteredTransactions} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
      </Router>
    </ErrorBoundary>
  );
}
