import type { NextConfig } from 'next';

const headers = [
  {key:'X-Content-Type-Options', value:'nosniff'},
  {key:'X-Frame-Options', value:'DENY'},
  {key:'Referrer-Policy', value:'strict-origin-when-cross-origin'},
  {key:'Permissions-Policy', value:'camera=(), microphone=(), geolocation=()'},
  {key:'Cross-Origin-Opener-Policy',value:'same-origin'}
];
const nextConfig:NextConfig={
  outputFileTracingRoot:process.cwd(),
  poweredByHeader:false,
  async headers(){return [{source:'/(.*)',headers}]}
};
export default nextConfig;
