import { Navbar } from "@/components/shared/navbar";
import { Sidebar } from "@/components/shared/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="container flex flex-1 gap-6 py-6">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
