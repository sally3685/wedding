import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
  },
};

//Wrap Next.js config with withStrapiTypes to enable automatic schema watching and type generation:
export default nextConfig;
