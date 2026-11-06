import { useState, useRef, useEffect, createContext, useContext } from "react";
import {
  Search, Phone, Video, MoreVertical, Smile, Paperclip, Mic,
  Send, Check, CheckCheck, Clock, Star, X, Sun, Moon,
  AlertTriangle, Target, Wallet, FileText, Tag, PhoneOff,
  ExternalLink, MessageSquare, Copy, Shield, TrendingUp,
  UserCheck, Activity, Eye
} from "lucide-react";

// ═══ THEME ═══════════════════════════════════════════════════════════════
const THEMES = {
  dark: {
    wa_bg:"#111b21", wa_panel:"#202c33", wa_chat_bg:"#0b141a",
    wa_bubble_out:"#005c4b", wa_bubble_in:"#202c33",
    wa_header:"#202c33", wa_sidebar:"#111b21", wa_border:"#2a3942",
    wa_text:"#e9edef", wa_text_sec:"#8696a0", wa_input_bg:"#2a3942",
    wa_hover:"#2a3942", wa_selected:"#2a3942",
    wa_green:"#00a884", wa_check:"#53bdeb",
    crm_card:"#1a2730", crm_sidebar_bg:"#111b21",
    crm_input_bg:"#2a3942", crm_input_border:"#2a3942",
    date_pill_bg:"#1e2a30",
    bubble_time:"rgba(255,255,255,.45)",
    search_bg:"#202c33",
    action_bg:"rgba(1,102,90,.15)", action_border:"rgba(1,102,90,.4)",
    note_form_bg:"#1a2730",
    avatar_bg:"#2a3942", avatar_color:"#aebac1",
    empty_icon_opacity:.3,
  },
  light: {
    wa_bg:"#ffffff", wa_panel:"#f0f2f5", wa_chat_bg:"#efeae2",
    wa_bubble_out:"#d9fdd3", wa_bubble_in:"#ffffff",
    wa_header:"#f0f2f5", wa_sidebar:"#ffffff", wa_border:"#e9edef",
    wa_text:"#111b21", wa_text_sec:"#667781", wa_input_bg:"#ffffff",
    wa_hover:"#f5f6f6", wa_selected:"#f0f2f5",
    wa_green:"#00a884", wa_check:"#53bdeb",
    crm_card:"#f7f8fa", crm_sidebar_bg:"#ffffff",
    crm_input_bg:"#ffffff", crm_input_border:"#dfe5e7",
    date_pill_bg:"#ffffff",
    bubble_time:"rgba(0,0,0,.38)",
    search_bg:"#ffffff",
    action_bg:"rgba(1,102,90,.08)", action_border:"rgba(1,102,90,.25)",
    note_form_bg:"#f7f8fa",
    avatar_bg:"#dfe5e7", avatar_color:"#667781",
    empty_icon_opacity:.15,
  }
};

const ThemeCtx = createContext(THEMES.dark);
const useTheme = () => useContext(ThemeCtx);

const CRM_PRIMARY = "#01665a";
const SEGMEN_COLORS = {champions:"#01665a",loyal:"#2e8b7a",potential:"#5cb8a8",at_risk:"#e74c3c",lost:"#95a5a6",new:"#3498db",one_time:"#f39c12"};
const fmt = n => n == null ? "—" : "Rp " + Number(n).toLocaleString("id-ID");

// ═══ SEED DATA ═══════════════════════════════════════════════════════════
const CONTACTS = [
  {
    id:1, phone:"6281234567890", name:"Budi Rahmat Santoso", avatar:"BR",
    status:"aktif", segmen:"champions", skor_r:5, skor_f:5, skor_m:5,
    tags:["prioritas","loyal"], assigned_to:"Budi Santoso",
    follow_up:"in_progress", due:"2026-04-20",
    last_donation_at:"2025-03-15", last_donation_nom:500000, last_donation_prog:"Ramadan",
    total:4250000, count:12, avg:354167,
    programs:["Ramadan","Qurban","Anak Yatim","Zakat Fitrah"],
    last_blast_at:"2026-04-01", last_blast_respon:"closing",
    notes:[
      {tgl:"2026-04-02",pic:"Budi S.",respon:"closing",text:"Transfer 500rb qurban 2026.",via:"extension"},
      {tgl:"2025-05-05",pic:"Budi S.",respon:"merespon",text:"Tertarik qurban, minta info rekening.",via:"extension"},
      {tgl:"2025-03-02",pic:"Budi S.",respon:"closing",text:"Transfer langsung. Mau lanjut Qurban.",via:"wappin"},
    ],
    chats:[
      {from:"them",text:"Assalamualaikum, saya mau tanya soal program qurban tahun ini",time:"09:15",date:"Hari ini"},
      {from:"me",text:"Waalaikumsalam Pak Budi! Alhamdulillah terima kasih sudah menghubungi kami. Untuk program Qurban 2026, kami menyediakan beberapa paket:",time:"09:17"},
      {from:"me",text:"1. Kambing: Rp 2.500.000\n2. Sapi (1/7): Rp 3.200.000\n3. Sapi (utuh): Rp 22.000.000\n\nSemua sudah termasuk proses penyembelihan dan distribusi ke daerah pelosok.",time:"09:17"},
      {from:"them",text:"Saya ambil kambing ya seperti tahun lalu. Bisa transfer ke rekening yang sama?",time:"09:20"},
      {from:"me",text:"Baik Pak Budi, InsyaAllah. Untuk pembayaran bisa transfer ke:\n\nBSI: 720-812-3456\na.n. Yayasan Relawan Nusantara\n\nMohon konfirmasi setelah transfer ya Pak",time:"09:22"},
      {from:"them",text:"Sudah saya transfer 2.500.000. Mohon dicek ya",time:"09:45"},
      {from:"me",text:"Alhamdulillah sudah kami terima Pak Budi. Jazakallahu khairan atas partisipasinya di Qurban 2026. Semoga menjadi amal yang diterima Allah SWT.",time:"09:48"},
    ],
    lastMsg:"Sudah saya transfer 2.500.000. Mohon dicek ya", lastTime:"09:45", unread:0
  },
  {
    id:10, phone:"6286655443322", name:"Indah Permatasari", avatar:"IP",
    status:"aktif", segmen:"at_risk", skor_r:2, skor_f:4, skor_m:4,
    tags:["perlu_reengagement"], assigned_to:"Budi Santoso",
    follow_up:"in_progress", due:"2026-04-15",
    last_donation_at:"2024-10-20", last_donation_nom:500000, last_donation_prog:"Qurban",
    total:3800000, count:14, avg:271429,
    programs:["Ramadan","Qurban"],
    last_blast_at:"2026-04-01", last_blast_respon:"hanya_read",
    notes:[
      {tgl:"2026-04-10",pic:"Lestari W.",respon:"belum_merespon",text:"WA terkirim, belum respons.",via:"extension"},
      {tgl:"2025-10-15",pic:"Budi S.",respon:"merespon",text:"\"Insyaallah ya\" belum ada transfer.",via:"mekari"},
    ],
    chats:[
      {from:"me",text:"Assalamualaikum Bu Indah, semoga sehat selalu. Kami dari Relawan Nusantara ingin menginformasikan program Qurban 2026.",time:"10:30",date:"10 Apr"},
      {from:"me",text:"Tahun lalu Ibu pernah berpartisipasi di program Qurban kami. Apakah tahun ini berkenan ikut kembali?",time:"10:31"},
    ],
    lastMsg:"Tahun lalu Ibu pernah berpartisipasi...", lastTime:"10:31", unread:0
  },
  {
    id:2, phone:"6285678901234", name:"Dewi Anggraeni Putri", avatar:"DA",
    status:"aktif", segmen:"champions", skor_r:5, skor_f:5, skor_m:5,
    tags:["prioritas","qurban_rutin"], assigned_to:"Rina Dewi",
    follow_up:"waiting_callback", due:"2026-04-18",
    last_donation_at:"2025-03-10", last_donation_nom:1000000, last_donation_prog:"Ramadan",
    total:8750000, count:18, avg:486111,
    programs:["Ramadan","Qurban","Zakat Mal"],
    last_blast_at:"2026-04-01", last_blast_respon:"merespon",
    notes:[
      {tgl:"2026-04-03",pic:"Rina D.",respon:"merespon",text:"Tertarik, minta diingatkan H-7.",via:"extension"},
    ],
    chats:[
      {from:"them",text:"Mbak, qurban tahun ini kapan ya? Saya mau ikut lagi",time:"14:05",date:"3 Apr"},
      {from:"me",text:"Alhamdulillah Bu Dewi! Qurban 2026 insyaAllah tanggal 7-8 Juni.",time:"14:10"},
      {from:"them",text:"Kambing aja ya mbak. Tapi nanti ingatkan saya H-7 supaya tidak lupa transfer",time:"14:15"},
      {from:"me",text:"Siap Bu Dewi, akan saya ingatkan H-7 ya. Jazakillah khairan",time:"14:16"},
    ],
    lastMsg:"Kambing aja ya mbak. Nanti ingatkan...", lastTime:"14:15", unread:0
  },
  {
    id:13, phone:"6282211009988", name:"Andi Firmansyah", avatar:"AF",
    status:"aktif", segmen:"new", skor_r:5, skor_f:1, skor_m:2,
    tags:["new_donor"], assigned_to:"Lestari Wulandari",
    follow_up:null, due:null,
    last_donation_at:"2026-03-01", last_donation_nom:100000, last_donation_prog:"Bencana Alam",
    total:200000, count:2, avg:100000,
    programs:["Bencana Alam","Ramadan"],
    last_blast_at:null, last_blast_respon:null,
    notes:[
      {tgl:"2026-03-05",pic:"Hendra G.",respon:"merespon",text:"Donor baru CF. Onboarding.",via:"extension"},
    ],
    chats:[
      {from:"them",text:"Halo, saya donatur baru. Mau tanya program apa aja yang ada?",time:"11:20",date:"5 Mar"},
      {from:"me",text:"Halo Mas Andi! Selamat bergabung di Relawan Nusantara.\n\nKami punya beberapa program:\n• Ramadan\n• Qurban\n• Zakat Fitrah & Mal\n• Wakaf Produktif\n• Santunan Anak Yatim\n• Beasiswa\n• Bantuan Bencana Alam",time:"11:25"},
      {from:"them",text:"Wah banyak juga ya. Kalau yang paling dekat sekarang apa?",time:"11:28"},
      {from:"me",text:"Saat ini yang paling dekat program Qurban 2026 Mas. Juga ada program Anak Yatim sepanjang tahun.",time:"11:30"},
    ],
    lastMsg:"Saat ini yang paling dekat Qurban 2026...", lastTime:"11:30", unread:0
  },
  {
    id:24, phone:"6281357924680", name:"Maya Sari Dewi", avatar:"MS",
    status:"aktif", segmen:"at_risk", skor_r:2, skor_f:3, skor_m:3,
    tags:["overdue_followup"], assigned_to:"Lestari Wulandari",
    follow_up:"in_progress", due:"2026-03-01",
    last_donation_at:"2024-12-10", last_donation_nom:250000, last_donation_prog:"Anak Yatim",
    total:1750000, count:7, avg:250000,
    programs:["Anak Yatim","Ramadan","Qurban"],
    last_blast_at:"2026-02-15", last_blast_respon:"merespon",
    notes:[
      {tgl:"2026-02-15",pic:"Lestari W.",respon:"merespon",text:"Minta callback. OVERDUE.",via:"wappin"},
    ],
    chats:[
      {from:"them",text:"Mbak, saya kemarin bilang mau ikut qurban kan? Masih bisa daftar?",time:"08:10",date:"Hari ini"},
    ],
    lastMsg:"Mbak, saya kemarin bilang mau ikut qurban...", lastTime:"08:10", unread:1
  },
];

const QUICK_REPLIES = [
  {label:"Salam Pembuka",icon:MessageSquare,text:"Assalamualaikum {nama}, semoga sehat selalu. Kami dari Relawan Nusantara ingin menginformasikan..."},
  {label:"Info Qurban 2026",icon:FileText,text:"Program Qurban 2026 insyaAllah dilaksanakan 7-8 Juni 2026.\n\nPaket:\n1. Kambing: Rp 2.500.000\n2. Sapi (1/7): Rp 3.200.000\n3. Sapi (utuh): Rp 22.000.000"},
  {label:"Info Rekening",icon:Wallet,text:"Untuk pembayaran bisa transfer ke:\n\nBSI: 720-812-3456\na.n. Yayasan Relawan Nusantara\n\nMohon konfirmasi setelah transfer ya"},
  {label:"Konfirmasi Terima",icon:Check,text:"Alhamdulillah sudah kami terima. Jazakallahu khairan atas partisipasinya. Semoga menjadi amal yang diterima Allah SWT."},
  {label:"Follow-up Lembut",icon:Clock,text:"Assalamualaikum {nama}, semoga dalam keadaan baik. Hanya mengingatkan kembali terkait program yang pernah kita diskusikan sebelumnya. Apakah masih berkenan?"},
  {label:"Ucapan Terima Kasih",icon:Star,text:"Jazakallahu khairan {nama} atas donasi dan kepercayaannya kepada Relawan Nusantara. Semoga Allah membalas berlipat ganda."},
];

// ═══ COMPONENTS ══════════════════════════════════════════════════════════
function Badge({children,color=CRM_PRIMARY}) {
  return <span style={{display:"inline-block",padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,background:color+"30",color,whiteSpace:"nowrap"}}>{children}</span>;
}

function Avatar({initials,size=40}) {
  const t = useTheme();
  return (
    <div style={{width:size,height:size,minWidth:size,borderRadius:"50%",background:t.avatar_bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.35,fontWeight:700,color:t.avatar_color}}>
      {initials}
    </div>
  );
}

function ToggleSwitch({checked,onChange}) {
  return (
    <div onClick={onChange} style={{width:44,height:22,borderRadius:11,background:checked?"#2e8b7a":"#4a5568",cursor:"pointer",position:"relative",transition:"background .25s",flexShrink:0}}>
      <div style={{
        position:"absolute",top:2,left:checked?24:2,width:18,height:18,borderRadius:9,
        background:"#fff",transition:"left .25s",display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow:"0 1px 3px rgba(0,0,0,.3)"
      }}>
        {checked ? <Moon size={11} color="#2e8b7a"/> : <Sun size={11} color="#f39c12"/>}
      </div>
    </div>
  );
}

// ═══ LEFT SIDEBAR ════════════════════════════════════════════════════════
function ChatList({contacts,selected,onSelect}) {
  const t = useTheme();
  const [search,setSearch] = useState("");
  const filtered = contacts.filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{width:340,minWidth:340,background:t.wa_sidebar,borderRight:`1px solid ${t.wa_border}`,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"10px 14px",background:t.wa_header,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <Avatar initials="Me" size={36}/>
        <div style={{display:"flex",gap:18,color:t.wa_text_sec}}>
          <Activity size={20}/><MessageSquare size={20}/><MoreVertical size={20}/>
        </div>
      </div>
      <div style={{padding:"8px 12px"}}>
        <div style={{position:"relative"}}>
          <Search size={15} style={{position:"absolute",left:12,top:9,color:t.wa_text_sec}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search or start new chat"
            style={{width:"100%",padding:"7px 12px 7px 38px",borderRadius:8,border:"none",background:t.search_bg,color:t.wa_text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
        </div>
      </div>
      <div style={{flex:1,overflow:"auto"}}>
        {filtered.map(c=>(
          <div key={c.id} onClick={()=>onSelect(c)}
            style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer",
              background:selected?.id===c.id?t.wa_selected:"transparent",borderBottom:`1px solid ${t.wa_border}`,
              transition:"background .1s"}}
            onMouseEnter={e=>{if(selected?.id!==c.id)e.currentTarget.style.background=t.wa_hover;}}
            onMouseLeave={e=>{if(selected?.id!==c.id)e.currentTarget.style.background="transparent";}}>
            <Avatar initials={c.avatar} size={46}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:t.wa_text,fontWeight:600,fontSize:15}}>{c.name}</span>
                <span style={{color:c.unread?t.wa_green:t.wa_text_sec,fontSize:11}}>{c.lastTime}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}>
                <span style={{color:t.wa_text_sec,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>
                  {!c.unread && <CheckCheck size={14} style={{marginRight:3,verticalAlign:"middle",color:t.wa_check}}/>}
                  {c.lastMsg}
                </span>
                {c.unread>0 && <span style={{background:t.wa_green,color:"#fff",borderRadius:10,fontSize:11,fontWeight:700,padding:"1px 7px"}}>{c.unread}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ CENTER — CHAT ═══════════════════════════════════════════════════════
function ChatDialog({contact,onSend,inputRef}) {
  const t = useTheme();
  const endRef = useRef(null);
  const chats = contact?.chats||[];

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[contact]);

  if(!contact) return (
    <div style={{flex:1,background:t.wa_chat_bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:t.wa_text_sec}}>
      <Shield size={60} strokeWidth={1} style={{marginBottom:16,opacity:t.empty_icon_opacity}}/><div style={{fontSize:18,fontWeight:300}}>CRM Relawan Nusantara</div>
      <div style={{fontSize:13,opacity:.6,marginTop:4}}>Pilih chat untuk melihat profil donatur</div>
    </div>
  );

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",background:t.wa_chat_bg,minWidth:0}}>
      <div style={{padding:"8px 16px",background:t.wa_header,display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${t.wa_border}`}}>
        <Avatar initials={contact.avatar} size={38}/>
        <div style={{flex:1}}><div style={{color:t.wa_text,fontWeight:600,fontSize:15}}>{contact.name}</div><div style={{color:t.wa_text_sec,fontSize:12}}>online</div></div>
        <div style={{display:"flex",gap:20,color:t.wa_text_sec}}><Video size={20}/><Phone size={20}/><Search size={20}/><MoreVertical size={20}/></div>
      </div>

      <div style={{flex:1,overflow:"auto",padding:"16px 60px"}}>
        {chats.map((msg,i)=>(
          <div key={i}>
            {msg.date && (i===0||chats[i-1]?.date!==msg.date) && (
              <div style={{textAlign:"center",margin:"12px 0"}}><span style={{background:t.date_pill_bg,color:t.wa_text_sec,fontSize:12,padding:"4px 12px",borderRadius:6,boxShadow:"0 1px 2px rgba(0,0,0,.1)"}}>{msg.date}</span></div>
            )}
            <div style={{display:"flex",justifyContent:msg.from==="me"?"flex-end":"flex-start",marginBottom:3}}>
              <div style={{
                maxWidth:"65%",padding:"7px 10px 4px",borderRadius:8,fontSize:13.5,lineHeight:1.45,
                color:msg.from==="me"&&t===THEMES.light?"#111b21":t.wa_text,
                whiteSpace:"pre-wrap",background:msg.from==="me"?t.wa_bubble_out:t.wa_bubble_in,
                borderTopRightRadius:msg.from==="me"?0:8,borderTopLeftRadius:msg.from==="me"?8:0,
                boxShadow:"0 1px 1px rgba(0,0,0,.06)"
              }}>
                {msg.text}
                <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:3,marginTop:2}}>
                  <span style={{fontSize:10.5,color:t.bubble_time}}>{msg.time}</span>
                  {msg.from==="me" && <CheckCheck size={14} style={{color:t.wa_check,opacity:.7}}/>}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef}/>
      </div>

      <div style={{padding:"8px 12px",background:t.wa_header,display:"flex",alignItems:"center",gap:8,borderTop:`1px solid ${t.wa_border}`}}>
        <Smile size={24} color={t.wa_text_sec} style={{cursor:"pointer"}}/>
        <Paperclip size={24} color={t.wa_text_sec} style={{cursor:"pointer",transform:"rotate(45deg)"}}/>
        <input ref={inputRef} placeholder="Type a message"
          style={{flex:1,padding:"9px 14px",borderRadius:8,border:"none",background:t.wa_input_bg,color:t.wa_text,fontSize:14,outline:"none",fontFamily:"inherit"}}
          onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){onSend(e.target.value);e.target.value="";}}}/>
        <Mic size={24} color={t.wa_text_sec} style={{cursor:"pointer"}}/>
      </div>
    </div>
  );
}

// ═══ RIGHT — CRM SIDEBAR ════════════════════════════════════════════════
function CRMSidebar({contact,onQuickReply,isDark,onToggle}) {
  const t = useTheme();
  const [tab,setTab] = useState("profil");
  const [noteForm,setNoteForm] = useState(false);
  const [noteRespon,setNoteRespon] = useState("merespon");
  const [noteText,setNoteText] = useState("");

  const actionBtnStyle = {
    display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:6,width:"100%",boxSizing:"border-box",
    border:`1px solid ${t.action_border}`,background:t.action_bg,
    color:t.wa_text,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"
  };

  if(!contact) return (
    <div style={{width:320,minWidth:320,background:t.crm_sidebar_bg,borderLeft:`1px solid ${t.wa_border}`,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"10px 14px",background:CRM_PRIMARY,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><Shield size={16} color="#fff"/><span style={{color:"#fff",fontSize:13,fontWeight:700}}>CRM Relawan Nusantara</span></div>
        <ToggleSwitch checked={isDark} onChange={onToggle}/>
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:t.wa_text_sec,padding:24,textAlign:"center"}}>
        <div><Eye size={32} style={{opacity:.3,marginBottom:8}}/><div style={{fontSize:13}}>Profil donatur akan muncul di sini saat Anda membuka percakapan</div></div>
      </div>
    </div>
  );

  const isOverdue = contact.follow_up==="in_progress" && contact.due && contact.due < "2026-04-15";
  const daysSince = contact.last_donation_at ? Math.floor((new Date("2026-04-15") - new Date(contact.last_donation_at))/86400000) : null;

  return (
    <div style={{width:320,minWidth:320,background:t.crm_sidebar_bg,borderLeft:`1px solid ${t.wa_border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"10px 14px",background:CRM_PRIMARY,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Shield size={16} color="#fff"/><span style={{color:"#fff",fontSize:13,fontWeight:700}}>CRM RN</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <ToggleSwitch checked={isDark} onChange={onToggle}/>
          <ExternalLink size={14} color="rgba(255,255,255,.6)" style={{cursor:"pointer"}}/>
        </div>
      </div>

      {/* Donor header */}
      <div style={{padding:"12px 14px",borderBottom:`1px solid ${t.wa_border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
          <div style={{width:8,height:8,borderRadius:4,background:t.wa_green}}/><span style={{color:t.wa_green,fontSize:10,fontWeight:700,letterSpacing:.5}}>DONATUR DITEMUKAN</span>
        </div>
        <div style={{color:t.wa_text,fontSize:16,fontWeight:700}}>{contact.name}</div>
        <div style={{color:t.wa_text_sec,fontSize:12,marginTop:2}}>+{contact.phone}</div>
        <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
          <Badge color={SEGMEN_COLORS[contact.segmen]}>{contact.segmen?.toUpperCase()}</Badge>
          <Badge color={t.wa_green}>{contact.status}</Badge>
          {isOverdue && <Badge color="#e74c3c">OVERDUE</Badge>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${t.wa_border}`}}>
        {[{key:"profil",label:"Profil",Ic:Eye},{key:"riwayat",label:"Riwayat",Ic:FileText},{key:"quick",label:"Quick Reply",Ic:Send}].map(x=>(
          <button key={x.key} onClick={()=>{setTab(x.key);setNoteForm(false);}}
            style={{flex:1,padding:"9px 4px",border:"none",cursor:"pointer",fontSize:11,fontWeight:tab===x.key?700:400,
              background:tab===x.key?CRM_PRIMARY+"25":"transparent",color:tab===x.key?CRM_PRIMARY:t.wa_text_sec,
              borderBottom:tab===x.key?`2px solid ${CRM_PRIMARY}`:"2px solid transparent",
              display:"flex",alignItems:"center",justifyContent:"center",gap:4,fontFamily:"inherit"}}>
            <x.Ic size={13}/>{x.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{flex:1,overflow:"auto",padding:"12px 14px"}}>

        {/* PROFIL */}
        {tab==="profil" && (<>
          {/* RFM */}
          <div style={{background:t.crm_card,borderRadius:8,padding:"10px 12px",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}><Target size={12} color={CRM_PRIMARY}/><span style={{fontSize:10,fontWeight:700,color:t.wa_text_sec}}>SKOR RFM</span></div>
            <div style={{display:"flex",justifyContent:"space-around"}}>
              {[{l:"R",v:contact.skor_r,f:"Recency"},{l:"F",v:contact.skor_f,f:"Frequency"},{l:"M",v:contact.skor_m,f:"Monetary"}].map(s=>(
                <div key={s.l} style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:700,color:CRM_PRIMARY}}>{s.v??"-"}</div><div style={{fontSize:10,color:t.wa_text_sec}}>{s.f}</div></div>
              ))}
            </div>
          </div>

          {/* Donasi */}
          <div style={{background:t.crm_card,borderRadius:8,padding:"10px 12px",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}><Wallet size={12} color={CRM_PRIMARY}/><span style={{fontSize:10,fontWeight:700,color:t.wa_text_sec}}>DONASI</span></div>
            <div style={{fontSize:12,color:t.wa_text,lineHeight:1.9}}>
              {[["Total Lifetime",fmt(contact.total)],["Frekuensi",contact.count+"x"],["Rata-rata",fmt(contact.avg)],
                ["Terakhir",contact.last_donation_at||"—"],["Program",contact.last_donation_prog],["Nominal",fmt(contact.last_donation_nom)],
              ].map(([k,v],i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between"}}><span style={{color:t.wa_text_sec}}>{k}</span><strong>{v}</strong></div>
              ))}
              {daysSince!=null && <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:t.wa_text_sec}}>Sejak Donasi</span><strong style={{color:daysSince>180?"#e74c3c":daysSince>90?"#f39c12":"inherit"}}>{daysSince} hari</strong></div>}
            </div>
          </div>

          {/* Programs */}
          <div style={{background:t.crm_card,borderRadius:8,padding:"10px 12px",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}><TrendingUp size={12} color={CRM_PRIMARY}/><span style={{fontSize:10,fontWeight:700,color:t.wa_text_sec}}>PROGRAM PERNAH DIIKUTI</span></div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{contact.programs.map(p=><Badge key={p} color={CRM_PRIMARY}>{p}</Badge>)}</div>
          </div>

          {/* Blast / Follow-up */}
          <div style={{background:t.crm_card,borderRadius:8,padding:"10px 12px",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}><Send size={12} color={CRM_PRIMARY}/><span style={{fontSize:10,fontWeight:700,color:t.wa_text_sec}}>BLAST & FOLLOW-UP</span></div>
            <div style={{fontSize:12,color:t.wa_text,lineHeight:1.9}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:t.wa_text_sec}}>Terakhir Blast</span><strong>{contact.last_blast_at||"Belum pernah"}</strong></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:t.wa_text_sec}}>Respon</span>
                <Badge color={contact.last_blast_respon==="closing"?CRM_PRIMARY:contact.last_blast_respon==="merespon"?"#3498db":"#f39c12"}>{contact.last_blast_respon||"—"}</Badge>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:t.wa_text_sec}}>PIC</span><strong>{contact.assigned_to||"—"}</strong></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:t.wa_text_sec}}>Follow-up</span>
                {contact.follow_up?<Badge color={isOverdue?"#e74c3c":"#f39c12"}>{contact.follow_up}{isOverdue&&<AlertTriangle size={10} style={{marginLeft:3,verticalAlign:"middle"}}/>}</Badge>:<span>—</span>}
              </div>
              {contact.due && <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:t.wa_text_sec}}>Due</span><strong style={{color:isOverdue?"#e74c3c":"inherit"}}>{contact.due}</strong></div>}
            </div>
          </div>

          {/* Tags */}
          {contact.tags.length>0 && (
            <div style={{background:t.crm_card,borderRadius:8,padding:"10px 12px",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}><Tag size={12} color={CRM_PRIMARY}/><span style={{fontSize:10,fontWeight:700,color:t.wa_text_sec}}>TAGS</span></div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{contact.tags.map(tg=><Badge key={tg}>{tg}</Badge>)}</div>
            </div>
          )}

          {/* Actions */}
          <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:6}}>
            <button onClick={()=>setNoteForm(!noteForm)} style={actionBtnStyle}><FileText size={13}/> Catat Respon</button>
            <button style={actionBtnStyle}><Tag size={13}/> Tambah Tag</button>
            <button style={{...actionBtnStyle,background:"rgba(231,76,60,.1)",borderColor:"rgba(231,76,60,.3)",color:"#e74c3c"}}><PhoneOff size={13}/> Tandai Opt-out</button>
          </div>

          {/* Note form */}
          {noteForm && (
            <div style={{background:t.note_form_bg,borderRadius:8,padding:12,marginTop:10,border:`1px solid ${CRM_PRIMARY}40`}}>
              <div style={{fontSize:11,fontWeight:700,color:CRM_PRIMARY,marginBottom:8}}>CATAT RESPON</div>
              <select value={noteRespon} onChange={e=>setNoteRespon(e.target.value)}
                style={{width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${t.crm_input_border}`,background:t.crm_input_bg,color:t.wa_text,fontSize:12,marginBottom:6,fontFamily:"inherit"}}>
                {["closing","merespon","hanya_read","belum_merespon","gagal","memblokir","opt_out"].map(o=><option key={o} value={o}>{o}</option>)}
              </select>
              <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Catatan..."
                style={{width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${t.crm_input_border}`,background:t.crm_input_bg,color:t.wa_text,fontSize:12,minHeight:50,resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}}/>
              <div style={{display:"flex",gap:6,marginTop:8}}>
                <button onClick={()=>{setNoteForm(false);setNoteText("");}} style={{flex:1,padding:"7px",borderRadius:6,border:`1px solid ${t.wa_border}`,background:"transparent",color:t.wa_text_sec,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Batal</button>
                <button onClick={()=>{setNoteForm(false);setNoteText("");}} style={{flex:1,padding:"7px",borderRadius:6,border:"none",background:CRM_PRIMARY,color:"#fff",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit"}}>Simpan</button>
              </div>
            </div>
          )}
        </>)}

        {/* RIWAYAT */}
        {tab==="riwayat" && (<>
          <div style={{fontSize:10,fontWeight:700,color:t.wa_text_sec,marginBottom:8,letterSpacing:.5}}>CATATAN PROSPEK TERAKHIR</div>
          {contact.notes.map((n,i)=>(
            <div key={i} style={{background:t.crm_card,borderRadius:8,padding:"10px 12px",marginBottom:8,borderLeft:`3px solid ${n.respon==="closing"?CRM_PRIMARY:n.respon==="merespon"?"#3498db":"#f39c12"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:700,color:t.wa_text}}>{n.tgl}</span>
                <Badge color={n.respon==="closing"?CRM_PRIMARY:n.respon==="merespon"?"#3498db":"#f39c12"}>{n.respon}</Badge>
              </div>
              <div style={{fontSize:12,color:t.wa_text,lineHeight:1.5}}>{n.text}</div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                <span style={{fontSize:10,color:t.wa_text_sec}}>PIC: {n.pic}</span>
                <Badge color={n.via==="extension"?"#4285f4":"#999"}>{n.via}</Badge>
              </div>
            </div>
          ))}
          {contact.notes.length===0 && <div style={{color:t.wa_text_sec,textAlign:"center",padding:20,fontSize:13}}>Belum ada catatan</div>}
        </>)}

        {/* QUICK REPLY */}
        {tab==="quick" && (<>
          <div style={{fontSize:10,fontWeight:700,color:t.wa_text_sec,marginBottom:8,letterSpacing:.5}}>TEMPLATE BALASAN CEPAT</div>
          {QUICK_REPLIES.map((qr,i)=>(
            <div key={i} onClick={()=>onQuickReply(qr.text.replace(/\{nama\}/g, contact.name.split(" ")[0]))}
              style={{background:t.crm_card,borderRadius:8,padding:"10px 12px",marginBottom:8,cursor:"pointer",border:`1px solid transparent`,transition:"all .15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=CRM_PRIMARY+"60"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="transparent"}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <qr.icon size={13} color={CRM_PRIMARY}/>
                <span style={{fontSize:12,fontWeight:700,color:t.wa_text}}>{qr.label}</span>
                <Copy size={11} color={t.wa_text_sec} style={{marginLeft:"auto"}}/>
              </div>
              <div style={{fontSize:11,color:t.wa_text_sec,lineHeight:1.4,whiteSpace:"pre-wrap",maxHeight:48,overflow:"hidden"}}>
                {qr.text.replace(/\{nama\}/g, contact.name.split(" ")[0]).substring(0,120)}...
              </div>
            </div>
          ))}
          <div style={{fontSize:10,color:t.wa_text_sec,textAlign:"center",marginTop:8,opacity:.7}}>Klik template untuk paste ke input chat</div>
        </>)}
      </div>
    </div>
  );
}

// ═══ APP ══════════════════════════════════════════════════════════════════
export default function App() {
  const [selected,setSelected] = useState(null);
  const [isDark,setIsDark] = useState(true);
  const inputRef = useRef(null);
  const theme = isDark ? THEMES.dark : THEMES.light;

  const handleSend = (text) => { console.log("Send:", text); };
  const handleQuickReply = (text) => { if(inputRef.current){inputRef.current.value=text;inputRef.current.focus();} };

  return (
    <ThemeCtx.Provider value={theme}>
      <div style={{display:"flex",height:"100vh",fontFamily:"'Segoe UI','Helvetica Neue',sans-serif",fontSize:14,background:theme.wa_bg,overflow:"hidden",transition:"background .3s"}}>
        <ChatList contacts={CONTACTS} selected={selected} onSelect={setSelected}/>
        <ChatDialog contact={selected} onSend={handleSend} inputRef={inputRef}/>
        <CRMSidebar contact={selected} onQuickReply={handleQuickReply} isDark={isDark} onToggle={()=>setIsDark(!isDark)}/>
      </div>
    </ThemeCtx.Provider>
  );
}
