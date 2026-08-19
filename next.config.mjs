/** @type {import('next').NextConfig} */
const nextConfig = {
	async headers() {
		return [
			{
				source: "/",
				headers: [{ key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" }],
			},
			{
				source: "/varer",
				headers: [{ key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" }],
			},
			{
				source: "/product/:id",
				headers: [{ key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" }],
			},
			{
				source: "/insights/:city",
				headers: [{ key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" }],
			},
		];
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**",
			},
			{
				protocol: "http",
				hostname: "**",
			},
		],
	},
};

export default nextConfig;
