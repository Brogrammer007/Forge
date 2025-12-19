/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'potrace', 'canvas', 'pdfkit', 'onnxruntime-node'],
  },
  images: {
    remotePatterns: [],
    unoptimized: true,
  },
  // Required headers for FFmpeg WASM (SharedArrayBuffer)
  // WOZNIAK MODE: Only apply COOP/COEP for specific routes that need SharedArrayBuffer
  // Don't apply globally as it can break static asset loading in Electron
  async headers() {
    return [
      {
        // Only apply COOP/COEP to routes that actually use FFmpeg WASM
        source: '/gif-converter/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
      {
        // Allow all static assets to load without restrictions
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Allow public assets to load
        source: '/:path*\\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
      };

      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': false,
      };
    }

    // Setup externals for server
    if (isServer) {
      const serverExternals = {
        'onnxruntime-node': 'commonjs onnxruntime-node',
        'sharp': 'commonjs sharp',
      };

      if (typeof config.externals === 'function') {
        const originalExternals = config.externals;
        config.externals = function (context, request, callback) {
          if (serverExternals[request]) {
            return callback(null, serverExternals[request]);
          }
          originalExternals(context, request, callback);
        };
      } else if (Array.isArray(config.externals)) {
        config.externals.push(serverExternals);
      } else {
        config.externals = { ...(config.externals || {}), ...serverExternals };
      }
    }

    return config;
  },
};

module.exports = nextConfig;
