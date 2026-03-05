import React, { useState, useEffect, useRef } from 'react';
import { 
  LogOut, 
  MessageSquare, 
  Bell, 
  UserPlus, 
  LogIn, 
  Send, 
  Plus, 
  ChevronRight,
  Home,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User, Notice, Message, AuthState } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const saved = localStorage.getItem('happiness_auth');
    return saved ? JSON.parse(saved) : { user: null, token: null };
  });
  const [activeTab, setActiveTab] = useState<'home' | 'notices' | 'chat'>('home');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [showNoticeForm, setShowNoticeForm] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('happiness_auth', JSON.stringify(authState));
  }, [authState]);

  // Fetch Notices
  useEffect(() => {
    fetch('/api/notices')
      .then(res => res.json())
      .then(data => setNotices(data));
  }, []);

  // WebSocket Setup
  useEffect(() => {
    if (authState.token && activeTab === 'chat') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'chat') {
          setMessages(prev => [...prev, data]);
        }
      };

      // Fetch history
      fetch('/api/messages', {
        headers: { 'Authorization': `Bearer ${authState.token}` }
      })
        .then(res => res.json())
        .then(data => setMessages(data.map((m: any) => ({
          id: m.id,
          userId: m.user_id,
          username: m.username,
          text: m.text,
          created_at: m.created_at
        }))));

      return () => ws.close();
    }
  }, [authState.token, activeTab]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      setAuthState({ user: data.user, token: data.token });
      setUsername('');
      setPassword('');
    } else {
      setError(data.error);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      setIsLoginView(true);
      setError('회원가입 성공! 로그인해주세요.');
    } else {
      setError(data.error);
    }
  };

  const handleLogout = () => {
    setAuthState({ user: null, token: null });
    setActiveTab('home');
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current || !authState.user) return;

    wsRef.current.send(JSON.stringify({
      type: 'chat',
      userId: authState.user.id,
      username: authState.user.username,
      text: chatInput
    }));
    setChatInput('');
  };

  const createNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeContent.trim()) return;

    const res = await fetch('/api/notices', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authState.token}`
      },
      body: JSON.stringify({ title: noticeTitle, content: noticeContent })
    });

    if (res.ok) {
      const data = await res.json();
      setNotices(prev => [{
        id: data.id,
        title: noticeTitle,
        content: noticeContent,
        author_id: authState.user!.id,
        author_name: authState.user!.username,
        created_at: new Date().toISOString()
      }, ...prev]);
      setNoticeTitle('');
      setNoticeContent('');
      setShowNoticeForm(false);
    }
  };

  if (!authState.user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="p-8">
            <div className="flex justify-center mb-8">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
                <Home className="w-8 h-8 text-indigo-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-center text-slate-800 mb-2">행복반 커뮤니티</h1>
            <p className="text-center text-slate-500 mb-8">
              {isLoginView ? '다시 오신 것을 환영합니다!' : '새로운 시작을 함께해요!'}
            </p>

            <form onSubmit={isLoginView ? handleLogin : handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">사용자 이름</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  placeholder="아이디를 입력하세요"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  placeholder="비밀번호를 입력하세요"
                  required
                />
              </div>
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <button 
                type="submit"
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                {isLoginView ? '로그인' : '회원가입'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button 
                onClick={() => { setIsLoginView(!isLoginView); setError(''); }}
                className="text-indigo-600 font-medium hover:underline"
              >
                {isLoginView ? '계정이 없으신가요? 가입하기' : '이미 계정이 있으신가요? 로그인'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-800">행복반</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home className="w-4 h-4" />} label="홈" />
            <NavButton active={activeTab === 'notices'} onClick={() => setActiveTab('notices')} icon={<Bell className="w-4 h-4" />} label="공지사항" />
            <NavButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare className="w-4 h-4" />} label="채팅방" />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
              <UserIcon className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">{authState.user.username}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title="로그아웃"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="bg-indigo-600 rounded-3xl p-8 md:p-12 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="text-4xl font-bold mb-4">안녕하세요, {authState.user.username}님!</h2>
                  <p className="text-indigo-100 text-lg max-w-xl">
                    오늘도 행복반에서 즐거운 시간을 보내세요. 새로운 소식과 친구들의 이야기를 확인해보세요.
                  </p>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 rounded-full -ml-10 -mb-10 blur-2xl" />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <DashboardCard 
                  title="최근 공지사항" 
                  icon={<Bell className="w-5 h-5 text-amber-500" />}
                  onClick={() => setActiveTab('notices')}
                >
                  <div className="space-y-3">
                    {notices.slice(0, 3).map(notice => (
                      <div key={notice.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
                        <span className="font-medium text-slate-700 truncate mr-4">{notice.title}</span>
                        <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(notice.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                    {notices.length === 0 && <p className="text-slate-400 text-sm text-center py-4">공지사항이 없습니다.</p>}
                  </div>
                </DashboardCard>

                <DashboardCard 
                  title="실시간 채팅" 
                  icon={<MessageSquare className="w-5 h-5 text-indigo-500" />}
                  onClick={() => setActiveTab('chat')}
                >
                  <div className="space-y-3">
                    <p className="text-slate-600 text-sm">
                      친구들과 실시간으로 대화를 나눠보세요. 현재 활발하게 대화가 진행 중입니다.
                    </p>
                    <div className="flex -space-x-2 overflow-hidden">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                          U{i}
                        </div>
                      ))}
                    </div>
                  </div>
                </DashboardCard>
              </div>
            </motion.div>
          )}

          {activeTab === 'notices' && (
            <motion.div 
              key="notices"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">공지사항</h2>
                <button 
                  onClick={() => setShowNoticeForm(!showNoticeForm)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-all shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>글쓰기</span>
                </button>
              </div>

              {showNoticeForm && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"
                >
                  <form onSubmit={createNotice} className="space-y-4">
                    <input 
                      type="text" 
                      placeholder="제목을 입력하세요"
                      value={noticeTitle}
                      onChange={e => setNoticeTitle(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />
                    <textarea 
                      placeholder="내용을 입력하세요"
                      value={noticeContent}
                      onChange={e => setNoticeContent(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-32"
                      required
                    />
                    <div className="flex justify-end gap-2">
                      <button 
                        type="button"
                        onClick={() => setShowNoticeForm(false)}
                        className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl"
                      >
                        취소
                      </button>
                      <button 
                        type="submit"
                        className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
                      >
                        등록하기
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              <div className="space-y-4">
                {notices.map(notice => (
                  <div key={notice.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-200 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold text-slate-800">{notice.title}</h3>
                      <span className="text-xs text-slate-400">{new Date(notice.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-600 mb-4 whitespace-pre-wrap">{notice.content}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center">
                        <UserIcon className="w-3 h-3" />
                      </div>
                      <span>{notice.author_name}</span>
                    </div>
                  </div>
                ))}
                {notices.length === 0 && (
                  <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                    <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-400">등록된 공지사항이 없습니다.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-[calc(100vh-12rem)] flex flex-col bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <h2 className="font-bold text-slate-800">실시간 채팅방</h2>
                </div>
                <span className="text-xs text-slate-400">대화 내용은 모두에게 공개됩니다</span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={cn(
                      "flex flex-col max-w-[80%]",
                      msg.userId === authState.user!.id ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-500">{msg.username}</span>
                      <span className="text-[10px] text-slate-400">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div 
                      className={cn(
                        "px-4 py-2 rounded-2xl text-sm shadow-sm",
                        msg.userId === authState.user!.id 
                          ? "bg-indigo-600 text-white rounded-tr-none" 
                          : "bg-slate-100 text-slate-800 rounded-tl-none"
                      )}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={sendChatMessage} className="p-4 border-t border-slate-100 flex gap-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 px-4 py-2 rounded-xl bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <button 
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Nav */}
      <div className="md:hidden bg-white border-t border-slate-200 h-16 flex items-center justify-around px-4">
        <MobileNavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home className="w-6 h-6" />} />
        <MobileNavButton active={activeTab === 'notices'} onClick={() => setActiveTab('notices')} icon={<Bell className="w-6 h-6" />} />
        <MobileNavButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare className="w-6 h-6" />} />
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-all",
        active ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MobileNavButton({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-2 rounded-xl transition-all",
        active ? "text-indigo-600 bg-indigo-50" : "text-slate-400"
      )}
    >
      {icon}
    </button>
  );
}

function DashboardCard({ title, icon, children, onClick }: { title: string, icon: React.ReactNode, children: React.ReactNode, onClick: () => void }) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-50 rounded-xl">
            {icon}
          </div>
          <h3 className="font-bold text-slate-800">{title}</h3>
        </div>
        <button onClick={onClick} className="text-slate-400 hover:text-indigo-600 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
