import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Diamond Program",
    short_name: "Diamond",
    description: "Your baseball training program, workouts, and logs.",
    start_url: "/player",
    scope: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#027a48",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
