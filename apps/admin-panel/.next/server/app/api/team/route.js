"use strict";(()=>{var e={};e.id=750,e.ids=[750],e.modules={2934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4770:e=>{e.exports=require("crypto")},5315:e=>{e.exports=require("path")},2419:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>A,patchFetch:()=>R,requestAsyncStorage:()=>p,routeModule:()=>c,serverHooks:()=>N,staticGenerationAsyncStorage:()=>m});var s={};a.r(s),a.d(s,{GET:()=>d,POST:()=>_});var r=a(9303),n=a(8716),i=a(670),o=a(7070),l=a(5898),T=a(8290),E=a(4770);let u=process.env.SD_SECRET||"sales-dashboard-dev-secret-change-in-production";async function d(e){if(!(0,l.Xb)(e))return o.NextResponse.json({error:"Unauthorized"},{status:401});let t=(0,T.Kt)(`
    SELECT
      su.*,
      (SELECT COUNT(*) FROM lead_assignments la WHERE la.user_id = su.id AND la.status IN ('new','visited','pitched')) as active_leads,
      (SELECT COUNT(*) FROM lead_assignments la WHERE la.user_id = su.id AND la.status = 'visited') as total_visits,
      (SELECT COUNT(*) FROM lead_assignments la WHERE la.user_id = su.id AND la.status = 'pitched') as total_pitches,
      (SELECT COUNT(*) FROM lead_assignments la WHERE la.user_id = su.id AND la.status = 'sold') as total_sales,
      COALESCE((SELECT SUM(la.commission_amount) FROM lead_assignments la WHERE la.user_id = su.id AND la.status = 'sold'), 0) as total_commission
    FROM sales_users su
    ORDER BY su.active DESC, su.name ASC
  `).map(e=>{let t=e.total_visits+e.total_pitches+e.total_sales+e.active_leads;return{id:e.id,name:e.name,email:e.email,phone:e.phone,area_postcode:e.area_postcode,area_postcodes_json:e.area_postcodes_json,max_active_leads:e.max_active_leads??20,user_status:e.user_status??"available",commission_rate:e.commission_rate??.1,active:1===e.active,last_active_at:e.last_active_at,created_at:e.created_at,active_leads:e.active_leads,total_visits:e.total_visits,total_pitches:e.total_pitches,total_sales:e.total_sales,total_commission:e.total_commission,conversion_rate:t>0?e.total_sales/t*100:0}});return o.NextResponse.json({data:t})}async function _(e){let t=(0,l.Xb)(e);if(!t||"viewer"===t.role)return o.NextResponse.json({error:"Insufficient permissions"},{status:403});let{name:a,pin:s,email:r,phone:n,area_postcode:i,area_postcodes:d,commission_rate:_,max_active_leads:c}=await e.json();if(!a||!s)return o.NextResponse.json({error:"Name and PIN required"},{status:400});let p=(0,E.randomUUID)(),m=new Date().toISOString(),N=(0,E.createHash)("sha256").update(`${u}:${s}`).digest("hex");try{return(0,T.KH)(`INSERT INTO sales_users (id, name, pin_hash, email, phone, area_postcode, area_postcodes_json, commission_rate, max_active_leads, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,p,a,N,r??null,n??null,i??null,d?JSON.stringify(d):null,_??.1,c??20,m,m),o.NextResponse.json({data:{id:p,name:a}},{status:201})}catch(t){let e=t instanceof Error?t.message:String(t);if(e.includes("UNIQUE"))return o.NextResponse.json({error:"User already exists"},{status:409});return o.NextResponse.json({error:e},{status:500})}}let c=new r.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/team/route",pathname:"/api/team",filename:"route",bundlePath:"app/api/team/route"},resolvedPagePath:"/Users/Avii/Desktop/klaude-repo/apps/admin-panel/src/app/api/team/route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:p,staticGenerationAsyncStorage:m,serverHooks:N}=c,A="/api/team/route";function R(){return(0,i.patchFetch)({serverHooks:N,staticGenerationAsyncStorage:m})}},5898:(e,t,a)=>{a.d(t,{B$:()=>i,Xb:()=>l,cW:()=>T});var s=a(4770);a(1615);var r=a(8290);let n=process.env.ADMIN_SECRET||"admin-panel-dev-secret-change-in-production",i="admin_session";function o(e){let[t,a]=e.split(".");if(!t||!a||a!==(0,s.createHmac)("sha256",n).update(t).digest("base64url"))return null;try{let e=JSON.parse(Buffer.from(t,"base64url").toString());if(e.exp<Date.now()/1e3)return null;return e}catch{return null}}function l(e){let t=e.cookies.get(i)?.value;if(t){let e=o(t);if(e)return e}let a=e.headers.get("authorization");return a?.startsWith("Bearer ")?o(a.slice(7)):null}function T(e,t){let a=(0,s.createHash)("sha256").update(`${n}:${t}`).digest("hex"),i=(0,r.pP)("SELECT * FROM admin_users WHERE (name = ? OR email = ?) AND password_hash = ? AND active = 1",e,e,a);if(!i)return null;let o={id:i.id,name:i.name,email:i.email,role:i.role,active:!0,last_login_at:i.last_login_at,created_at:i.created_at},l=Math.floor(Date.now()/1e3)+604800,T=function(e){let t=Buffer.from(JSON.stringify(e)).toString("base64url"),a=(0,s.createHmac)("sha256",n).update(t).digest("base64url");return`${t}.${a}`}({user_id:o.id,name:o.name,role:o.role,exp:l});return(0,r.KH)("UPDATE admin_users SET last_login_at = ? WHERE id = ?",new Date().toISOString(),o.id),{user:o,token:T}}},8290:(e,t,a)=>{a.d(t,{Kt:()=>d,pP:()=>_,KH:()=>c,PS:()=>p});let s=require("better-sqlite3");var r=a.n(s),n=a(5315),i=a.n(n);let o=require("fs");var l=a.n(o);let T=process.env.DATABASE_PATH||i().join(process.cwd(),"..","mission-control","mission-control.db"),E=null;function u(){if(!E){let e=i().dirname(T);l().existsSync(e)||l().mkdirSync(e,{recursive:!0}),(E=new(r())(T)).pragma("journal_mode = WAL"),E.pragma("foreign_keys = ON"),E.exec(m);let t=e=>{try{E.exec(e)}catch{}};t("ALTER TABLE sales_users ADD COLUMN area_postcodes_json TEXT"),t("ALTER TABLE sales_users ADD COLUMN max_active_leads INTEGER DEFAULT 20"),t("ALTER TABLE sales_users ADD COLUMN user_status TEXT DEFAULT 'available'")}return E}function d(e,...t){return u().prepare(e).all(...t)}function _(e,...t){return u().prepare(e).get(...t)}function c(e,...t){return u().prepare(e).run(...t)}function p(e){return u().transaction(e)()}let m=`
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
`}};var t=require("../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),s=t.X(0,[276,564],()=>a(2419));module.exports=s})();