/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.module.rules.push({
        test: /\.node$/,
        use: 'file-loader',
        type: 'asset/resource',
      });
      config.externals = config.externals || [];
      config.externals.push('onnxruntime-node', '@xenova/transformers');
    } else {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'onnxruntime-node': false,
        '@xenova/transformers': false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;