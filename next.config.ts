import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Zezwól na dostęp deweloperski z sieci lokalnej (Wi-Fi)
    allowedDevOrigins: [
        "192.168.0.104",
        "192.168.0.104:3000",
        "192.168.0.*",
        "192.168.1.*",
        "192.168.*",
        "192.168.*.*",
        "10.*",
        "172.*",
        "localhost",
        "localhost:3000",
        "127.0.0.1",
        "127.0.0.1:3000",
    ],
};

export default nextConfig;
