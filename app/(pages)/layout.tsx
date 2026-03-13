import Sidebar from "@/components/stateful/Sidebar";

export default function PagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-navy-900">
      <Sidebar />
      <div className="flex-1 ml-64">{children}</div>
    </div>
  );
}
