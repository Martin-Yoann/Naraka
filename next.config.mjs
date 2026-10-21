/** @type {import('next').NextConfig} */
const nextConfig={
 poweredByHeader:false,
 serverExternalPackages:['pg'],
 async rewrites(){return [{source:'/catalog.json',destination:'/api/catalog'}]},
 async headers(){return [{source:'/atlas/:path*',headers:[{key:'Cache-Control',value:'public, max-age=3600, stale-while-revalidate=86400'}]}]},
};
export default nextConfig;
