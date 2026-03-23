"use strict";(()=>{var e={};e.id=350,e.ids=[350],e.modules={2934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4770:e=>{e.exports=require("crypto")},5315:e=>{e.exports=require("path")},4898:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>p,patchFetch:()=>m,requestAsyncStorage:()=>E,routeModule:()=>u,serverHooks:()=>c,staticGenerationAsyncStorage:()=>_});var s={};a.r(s),a.d(s,{GET:()=>d});var n=a(9303),r=a(8716),i=a(670),o=a(7070),l=a(5898),T=a(8290);async function d(e){if(!(0,l.Xb)(e))return o.NextResponse.json({error:"Unauthorized"},{status:401});let{searchParams:t}=new URL(e.url),a=t.get("status");t.get("area"),t.get("assigned");let s=t.get("q"),n=`
    SELECT
      la.id as assignment_id, la.lead_id, la.status, la.assigned_at, la.notes,
      la.commission_amount, la.visited_at, la.pitched_at, la.sold_at,
      su.name as assigned_to_name, su.id as assigned_to_id
    FROM lead_assignments la
    LEFT JOIN sales_users su ON su.id = la.user_id
    WHERE 1=1
  `,r=[];a&&(n+=" AND la.status = ?",r.push(a)),s&&(n+=" AND la.notes LIKE ?",r.push(`%${s}%`)),n+=" ORDER BY la.created_at DESC LIMIT 200";let i=(0,T.Kt)(n,...r).map(e=>{let t={};try{t=JSON.parse(e.notes??"{}")}catch{}return{assignment_id:e.assignment_id,lead_id:e.lead_id,business_name:t.business_name??"Unknown",business_type:t.business_type??null,postcode:t.postcode??null,phone:t.phone??null,google_rating:t.google_rating??null,google_review_count:t.google_review_count??null,status:e.status,assigned_to_name:e.assigned_to_name,assigned_to_id:e.assigned_to_id,assigned_at:e.assigned_at,demo_site_domain:t.demo_site_domain??null,commission_amount:e.commission_amount}});return o.NextResponse.json({data:i})}let u=new n.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/leads/route",pathname:"/api/leads",filename:"route",bundlePath:"app/api/leads/route"},resolvedPagePath:"/Users/Avii/Desktop/klaude-repo/apps/admin-panel/src/app/api/leads/route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:E,staticGenerationAsyncStorage:_,serverHooks:c}=u,p="/api/leads/route";function m(){return(0,i.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:_})}},5898:(e,t,a)=>{a.d(t,{B$:()=>i,Xb:()=>l,cW:()=>T});var s=a(4770);a(1615);var n=a(8290);let r=process.env.ADMIN_SECRET||"admin-panel-dev-secret-change-in-production",i="admin_session";function o(e){let[t,a]=e.split(".");if(!t||!a||a!==(0,s.createHmac)("sha256",r).update(t).digest("base64url"))return null;try{let e=JSON.parse(Buffer.from(t,"base64url").toString());if(e.exp<Date.now()/1e3)return null;return e}catch{return null}}function l(e){let t=e.cookies.get(i)?.value;if(t){let e=o(t);if(e)return e}let a=e.headers.get("authorization");return a?.startsWith("Bearer ")?o(a.slice(7)):null}function T(e,t){let a=(0,s.createHash)("sha256").update(`${r}:${t}`).digest("hex"),i=(0,n.pP)("SELECT * FROM admin_users WHERE (name = ? OR email = ?) AND password_hash = ? AND active = 1",e,e,a);if(!i)return null;let o={id:i.id,name:i.name,email:i.email,role:i.role,active:!0,last_login_at:i.last_login_at,created_at:i.created_at},l=Math.floor(Date.now()/1e3)+604800,T=function(e){let t=Buffer.from(JSON.stringify(e)).toString("base64url"),a=(0,s.createHmac)("sha256",r).update(t).digest("base64url");return`${t}.${a}`}({user_id:o.id,name:o.name,role:o.role,exp:l});return(0,n.KH)("UPDATE admin_users SET last_login_at = ? WHERE id = ?",new Date().toISOString(),o.id),{user:o,token:T}}},8290:(e,t,a)=>{a.d(t,{Kt:()=>E,pP:()=>_,KH:()=>c,PS:()=>p});let s=require("better-sqlite3");var n=a.n(s),r=a(5315),i=a.n(r);let o=require("fs");var l=a.n(o);let T=process.env.DATABASE_PATH||i().join(process.cwd(),"..","mission-control","mission-control.db"),d=null;function u(){if(!d){let e=i().dirname(T);l().existsSync(e)||l().mkdirSync(e,{recursive:!0}),(d=new(n())(T)).pragma("journal_mode = WAL"),d.pragma("foreign_keys = ON"),d.exec(m);let t=e=>{try{d.exec(e)}catch{}};t("ALTER TABLE sales_users ADD COLUMN area_postcodes_json TEXT"),t("ALTER TABLE sales_users ADD COLUMN max_active_leads INTEGER DEFAULT 20"),t("ALTER TABLE sales_users ADD COLUMN user_status TEXT DEFAULT 'available'")}return d}function E(e,...t){return u().prepare(e).all(...t)}function _(e,...t){return u().prepare(e).get(...t)}function c(e,...t){return u().prepare(e).run(...t)}function p(e){return u().transaction(e)()}let m=`
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
`}};var t=require("../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),s=t.X(0,[276,564],()=>a(4898));module.exports=s})();