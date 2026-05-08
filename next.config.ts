import type { NextConfig } from "next";
import os from "os";

/** Collect all local network IPs so dev server accepts connections from any device on the LAN. */
function getLocalIPs(): string[] {
  const ips: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal) {
        ips.push(entry.address);
      }
    }
  }
  return ips;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getLocalIPs(),
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
