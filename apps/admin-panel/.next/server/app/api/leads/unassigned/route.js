"use strict";(()=>{var e={};e.id=18,e.ids=[18],e.modules={2934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4770:e=>{e.exports=require("crypto")},5315:e=>{e.exports=require("path")},3245:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>p,patchFetch:()=>m,requestAsyncStorage:()=>u,routeModule:()=>d,serverHooks:()=>_,staticGenerationAsyncStorage:()=>c});var s={};a.r(s),a.d(s,{GET:()=>l});var r=a(9303),n=a(8716),i=a(670),T=a(7070),o=a(5898),E=a(8290);async function l(e){if(!(0,o.Xb)(e))return T.NextResponse.json({error:"Unauthorized"},{status:401});let t=(0,E.Kt)(`
    SELECT sal.lead_id, sal.notes, sal.created_at
    FROM sales_activity_log sal
    WHERE sal.action = 'auto_assigned'
      AND sal.lead_id NOT IN (
        SELECT la.lead_id FROM lead_assignments la WHERE la.status NOT IN ('rejected')
      )
    ORDER BY sal.created_at DESC
    LIMIT 100
  `);return T.NextResponse.json({data:t})}let d=new r.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/leads/unassigned/route",pathname:"/api/leads/unassigned",filename:"route",bundlePath:"app/api/leads/unassigned/route"},resolvedPagePath:"/Users/Avii/Desktop/klaude-repo/apps/admin-panel/src/app/api/leads/unassigned/route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:u,staticGenerationAsyncStorage:c,serverHooks:_}=d,p="/api/leads/unassigned/route";function m(){return(0,i.patchFetch)({serverHooks:_,staticGenerationAsyncStorage:c})}},5898:(e,t,a)=>{a.d(t,{B$:()=>i,Xb:()=>o,cW:()=>E});var s=a(4770);a(1615);var r=a(8290);let n=process.env.ADMIN_SECRET||"admin-panel-dev-secret-change-in-production",i="admin_session";function T(e){let[t,a]=e.split(".");if(!t||!a||a!==(0,s.createHmac)("sha256",n).update(t).digest("base64url"))return null;try{let e=JSON.parse(Buffer.from(t,"base64url").toString());if(e.exp<Date.now()/1e3)return null;return e}catch{return null}}function o(e){let t=e.cookies.get(i)?.value;if(t){let e=T(t);if(e)return e}let a=e.headers.get("authorization");return a?.startsWith("Bearer ")?T(a.slice(7)):null}function E(e,t){let a=(0,s.createHash)("sha256").update(`${n}:${t}`).digest("hex"),i=(0,r.pP)("SELECT * FROM admin_users WHERE (name = ? OR email = ?) AND password_hash = ? AND active = 1",e,e,a);if(!i)return null;let T={id:i.id,name:i.name,email:i.email,role:i.role,active:!0,last_login_at:i.last_login_at,created_at:i.created_at},o=Math.floor(Date.now()/1e3)+604800,E=function(e){let t=Buffer.from(JSON.stringify(e)).toString("base64url"),a=(0,s.createHmac)("sha256",n).update(t).digest("base64url");return`${t}.${a}`}({user_id:T.id,name:T.name,role:T.role,exp:o});return(0,r.KH)("UPDATE admin_users SET last_login_at = ? WHERE id = ?",new Date().toISOString(),T.id),{user:T,token:E}}},8290:(e,t,a)=>{a.d(t,{Kt:()=>u,pP:()=>c,KH:()=>_,PS:()=>p});let s=require("better-sqlite3");var r=a.n(s),n=a(5315),i=a.n(n);let T=require("fs");var o=a.n(T);let E=process.env.DATABASE_PATH||i().join(process.cwd(),"..","mission-control","mission-control.db"),l=null;function d(){if(!l){let e=i().dirname(E);o().existsSync(e)||o().mkdirSync(e,{recursive:!0}),(l=new(r())(E)).pragma("journal_mode = WAL"),l.pragma("foreign_keys = ON"),l.exec(m);let t=e=>{try{l.exec(e)}catch{}};t("ALTER TABLE sales_users ADD COLUMN area_postcodes_json TEXT"),t("ALTER TABLE sales_users ADD COLUMN max_active_leads INTEGER DEFAULT 20"),t("ALTER TABLE sales_users ADD COLUMN user_status TEXT DEFAULT 'available'")}return l}function u(e,...t){return d().prepare(e).all(...t)}function c(e,...t){return d().prepare(e).get(...t)}function _(e,...t){return d().prepare(e).run(...t)}function p(e){return d().transaction(e)()}let m=`
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
`}};var t=require("../../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),s=t.X(0,[276,564],()=>a(3245));module.exports=s})();