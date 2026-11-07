import { Public_Sans } from "next/font/google";

// The same font the admin dashboard uses (Public Sans), loaded once for the landing and legal pages.
export const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans" });
