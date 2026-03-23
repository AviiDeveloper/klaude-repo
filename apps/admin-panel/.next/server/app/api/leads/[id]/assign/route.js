"use strict";(()=>{var e={};e.id=880,e.ids=[880],e.modules={2934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4770:e=>{e.exports=require("crypto")},5315:e=>{e.exports=require("path")},8544:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>m,patchFetch:()=>A,requestAsyncStorage:()=>c,routeModule:()=>u,serverHooks:()=>p,staticGenerationAsyncStorage:()=>_});var s={};a.r(s),a.d(s,{POST:()=>l});var r=a(9303),n=a(8716),i=a(670),o=a(7070),T=a(5898),d=a(8290),E=a(4770);async function l(e,{params:t}){let a=(0,T.Xb)(e);if(!a||"viewer"===a.role)return o.NextResponse.json({error:"Insufficient permissions"},{status:403});let{user_id:s}=await e.json();if(!s)return o.NextResponse.json({error:"user_id required"},{status:400});let r=t.id,n=new Date().toISOString();try{return(0,d.PS)(()=>{if((0,d.pP)("SELECT id FROM lead_assignments WHERE lead_id = ? AND status NOT IN ('rejected')",r))throw Error("ALREADY_ASSIGNED");let e=(0,E.randomUUID)();(0,d.KH)(`INSERT INTO lead_assignments (id, lead_id, user_id, status, assigned_at, created_at, updated_at)
         VALUES (?, ?, ?, 'new', ?, ?, ?)`,e,r,s,n,n,n),(0,d.KH)(`INSERT INTO sales_activity_log (id, user_id, lead_id, assignment_id, action, notes, created_at)
         VALUES (?, ?, ?, ?, 'manual_assigned', ?, ?)`,(0,E.randomUUID)(),s,r,e,`Manually assigned by admin ${a.name}`,n)}),o.NextResponse.json({data:{ok:!0}})}catch(t){let e=t instanceof Error?t.message:String(t);if("ALREADY_ASSIGNED"===e)return o.NextResponse.json({error:"Lead already assigned"},{status:409});return o.NextResponse.json({error:e},{status:500})}}let u=new r.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/leads/[id]/assign/route",pathname:"/api/leads/[id]/assign",filename:"route",bundlePath:"app/api/leads/[id]/assign/route"},resolvedPagePath:"/Users/Avii/Desktop/klaude-repo/apps/admin-panel/src/app/api/leads/[id]/assign/route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:c,staticGenerationAsyncStorage:_,serverHooks:p}=u,m="/api/leads/[id]/assign/route";function A(){return(0,i.patchFetch)({serverHooks:p,staticGenerationAsyncStorage:_})}},5898:(e,t,a)=>{a.d(t,{B$:()=>i,Xb:()=>T,cW:()=>d});var s=a(4770);a(1615);var r=a(8290);let n=process.env.ADMIN_SECRET||"admin-panel-dev-secret-change-in-production",i="admin_session";function o(e){let[t,a]=e.split(".");if(!t||!a||a!==(0,s.createHmac)("sha256",n).update(t).digest("base64url"))return null;try{let e=JSON.parse(Buffer.from(t,"base64url").toString());if(e.exp<Date.now()/1e3)return null;return e}catch{return null}}function T(e){let t=e.cookies.get(i)?.value;if(t){let e=o(t);if(e)return e}let a=e.headers.get("authorization");return a?.startsWith("Bearer ")?o(a.slice(7)):null}function d(e,t){let a=(0,s.createHash)("sha256").update(`${n}:${t}`).digest("hex"),i=(0,r.pP)("SELECT * FROM admin_users WHERE (name = ? OR email = ?) AND password_hash = ? AND active = 1",e,e,a);if(!i)return null;let o={id:i.id,name:i.name,email:i.email,role:i.role,active:!0,last_login_at:i.last_login_at,created_at:i.created_at},T=Math.floor(Date.now()/1e3)+604800,d=function(e){let t=Buffer.from(JSON.stringify(e)).toString("base64url"),a=(0,s.createHmac)("sha256",n).update(t).digest("base64url");return`${t}.${a}`}({user_id:o.id,name:o.name,role:o.role,exp:T});return(0,r.KH)("UPDATE admin_users SET last_login_at = ? WHERE id = ?",new Date().toISOString(),o.id),{user:o,token:d}}},8290:(e,t,a)=>{a.d(t,{Kt:()=>u,pP:()=>c,KH:()=>_,PS:()=>p});let s=require("better-sqlite3");var r=a.n(s),n=a(5315),i=a.n(n);let o=require("fs");var T=a.n(o);let d=process.env.DATABASE_PATH||i().join(process.cwd(),"..","mission-control","mission-control.db"),E=null;function l(){if(!E){let e=i().dirname(d);T().existsSync(e)||T().mkdirSync(e,{recursive:!0}),(E=new(r())(d)).pragma("journal_mode = WAL"),E.pragma("foreign_keys = ON"),E.exec(m);let t=e=>{try{E.exec(e)}catch{}};t("ALTER TABLE sales_users ADD COLUMN area_postcodes_json TEXT"),t("ALTER TABLE sales_users ADD COLUMN max_active_leads INTEGER DEFAULT 20"),t("ALTER TABLE sales_users ADD COLUMN user_status TEXT DEFAULT 'available'")}return E}function u(e,...t){return l().prepare(e).all(...t)}function c(e,...t){return l().prepare(e).get(...t)}function _(e,...t){return l().prepare(e).run(...t)}function p(e){return l().transaction(e)()}let m=`
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'manager' CHECK (role IN ('owner', 'manager', 'viewer')),
  active INTEGER DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS assignment_rules (
  id TEXT PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('area_match', 'capacity_cap', 'vertical_preference', 'round_robin')),
  config_json TEXT NOT NULL DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS sales_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  area_postcode TEXT,
  commission_rate REAL DEFAULT 0.10,
  active INTEGER DEFAULT 1,
  api_token TEXT,
  push_token TEXT,
  device_type TEXT,
  last_active_at TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS lead_assignments (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  assigned_at TEXT,
  status TEXT DEFAULT 'new',
  visited_at TEXT,
  pitched_at TEXT,
  sold_at TEXT,
  rejected_at TEXT,
  rejection_reason TEXT,
  notes TEXT,
  commission_amount REAL,
  location_lat REAL,
  location_lng REAL,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sales_activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  lead_id TEXT,
  assignment_id TEXT,
  action TEXT NOT NULL,
  notes TEXT,
  location_lat REAL,
  location_lng REAL,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_assignments_user_status ON lead_assignments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead ON lead_assignments(lead_id);
`}};var t=require("../../../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),s=t.X(0,[276,564],()=>a(8544));module.exports=s})();