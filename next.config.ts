import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 automatically runs src/instrumentation.ts on server
  // startup, so no experimental flag is required here.
  //
  // Critical for native modules: keep @serialport/bindings-cpp and
  // modbus-serial OUT of the server bundle. Turbopack's resolver
  // otherwise loses the native binary's location and `node-gyp-build`
  // fails with "No native build was found" / "loaded from C:\ROOT".
  serverExternalPackages: [
    "modbus-serial",
    "@serialport/bindings-cpp",
    "@serialport/stream",
    "@serialport/parser-readline",
    "serialport",
  ],
};

export default nextConfig;
