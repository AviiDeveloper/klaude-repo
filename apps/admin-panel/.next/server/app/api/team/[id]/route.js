"use strict";(()=>{var e={};e.id=250,e.ids=[250],e.modules={2934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4770:e=>{e.exports=require("crypto")},5315:e=>{e.exports=require("path")},4658:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>N,patchFetch:()=>X,requestAsyncStorage:()=>p,routeModule:()=>c,serverHooks:()=>m,staticGenerationAsyncStorage:()=>_});var s={};a.r(s),a.d(s,{DELETE:()=>d,GET:()=>l,PATCH:()=>u});var r=a(9303),n=a(8716),i=a(670),o=a(7070),T=a(5898),E=a(8290);async function u(e,{params:t}){let a=(0,T.Xb)(e);if(!a||"viewer"===a.role)return o.NextResponse.json({error:"Insufficient permissions"},{status:403});let s=await e.json(),r=[],n=[];for(let[e,t]of Object.entries({name:"name",email:"email",phone:"phone",area_postcode:"area_postcode",commission_rate:"commission_rate",max_active_leads:"max_active_leads",user_status:"user_status",active:"active"}))void 0!==s[e]&&(r.push(`${t} = ?`),n.push(s[e]));return(void 0!==s.area_postcodes&&(r.push("area_postcodes_json = ?"),n.push(JSON.stringify(s.area_postcodes))),0===r.length)?o.NextResponse.json({error:"No fields to update"},{status:400}):(r.push("updated_at = ?"),n.push(new Date().toISOString()),n.push(t.id),(0,E.KH)(`UPDATE sales_users SET ${r.join(", ")} WHERE id = ?`,...n),o.NextResponse.json({data:{ok:!0}}))}async function d(e,{params:t}){let a=(0,T.Xb)(e);return a&&"owner"===a.role?((0,E.KH)("UPDATE sales_users SET active = 0, user_status = ?, updated_at = ? WHERE id = ?","inactive",new Date().toISOString(),t.id),o.NextResponse.json({data:{ok:!0}})):o.NextResponse.json({error:"Only owners can delete users"},{status:403})}async function l(e,{params:t}){if(!(0,T.Xb)(e))return o.NextResponse.json({error:"Unauthorized"},{status:401});let a=(0,E.pP)("SELECT * FROM sales_users WHERE id = ?",t.id);return a?o.NextResponse.json({data:a}):o.NextResponse.json({error:"Not found"},{status:404})}let c=new r.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/team/[id]/route",pathname:"/api/team/[id]",filename:"route",bundlePath:"app/api/team/[id]/route"},resolvedPagePath:"/Users/Avii/Desktop/klaude-repo/apps/admin-panel/src/app/api/team/[id]/route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:p,staticGenerationAsyncStorage:_,serverHooks:m}=c,N="/api/team/[id]/route";function X(){return(0,i.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:_})}},5898:(e,t,a)=>{a.d(t,{B$:()=>i,Xb:()=>T,cW:()=>E});var s=a(4770);a(1615);var r=a(8290);let n=process.env.ADMIN_SECRET||"admin-panel-dev-secret-change-in-production",i="admin_session";function o(e){let[t,a]=e.split(".");if(!t||!a||a!==(0,s.createHmac)("sha256",n).update(t).digest("base64url"))return null;try{let e=JSON.parse(Buffer.from(t,"base64url").toString());if(e.exp<Date.now()/1e3)return null;return e}catch{return null}}function T(e){let t=e.cookies.get(i)?.value;if(t){let e=o(t);if(e)return e}let a=e.headers.get("authorization");return a?.startsWith("Bearer ")?o(a.slice(7)):null}function E(e,t){let a=(0,s.createHash)("sha256").update(`${n}:${t}`).digest("hex"),i=(0,r.pP)("SELECT * FROM admin_users WHERE (name = ? OR email = ?) AND password_hash = ? AND active = 1",e,e,a);if(!i)return null;let o={id:i.id,name:i.name,email:i.email,role:i.role,active:!0,last_login_at:i.last_login_at,created_at:i.created_at},T=Math.floor(Date.now()/1e3)+604800,E=function(e){let t=Buffer.from(JSON.stringify(e)).toString("base64url"),a=(0,s.createHmac)("sha256",n).update(t).digest("base64url");return`${t}.${a}`}({user_id:o.id,name:o.name,role:o.role,exp:T});return(0,r.KH)("UPDATE admin_users SET last_login_at = ? WHERE id = ?",new Date().toISOString(),o.id),{user:o,token:E}}},8290:(e,t,a)=>{a.d(t,{Kt:()=>l,pP:()=>c,KH:()=>p,PS:()=>_});let s=require("better-sqlite3");var r=a.n(s),n=a(5315),i=a.n(n);let o=require("fs");var T=a.n(o);let E=process.env.DATABASE_PATH||i().join(process.cwd(),"..","mission-control","mission-control.db"),u=null;function d(){if(!u){let e=i().dirname(E);T().existsSync(e)||T().mkdirSync(e,{recursive:!0}),(u=new(r())(E)).pragma("journal_mode = WAL"),u.pragma("foreign_keys = ON"),u.exec(m);let t=e=>{try{u.exec(e)}catch{}};t("ALTER TABLE sales_users ADD COLUMN area_postcodes_json TEXT"),t("ALTER TABLE sales_users ADD COLUMN max_active_leads INTEGER DEFAULT 20"),t("ALTER TABLE sales_users ADD COLUMN user_status TEXT DEFAULT 'available'")}return u}function l(e,...t){return d().prepare(e).all(...t)}function c(e,...t){return d().prepare(e).get(...t)}function p(e,...t){return d().prepare(e).run(...t)}function _(e){return d().transaction(e)()}let m=`
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
`}};var t=require("../../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),s=t.X(0,[276,564],()=>a(4658));module.exports=s})();