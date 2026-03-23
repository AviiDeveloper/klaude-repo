"use strict";(()=>{var e={};e.id=788,e.ids=[788],e.modules={2934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4770:e=>{e.exports=require("crypto")},5315:e=>{e.exports=require("path")},9627:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>p,patchFetch:()=>_,requestAsyncStorage:()=>u,routeModule:()=>l,serverHooks:()=>c,staticGenerationAsyncStorage:()=>d});var r={};a.r(r),a.d(r,{GET:()=>E});var n=a(9303),s=a(8716),i=a(670),T=a(7070),o=a(5898);async function E(e){let t=(0,o.Xb)(e);return t?T.NextResponse.json({data:t}):T.NextResponse.json({error:"Unauthorized",code:"AUTH_REQUIRED"},{status:401})}let l=new n.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/auth/me/route",pathname:"/api/auth/me",filename:"route",bundlePath:"app/api/auth/me/route"},resolvedPagePath:"/Users/Avii/Desktop/klaude-repo/apps/admin-panel/src/app/api/auth/me/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:u,staticGenerationAsyncStorage:d,serverHooks:c}=l,p="/api/auth/me/route";function _(){return(0,i.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:d})}},5898:(e,t,a)=>{a.d(t,{B$:()=>i,Xb:()=>o,cW:()=>E});var r=a(4770);a(1615);var n=a(8290);let s=process.env.ADMIN_SECRET||"admin-panel-dev-secret-change-in-production",i="admin_session";function T(e){let[t,a]=e.split(".");if(!t||!a||a!==(0,r.createHmac)("sha256",s).update(t).digest("base64url"))return null;try{let e=JSON.parse(Buffer.from(t,"base64url").toString());if(e.exp<Date.now()/1e3)return null;return e}catch{return null}}function o(e){let t=e.cookies.get(i)?.value;if(t){let e=T(t);if(e)return e}let a=e.headers.get("authorization");return a?.startsWith("Bearer ")?T(a.slice(7)):null}function E(e,t){let a=(0,r.createHash)("sha256").update(`${s}:${t}`).digest("hex"),i=(0,n.pP)("SELECT * FROM admin_users WHERE (name = ? OR email = ?) AND password_hash = ? AND active = 1",e,e,a);if(!i)return null;let T={id:i.id,name:i.name,email:i.email,role:i.role,active:!0,last_login_at:i.last_login_at,created_at:i.created_at},o=Math.floor(Date.now()/1e3)+604800,E=function(e){let t=Buffer.from(JSON.stringify(e)).toString("base64url"),a=(0,r.createHmac)("sha256",s).update(t).digest("base64url");return`${t}.${a}`}({user_id:T.id,name:T.name,role:T.role,exp:o});return(0,n.KH)("UPDATE admin_users SET last_login_at = ? WHERE id = ?",new Date().toISOString(),T.id),{user:T,token:E}}},8290:(e,t,a)=>{a.d(t,{Kt:()=>d,pP:()=>c,KH:()=>p,PS:()=>_});let r=require("better-sqlite3");var n=a.n(r),s=a(5315),i=a.n(s);let T=require("fs");var o=a.n(T);let E=process.env.DATABASE_PATH||i().join(process.cwd(),"..","mission-control","mission-control.db"),l=null;function u(){if(!l){let e=i().dirname(E);o().existsSync(e)||o().mkdirSync(e,{recursive:!0}),(l=new(n())(E)).pragma("journal_mode = WAL"),l.pragma("foreign_keys = ON"),l.exec(m);let t=e=>{try{l.exec(e)}catch{}};t("ALTER TABLE sales_users ADD COLUMN area_postcodes_json TEXT"),t("ALTER TABLE sales_users ADD COLUMN max_active_leads INTEGER DEFAULT 20"),t("ALTER TABLE sales_users ADD COLUMN user_status TEXT DEFAULT 'available'")}return l}function d(e,...t){return u().prepare(e).all(...t)}function c(e,...t){return u().prepare(e).get(...t)}function p(e,...t){return u().prepare(e).run(...t)}function _(e){return u().transaction(e)()}let m=`
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
`}};var t=require("../../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),r=t.X(0,[276,564],()=>a(9627));module.exports=r})();