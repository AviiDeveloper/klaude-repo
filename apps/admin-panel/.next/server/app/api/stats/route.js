"use strict";(()=>{var e={};e.id=961,e.ids=[961],e.modules={2934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4770:e=>{e.exports=require("crypto")},5315:e=>{e.exports=require("path")},3519:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>p,patchFetch:()=>m,requestAsyncStorage:()=>u,routeModule:()=>d,serverHooks:()=>c,staticGenerationAsyncStorage:()=>_});var s={};a.r(s),a.d(s,{GET:()=>l});var n=a(9303),r=a(8716),i=a(670),E=a(7070),T=a(5898),o=a(8290);async function l(e){if(!(0,T.Xb)(e))return E.NextResponse.json({error:"Unauthorized"},{status:401});let t=(0,o.pP)(`
    SELECT
      (SELECT COUNT(*) FROM sales_users WHERE active = 1) as total_salespeople,
      (SELECT COUNT(*) FROM sales_users WHERE active = 1 AND last_active_at > datetime('now', '-24 hours')) as active_salespeople,
      (SELECT COUNT(*) FROM lead_assignments) as total_leads,
      (SELECT COUNT(*) FROM lead_assignments WHERE status = 'visited') as total_visits,
      (SELECT COUNT(*) FROM lead_assignments WHERE status = 'pitched') as total_pitches,
      (SELECT COUNT(*) FROM lead_assignments WHERE status = 'sold') as total_sales,
      COALESCE((SELECT SUM(commission_amount) FROM lead_assignments WHERE status = 'sold'), 0) as total_revenue,
      (SELECT COUNT(*) FROM lead_assignments WHERE visited_at > date('now', '-7 days')) as visits_this_week,
      (SELECT COUNT(*) FROM lead_assignments WHERE sold_at > date('now', '-7 days')) as sales_this_week,
      COALESCE((SELECT SUM(commission_amount) FROM lead_assignments WHERE sold_at > date('now', '-7 days')), 0) as revenue_this_week
  `),a=(t?.total_visits??0)+(t?.total_pitches??0)+(t?.total_sales??0),s=(0,o.pP)(`
    SELECT
      COUNT(*) as assigned,
      SUM(CASE WHEN status IN ('visited','pitched','sold') THEN 1 ELSE 0 END) as visited,
      SUM(CASE WHEN status IN ('pitched','sold') THEN 1 ELSE 0 END) as pitched,
      SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM lead_assignments
  `),n=[];for(let e of(0,o.Kt)(`
    SELECT name FROM sales_users
    WHERE active = 1 AND (last_active_at < datetime('now', '-3 days') OR last_active_at IS NULL)
  `))n.push({type:"warning",message:`${e.name} hasn't been active for 3+ days`});for(let e of(0,o.Kt)(`
    SELECT lead_id, COUNT(*) as cnt FROM lead_assignments
    WHERE status = 'rejected' GROUP BY lead_id HAVING cnt >= 2
  `))n.push({type:"danger",message:`Lead ${e.lead_id} rejected by ${e.cnt} salespeople — review needed`});return E.NextResponse.json({data:{stats:{...t,conversion_rate:a>0?(t?.total_sales??0)/a*100:0},funnel:s,alerts:n}})}let d=new n.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/stats/route",pathname:"/api/stats",filename:"route",bundlePath:"app/api/stats/route"},resolvedPagePath:"/Users/Avii/Desktop/klaude-repo/apps/admin-panel/src/app/api/stats/route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:u,staticGenerationAsyncStorage:_,serverHooks:c}=d,p="/api/stats/route";function m(){return(0,i.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:_})}},5898:(e,t,a)=>{a.d(t,{B$:()=>i,Xb:()=>T,cW:()=>o});var s=a(4770);a(1615);var n=a(8290);let r=process.env.ADMIN_SECRET||"admin-panel-dev-secret-change-in-production",i="admin_session";function E(e){let[t,a]=e.split(".");if(!t||!a||a!==(0,s.createHmac)("sha256",r).update(t).digest("base64url"))return null;try{let e=JSON.parse(Buffer.from(t,"base64url").toString());if(e.exp<Date.now()/1e3)return null;return e}catch{return null}}function T(e){let t=e.cookies.get(i)?.value;if(t){let e=E(t);if(e)return e}let a=e.headers.get("authorization");return a?.startsWith("Bearer ")?E(a.slice(7)):null}function o(e,t){let a=(0,s.createHash)("sha256").update(`${r}:${t}`).digest("hex"),i=(0,n.pP)("SELECT * FROM admin_users WHERE (name = ? OR email = ?) AND password_hash = ? AND active = 1",e,e,a);if(!i)return null;let E={id:i.id,name:i.name,email:i.email,role:i.role,active:!0,last_login_at:i.last_login_at,created_at:i.created_at},T=Math.floor(Date.now()/1e3)+604800,o=function(e){let t=Buffer.from(JSON.stringify(e)).toString("base64url"),a=(0,s.createHmac)("sha256",r).update(t).digest("base64url");return`${t}.${a}`}({user_id:E.id,name:E.name,role:E.role,exp:T});return(0,n.KH)("UPDATE admin_users SET last_login_at = ? WHERE id = ?",new Date().toISOString(),E.id),{user:E,token:o}}},8290:(e,t,a)=>{a.d(t,{Kt:()=>u,pP:()=>_,KH:()=>c,PS:()=>p});let s=require("better-sqlite3");var n=a.n(s),r=a(5315),i=a.n(r);let E=require("fs");var T=a.n(E);let o=process.env.DATABASE_PATH||i().join(process.cwd(),"..","mission-control","mission-control.db"),l=null;function d(){if(!l){let e=i().dirname(o);T().existsSync(e)||T().mkdirSync(e,{recursive:!0}),(l=new(n())(o)).pragma("journal_mode = WAL"),l.pragma("foreign_keys = ON"),l.exec(m);let t=e=>{try{l.exec(e)}catch{}};t("ALTER TABLE sales_users ADD COLUMN area_postcodes_json TEXT"),t("ALTER TABLE sales_users ADD COLUMN max_active_leads INTEGER DEFAULT 20"),t("ALTER TABLE sales_users ADD COLUMN user_status TEXT DEFAULT 'available'")}return l}function u(e,...t){return d().prepare(e).all(...t)}function _(e,...t){return d().prepare(e).get(...t)}function c(e,...t){return d().prepare(e).run(...t)}function p(e){return d().transaction(e)()}let m=`
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
`}};var t=require("../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),s=t.X(0,[276,564],()=>a(3519));module.exports=s})();